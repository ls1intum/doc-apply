import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  IconDefinition,
  faCircleExclamation,
  faCircleInfo,
  faCircleQuestion,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { TumAetUiDialogComponent, TumAetUiDialogSize } from '@tumaet/ui-angular';
import { hasText } from 'app/shared/util/text.util';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

import { ButtonColor, ButtonComponent, ButtonSize, ButtonVariant } from '../button/button.component';

let nextConfirmDialogId = 0;

const SEVERITY_ICON_BASE_CLASSES = 'flex size-10 shrink-0 items-center justify-center rounded-full text-lg';

/** The leading icon and its tint for each confirm severity; severities without an entry use the primary question mark. */
const SEVERITY_ICONS: Partial<Record<ButtonColor, { icon: IconDefinition; tint: string }>> = {
  danger: { icon: faTriangleExclamation, tint: 'bg-negative-default/15 text-negative-default' },
  warn: { icon: faCircleExclamation, tint: 'bg-warning-default/15 text-warning-default' },
  info: { icon: faCircleInfo, tint: 'bg-info-default/15 text-info-default' },
};

const DEFAULT_SEVERITY_ICON = { icon: faCircleQuestion, tint: 'bg-primary-default/15 text-primary-default' };

/**
 * Asks the user to confirm an action in a modal dialog, opened by its own button, by `visible` or by confirm().
 * Emits `confirmed` with `data` when the user confirms and `closed` whenever the dialog goes away.
 */
@Component({
  selector: 'jhi-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  imports: [TumAetUiDialogComponent, ButtonComponent, FontAwesomeModule, NgTemplateOutlet],
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

  dialogSize = input<TumAetUiDialogSize | undefined>(undefined);

  confirmed = output<unknown>();
  closed = output();

  displayHeader = computed(() => this.translator.translate(this.header(), this.shouldTranslate()));
  displayMessage = computed(() => this.translator.translate(this.message(), this.shouldTranslate(), this.messageParams()));

  /** The button that carries out the action must never be blank, so it falls back to a generic wording. */
  confirmLabel = computed(() => this.label() ?? 'button.confirm');

  hasHeader = computed(() => hasText(this.displayHeader()));

  /** The kit header is hidden for the custom layout, so the dialog takes its accessible name from the header, else the message. */
  ariaLabel = computed(() => {
    if (this.hasHeader()) {
      return this.displayHeader();
    }
    const message = this.displayMessage();
    return hasText(message) ? message : this.translator.translate('global.dialog.label');
  });

  severityStyle = computed(() => SEVERITY_ICONS[this.severity()] ?? DEFAULT_SEVERITY_ICON);
  severityIconClass = computed(() => `${SEVERITY_ICON_BASE_CLASSES} ${this.severityStyle().tint}`);

  bodyClass = computed(() =>
    `flex flex-col gap-3 pt-6 text-left ${this.dialogSize() === undefined ? 'max-w-[40rem] sm:min-w-[26rem]' : ''}`.trim(),
  );

  readonly messageId = `jhi-confirm-dialog-message-${nextConfirmDialogId++}`;
  readonly isOpen = signal(false);

  private translator = injectTranslator();

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
