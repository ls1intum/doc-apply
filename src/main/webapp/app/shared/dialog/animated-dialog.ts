import { ComponentType } from '@angular/cdk/overlay';
import { Dialog, DialogCloseOptions, DialogConfig, DialogRef } from '@angular/cdk/dialog';
import { Injectable, TemplateRef } from '@angular/core';
import { closeAfterLeaveAnimation } from 'app/shared/util/overlay-leave.util';

/**
 * The CDK dialog service with a leave animation. Every modal in the app, the UI kit's dialogs as well as the ones the
 * dialog service opens, goes through CDK `Dialog`; this replacement lets each one fade out instead of vanishing.
 */
@Injectable()
export class AnimatedDialog extends Dialog {
  /**
   * Opens a dialog whose close first plays the leave animation.
   *
   * @param componentOrTemplateRef the component or template to render
   * @param config how the dialog is shown
   * @returns the ref of the opened dialog
   */
  override open<R = unknown, D = unknown, C = unknown>(
    componentOrTemplateRef: ComponentType<C> | TemplateRef<C>,
    config?: DialogConfig<D, DialogRef<R, C>>,
  ): DialogRef<R, C> {
    const ref = super.open<R, D, C>(componentOrTemplateRef, config);
    const closeNow = ref.close.bind(ref);
    let leaving = false;
    ref.close = (result?: R, options?: DialogCloseOptions): void => {
      if (leaving) {
        return;
      }
      leaving = true;
      closeAfterLeaveAnimation(ref.overlayRef, () => {
        closeNow(result, options);
      });
    };
    return ref;
  }
}
