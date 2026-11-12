import { A11yModule } from '@angular/cdk/a11y';
import { OverlayRef, createGlobalPositionStrategy, createNoopScrollStrategy, createOverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  Component,
  DestroyRef,
  Injector,
  TemplateRef,
  ViewContainerRef,
  computed,
  effect,
  inject,
  input,
  model,
  untracked,
  viewChild,
} from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

export type DrawerPosition = 'left' | 'right' | 'top' | 'bottom' | 'full';

const EDGE_CLASSES: Record<DrawerPosition, string> = {
  left: 'h-full drawer-enter-left',
  right: 'h-full drawer-enter-right',
  top: 'w-full drawer-enter-top',
  bottom: 'w-full drawer-enter-bottom',
  full: 'h-full w-full drawer-enter-bottom',
};

let nextDrawerId = 0;

/**
 * Modal drawer used for mobile burger menus, filter panels, and similar slide-in surfaces.
 * It renders in an overlay at the edge of the viewport, traps focus while open, closes on Escape, and exposes
 * close() so callers can close it before kicking off an action that visually replaces the current page.
 */
@Component({
  selector: 'jhi-drawer',
  imports: [A11yModule, FontAwesomeModule],
  templateUrl: './drawer.component.html',
  styleUrl: './drawer.component.scss',
})
export class DrawerComponent {
  open = model.required<boolean>();
  position = input<DrawerPosition>('right');
  panelClass = input<string>('!w-72 max-w-[85vw]');
  showCloseIcon = input<boolean>(true);
  /** Whether a click outside the drawer closes it. */
  dismissible = input<boolean>(true);
  /**
   * Whether to render the dimming backdrop behind the drawer. Turn off (`false`) for navigation drawers, so the page
   * underneath stays clickable while the destination route loads.
   */
  modal = input<boolean>(true);

  protected readonly headerId = `jhi-drawer-header-${nextDrawerId++}`;
  protected readonly faXmark = faXmark;
  protected readonly panelClasses = computed(() => `${EDGE_CLASSES[this.position()]} ${this.panelClass()}`);

  protected readonly closeLabel = computed(() => this.translator.translate('button.close'));

  private readonly translator = injectTranslator();

  private readonly injector = inject(Injector);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly panelTemplate = viewChild.required<TemplateRef<unknown>>('panel');
  private overlayRef?: OverlayRef;
  private outsideClickHandler?: (event: MouseEvent) => void;
  private outsideClickAttachTimeout?: ReturnType<typeof setTimeout>;

  private readonly visibilitySync = effect(() => {
    const open = this.open();
    untracked(() => {
      if (open) {
        this.attach();
      } else {
        this.detach();
      }
    });
  });

  /**
   * Without the backdrop nothing catches a tap outside the drawer, so while a non-modal drawer is open a document
   * click listener closes it. The listener is attached on the next task so the click that opened the drawer does not
   * close it again, and it runs on the bubble phase so a click on the trigger settles to closed.
   */
  private readonly outsideClickEffect = effect(onCleanup => {
    if (this.open() && this.dismissible() && !this.modal()) {
      this.bindOutsideClickListener();
      onCleanup(() => this.unbindOutsideClickListener());
    }
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.detach();
    });
  }

  /**
   * Closes the drawer if it is open. Call this before navigating or triggering any action that replaces the current
   * page, so the drawer does not linger over the next one.
   */
  close(): void {
    if (this.open()) {
      this.open.set(false);
    }
  }

  private attach(): void {
    if (this.overlayRef !== undefined) {
      return;
    }
    // 1) Pin the panel to the requested edge of the viewport
    const position = this.position();
    const positionStrategy = createGlobalPositionStrategy(this.injector);
    if (position === 'right') {
      positionStrategy.top('0').right('0');
    } else if (position === 'bottom') {
      positionStrategy.bottom('0').left('0');
    } else {
      positionStrategy.top('0').left('0');
    }

    // 2) Render the panel, with a backdrop only for modal drawers
    const overlayRef = createOverlayRef(this.injector, {
      positionStrategy,
      scrollStrategy: createNoopScrollStrategy(),
      hasBackdrop: this.modal(),
      backdropClass: 'cdk-overlay-dark-backdrop',
      height: position === 'top' || position === 'bottom' ? undefined : '100%',
      width: position === 'left' || position === 'right' ? undefined : '100%',
    });
    overlayRef.attach(new TemplatePortal(this.panelTemplate(), this.viewContainerRef));
    this.overlayRef = overlayRef;

    // 3) Close on Escape, and on a backdrop click when the drawer is dismissible
    overlayRef.backdropClick().subscribe(() => {
      if (this.dismissible()) {
        this.close();
      }
    });
    overlayRef.keydownEvents().subscribe(event => {
      if (event.key === 'Escape') {
        this.close();
      }
    });
  }

  private detach(): void {
    this.overlayRef?.dispose();
    this.overlayRef = undefined;
  }

  private bindOutsideClickListener(): void {
    if (this.outsideClickHandler || this.outsideClickAttachTimeout !== undefined) {
      return;
    }
    this.outsideClickAttachTimeout = setTimeout(() => {
      this.outsideClickAttachTimeout = undefined;
      const handler = (event: MouseEvent): void => {
        const target = event.target;
        const panel = this.overlayRef?.overlayElement;
        if (!(target instanceof Node) || panel?.contains(target) !== true) {
          this.open.set(false);
        }
      };
      document.addEventListener('click', handler);
      this.outsideClickHandler = handler;
    });
  }

  private unbindOutsideClickListener(): void {
    if (this.outsideClickAttachTimeout !== undefined) {
      clearTimeout(this.outsideClickAttachTimeout);
      this.outsideClickAttachTimeout = undefined;
    }
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler);
      this.outsideClickHandler = undefined;
    }
  }
}
