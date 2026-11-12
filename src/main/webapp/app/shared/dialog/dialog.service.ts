import { DialogRef as CdkDialogRef, Dialog } from '@angular/cdk/dialog';
import { createNoopScrollStrategy } from '@angular/cdk/overlay';
import { Injectable, InjectionToken, Injector, Type, inject } from '@angular/core';
import { Observable, ReplaySubject, take } from 'rxjs';
import { hasText } from 'app/shared/util/text.util';

import { DIALOG_SHELL_CONFIG, DialogShellComponent, DialogShellConfig } from './dialog-shell.component';

/**
 * The data a dialog was opened with. Dialog content reads it with `inject<MyData | undefined>(DIALOG_DATA)`.
 * Outside a dialog it is undefined, so components that also render on a page can read it safely.
 */
export const DIALOG_DATA = new InjectionToken<unknown>('DIALOG_DATA', { providedIn: 'root', factory: () => undefined });

/** How a dialog opened through {@link DialogService} looks and behaves. */
export interface DialogOptions {
  /** Already translated title. */
  header?: string;
  width?: string;
  data?: unknown;
  closable?: boolean;
  showHeader?: boolean;
  /** Whether clicking the backdrop closes the dialog. */
  dismissableMask?: boolean;
  closeOnEscape?: boolean;
  /** Whether the first focusable element inside receives focus when the dialog opens. */
  focusOnShow?: boolean;
  styleClass?: string;
  /** Extra styles for the dialog panel, applied after the default background and width. */
  style?: Record<string, string>;
  contentStyle?: Record<string, string>;
}

/**
 * A dialog opened through {@link DialogService}. The opener listens to {@link closed}; the dialog content injects
 * its ref with `inject<DialogRef<MyResult>>(DialogRef)` and calls {@link close} with its result.
 */
export class DialogRef<R = unknown> {
  /** Emits the result once when the dialog closes, also when it is dismissed without one, then completes. */
  readonly closed: Observable<R | undefined>;

  private readonly result = new ReplaySubject<R | undefined>(1);
  constructor() {
    this.closed = this.result.asObservable();
  }

  /**
   * Closes the dialog.
   *
   * @param result what the opener receives through {@link closed}
   */
  close(result?: R): void {
    this.requestClose(result);
  }

  /**
   * Wires this ref to the dialog that renders it. Only {@link DialogService} calls this.
   *
   * @param requestClose closes the rendered dialog with a result
   * @param closedResult emits once when the rendered dialog has closed
   */
  connect(requestClose: (result: R | undefined) => void, closedResult: Observable<R | undefined>): void {
    this.requestClose = requestClose;
    closedResult.pipe(take(1)).subscribe(result => {
      this.result.next(result);
      this.result.complete();
    });
  }

  private requestClose: (result: R | undefined) => void = () => undefined;
}

/**
 * Opens components in a modal dialog. Pages and dialog content use this service, {@link DialogRef} and
 * {@link DIALOG_DATA}, so the library that renders the dialog stays an implementation detail of this file.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly injector = inject(Injector);
  private readonly cdkDialog = inject(Dialog);
  private readonly openComponents = new Set<Type<unknown>>();
  private nextTitleId = 0;

  /**
   * Opens a component in a dialog.
   *
   * @param component the component to render inside the dialog
   * @param options title, size, data and behaviour of the dialog
   * @returns the dialog's ref, or undefined while a dialog with the same component is still open
   */
  open<R = unknown>(component: Type<unknown>, options: DialogOptions = {}): DialogRef<R> | undefined {
    if (this.openComponents.has(component)) {
      return undefined;
    }

    // 1) Give the dialog content an injector that provides its ref and data
    const ref = new DialogRef<R>();
    const contentInjector = Injector.create({
      parent: this.injector,
      providers: [
        { provide: DialogRef, useValue: ref },
        { provide: DIALOG_DATA, useValue: options.data },
      ],
    });

    // 2) Render the frame with the content in a modal overlay that closes only as the options allow
    let rendered: CdkDialogRef<R | undefined, DialogShellComponent> | undefined = undefined;
    const close = (result: R | undefined): void => rendered?.close(result);
    const titleId = `jhi-dialog-title-${this.nextTitleId++}`;
    const hasTitle = (options.showHeader ?? true) && hasText(options.header);
    const shellConfig: DialogShellConfig = { component, contentInjector, options, titleId, close: () => close(undefined) };
    rendered = this.cdkDialog.open<R | undefined, unknown, DialogShellComponent>(DialogShellComponent, {
      injector: Injector.create({ parent: this.injector, providers: [{ provide: DIALOG_SHELL_CONFIG, useValue: shellConfig }] }),
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      disableClose: true,
      ariaModal: true,
      ariaLabelledBy: hasTitle ? titleId : undefined,
      autoFocus: 'dialog',
      restoreFocus: true,
      scrollStrategy: createNoopScrollStrategy(),
    });
    const dismiss = rendered;
    rendered.backdropClick.subscribe(() => {
      if (options.dismissableMask ?? false) {
        dismiss.close(undefined);
      }
    });
    rendered.keydownEvents.subscribe(event => {
      if (event.key === 'Escape' && (options.closeOnEscape ?? true)) {
        dismiss.close(undefined);
      }
    });

    // 3) Close the ref however the dialog goes away, and allow the component again once it is gone
    this.openComponents.add(component);
    ref.connect(close, rendered.closed);
    rendered.closed.pipe(take(1)).subscribe(() => this.openComponents.delete(component));
    return ref;
  }
}
