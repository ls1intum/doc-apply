import { Component, ElementRef, ViewEncapsulation, computed, effect, inject, input, output, viewChild } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

import { ButtonColor, ButtonComponent, ButtonSize, ButtonVariant } from '../button/button.component';

/** Matches the controls a reader can tab to, in the order they appear. */
const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

@Component({
  selector: 'jhi-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
  providers: [ConfirmationService],
  imports: [ConfirmDialogModule, ButtonComponent, FontAwesomeModule],
  encapsulation: ViewEncapsulation.None,
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

  // Input for sizing
  dialogStyleClass = input<string | undefined>(undefined);

  confirmed = output<unknown>();
  closed = output();

  displayHeader = computed(() => this.translator.translate(this.header(), this.shouldTranslate()));
  displayMessage = computed(() => this.translator.translate(this.message(), this.shouldTranslate(), this.messageParams()));

  private readonly dialogContent = viewChild<ElementRef<HTMLElement>>('dialogContent');

  private confirmationService = inject(ConfirmationService);
  private translator = injectTranslator();
  private elementToRestoreFocusTo: HTMLElement | undefined;

  // Opens the dialog declaratively when visible becomes true
  private visibleEffect = effect(() => {
    if (this.visible()) {
      this.openDialog();
    }
  });

  /**
   * Moves focus into the dialog once it is on screen.
   *
   * PrimeNG focuses the first focusable element of its own content, header or footer, none of which
   * exist for a headless dialog, so without this focus stays behind the mask and the buttons cannot
   * be reached by keyboard at all.
   */
  private moveFocusIntoDialogEffect = effect(() => {
    const content = this.dialogContent()?.nativeElement;
    if (content === undefined) {
      return;
    }
    // The dialog animates in, so focusing is deferred until it can actually take focus.
    setTimeout(() => content.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus());
  });

  confirm(): void {
    this.openDialog();
  }

  private openDialog(): void {
    this.elementToRestoreFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    this.confirmationService.confirm({
      message: this.displayMessage(),
      header: this.displayHeader(),
      dismissableMask: true,
      closeOnEscape: true,
      accept: () => {
        this.confirmed.emit(this.data());
        this.closed.emit();
        this.restoreFocus();
      },
      reject: () => {
        this.closed.emit();
        this.restoreFocus();
      },
    });
  }

  /**
   * Returns focus to whatever opened the dialog, so the keyboard does not land back at the top of the page.
   * The trigger may be gone by then, for example the delete button of the row that was just removed.
   */
  private restoreFocus(): void {
    const trigger = this.elementToRestoreFocusTo;
    this.elementToRestoreFocusTo = undefined;
    if (trigger?.isConnected === true) {
      trigger.focus();
    }
  }
}
