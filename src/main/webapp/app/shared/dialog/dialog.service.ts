import { ApplicationRef, DOCUMENT, Injectable, InjectionToken, Injector, Type, inject } from '@angular/core';
import { Observable, ReplaySubject, map, merge, take } from 'rxjs';
import { DynamicDialogConfig, DialogService as PrimeDialogService } from 'primeng/dynamicdialog';

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
  private readonly openComponents = new Set<Type<unknown>>();

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

    // 1) Render through a renderer whose injector also provides the ref and data to the dialog content
    const ref = new DialogRef<R>();
    const dialogInjector = Injector.create({
      parent: this.injector,
      providers: [
        { provide: DialogRef, useValue: ref },
        { provide: DIALOG_DATA, useValue: options.data },
        { provide: PrimeDialogService, useClass: PrimeDialogService, deps: [ApplicationRef, Injector, DOCUMENT] },
      ],
    });
    const rendered = dialogInjector.get(PrimeDialogService).open(component, this.toRendererConfig(options));
    if (rendered === null) {
      return undefined;
    }

    // 2) Close the ref however the dialog goes away, and allow the component again once it is gone
    this.openComponents.add(component);
    const closedResult: Observable<R | undefined> = merge(rendered.onClose, rendered.onDestroy.pipe(map(() => undefined)));
    ref.connect(result => rendered.close(result), closedResult);
    rendered.onDestroy.pipe(take(1)).subscribe(() => this.openComponents.delete(component));
    return ref;
  }

  private toRendererConfig(options: DialogOptions): DynamicDialogConfig {
    const style: Record<string, string> = { background: 'var(--color-background-default)' };
    if (options.width !== undefined) {
      style.width = options.width;
    }
    return {
      header: options.header,
      showHeader: options.showHeader ?? true,
      closable: options.closable ?? true,
      modal: true,
      draggable: false,
      dismissableMask: options.dismissableMask ?? false,
      closeOnEscape: options.closeOnEscape ?? true,
      focusOnShow: options.focusOnShow ?? true,
      styleClass: options.styleClass,
      style: Object.assign(style, options.style),
      contentStyle: options.contentStyle,
    };
  }
}
