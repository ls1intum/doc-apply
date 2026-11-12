import { Component, effect, input, model } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';

export type DrawerPosition = 'left' | 'right' | 'top' | 'bottom' | 'full';

/**
 * Modal drawer used for mobile burger menus, filter panels, and similar slide-in surfaces.
 * Wraps the PrimeNG drawer with the project's defaults (modal, dismissible, fast animation)
 * and exposes close() so callers can release the modal scroll lock before kicking off any
 * action that visually replaces the current page.
 */
@Component({
  selector: 'jhi-drawer',
  standalone: true,
  imports: [DrawerModule],
  templateUrl: './drawer.component.html',
})
export class DrawerComponent {
  open = model.required<boolean>();
  position = input<DrawerPosition>('right');
  panelClass = input<string>('!w-72 max-w-[85vw]');
  showCloseIcon = input<boolean>(true);
  dismissible = input<boolean>(true);
  /**
   * Whether to render the dimming modal mask behind the drawer. Turn off (`false`) for navigation drawers:
   * the mask is `position: fixed; pointer-events: auto`, so while it animates out (and while the destination
   * route lazy-loads on the same main thread) it blocks every click and scroll on the page underneath.
   */
  modal = input<boolean>(true);

  /**
   * Snappy open/close so the user is not stuck behind the modal mask while it animates.
   * PrimeNG defaults to a 0.5s drawer slide + 0.3s mask fade — together that is long enough
   * to feel like a freeze on navigation actions, so we trim the drawer animation to 150ms
   * and the mask fade to 100ms.
   */
  readonly motionOptions = { duration: 150 } as const;
  readonly maskStyle = { 'animation-duration': '100ms' } as const;

  private outsideClickHandler?: (event: MouseEvent) => void;
  private outsideClickAttachTimeout?: ReturnType<typeof setTimeout>;

  /**
   * PrimeNG's tap-outside dismiss relies on the modal mask, so when callers turn the mask
   * off (to avoid the navigation freeze) we recreate the behaviour ourselves: while the
   * drawer is open we listen for document clicks landing outside any .p-drawer panel and
   * close. The listener is attached on the next task so the click that opened the drawer
   * doesn't immediately close it again; it runs on the bubble phase so a follow-up click
   * on the trigger button settles to closed (trigger handler runs first as a no-op, then
   * the document listener closes). Cleanup runs when the effect re-runs and on destroy.
   */
  private readonly outsideClickEffect = effect(onCleanup => {
    if (this.open() && this.dismissible() && !this.modal()) {
      this.bindOutsideClickListener();
      onCleanup(() => this.unbindOutsideClickListener());
    }
  });

  /**
   * Closes the drawer if it is open. Call this before navigating or triggering any action
   * that replaces the current page; PrimeNG's modal drawer locks body scroll while open
   * and only releases it after its exit animation, so a navigation kicked off while the
   * drawer is still open leaves the next page unscrollable for the duration of the animation.
   */
  close(): void {
    if (this.open()) {
      this.open.set(false);
    }
  }

  private bindOutsideClickListener(): void {
    if (this.outsideClickHandler || this.outsideClickAttachTimeout !== undefined) {
      return;
    }
    this.outsideClickAttachTimeout = setTimeout(() => {
      this.outsideClickAttachTimeout = undefined;
      const handler = (event: MouseEvent): void => {
        const target = event.target;
        if (!(target instanceof Element) || !target.closest('.p-drawer')) {
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
