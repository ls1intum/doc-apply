import { OverlayRef } from '@angular/cdk/overlay';

const LEAVING_CLASS = 'motion-leaving';

/**
 * Plays the leave animation of an overlay, then runs the actual close. CDK overlays remove their pane at once, so the
 * pane and backdrop get a leaving class first and the close waits until the content's animation has finished. When no
 * animation applies, for example with reduced motion or in tests, the close runs right away. The hidden anchors a
 * dialog's focus trap puts around the content are skipped when reading the animation.
 *
 * @param overlayRef the overlay that is about to close
 * @param close removes the overlay
 */
export function closeAfterLeaveAnimation(overlayRef: OverlayRef, close: () => void): void {
  const pane = overlayRef.overlayElement;
  pane.classList.add(LEAVING_CLASS);
  overlayRef.backdropElement?.classList.add(LEAVING_CLASS);

  const content = pane.querySelector(':scope > :not(.cdk-focus-trap-anchor)');
  const durationMs = content instanceof HTMLElement ? leaveDurationMs(content) : 0;
  if (durationMs === 0) {
    close();
    return;
  }
  setTimeout(close, durationMs);
}

/**
 * Reads how long the element's current animation runs.
 *
 * @param element the element that plays the leave animation
 * @returns the duration in milliseconds, or 0 when no animation applies
 */
function leaveDurationMs(element: HTMLElement): number {
  const style = getComputedStyle(element);
  if (style.animationName === '' || style.animationName === 'none') {
    return 0;
  }
  const seconds = Number.parseFloat(style.animationDuration);
  return Number.isFinite(seconds) ? seconds * 1000 : 0;
}
