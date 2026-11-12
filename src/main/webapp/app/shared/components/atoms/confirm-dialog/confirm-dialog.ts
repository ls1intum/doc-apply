import { Component, computed, effect, input, output, signal } from '@angular/core';
import { TumAetUiDialogComponent } from '@tumaet/ui-angular';
import { hasText } from 'app/shared/util/text.util';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

import { ButtonColor, ButtonComponent, ButtonSize, ButtonVariant } from '../button/button.component';

/** Width of the dialog for each size class callers can pass through `dialogStyleClass`. */
const SIZE_BY_STYLE_CLASS: Record<string, 'small' | 'medium' | 'large'> = {
  'confirm-dialog-sm': 'small',
  'confirm-dialog-md': 'medium',
  'confirm-dialog-lg': 'large',
};

let nextConfirmDialogId = 0;

/**
 * Asks the user to confirm an action in a modal dialog, opened by its own button, by `visible` or by confirm().
 * Emits `confirmed` with `data` when the user confirms and `closed` whenever the dialog goes away.
 */
@Component({
  selector: 'jhi-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  imports: [TumAetUiDialogComponent, ButtonComponent],
})
export class ConfirmDialog {
  label = input<string | undefined>(undefined);
  iconOnly = input<boolean>(false);
  header = input<string | undefined>(undefined);
  message = input<string | undefined>(undefined);
  messageParams = input<Record<string, unknown>>({});
  confirmIcon = input<string | undefined>(undefined);
  severity = input<ButtonColor>('primary');
  variant = input<ButtonVariant>();
  showOpenButton = input<boolean>(true);
  visible = input(false);
  tooltip = input<string | undefined>(undefined);
  tooltipPosition = input<'top' | 'bottom' | 'left' | 'right'>('top');
  disabled = input<boolean>(false);
  size = input<ButtonSize>('lg');
  shouldTranslate = input<boolean>(true);

  data = input<string | undefined>(undefined);

  /** One of `confirm-dialog-sm`, `confirm-dialog-md` or `confirm-dialog-lg`; without it the dialog fits its text. */
  dialogStyleClass = input<string | undefined>(undefined);

  confirmed = output<unknown>();
  closed = output();

  displayHeader = computed(() => this.translator.translate(this.header(), this.shouldTranslate()));
  displayMessage = computed(() => this.translator.translate(this.message(), this.shouldTranslate(), this.messageParams()));

  /** The button that carries out the action must never be blank, so it falls back to a generic wording. */
  confirmLabel = computed(() => this.label() ?? 'button.confirm');

  /** The kit dialog needs an accessible name, so a dialog without a title is named by its message. */
  ariaLabel = computed(() => (hasText(this.displayHeader()) ? undefined : this.displayMessage()));

  dialogSize = computed(() => {
    const styleClass = this.dialogStyleClass();
    return styleClass === undefined ? undefined : SIZE_BY_STYLE_CLASS[styleClass];
  });

  readonly messageId = `jhi-confirm-dialog-message-${nextConfirmDialogId++}`;
  readonly isOpen = signal(false);

  private translator = injectTranslator();

  // Opens the dialog declaratively when visible becomes true
  private visibleEffect = effect(() => {
    if (this.visible()) {
      this.confirm();
    }
  });

  /** Opens the dialog. */
  confirm(): void {
    this.isOpen.set(true);
  }

  /** Confirms the action and closes the dialog. */
  accept(): void {
    if (!this.isOpen()) {
      return;
    }
    this.confirmed.emit(this.data());
    this.finish();
  }

  /** Closes the dialog without confirming. */
  reject(): void {
    this.finish();
  }

  /**
   * Treats closing through Escape or the backdrop as a rejection.
   *
   * @param visible the visibility the dialog reports
   */
  onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.finish();
    }
  }

  private finish(): void {
    if (!this.isOpen()) {
      return;
    }
    this.isOpen.set(false);
    this.closed.emit();
  }
}
