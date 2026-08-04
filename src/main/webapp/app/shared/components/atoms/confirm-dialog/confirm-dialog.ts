import { Component, ViewEncapsulation, computed, effect, inject, input, output } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

import { ButtonColor, ButtonComponent, ButtonSize, ButtonVariant } from '../button/button.component';

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

  /** The button that carries out the action must never be blank, so it falls back to a generic wording. */
  confirmLabel = computed(() => this.label() ?? 'button.confirm');

  private confirmationService = inject(ConfirmationService);
  private translator = injectTranslator();

  // Opens the dialog declaratively when visible becomes true
  private visibleEffect = effect(() => {
    if (this.visible()) {
      this.openDialog();
    }
  });

  confirm(): void {
    this.openDialog();
  }

  private openDialog(): void {
    this.confirmationService.confirm({
      message: this.displayMessage(),
      header: this.displayHeader(),
      dismissableMask: true,
      closeOnEscape: true,
      accept: () => {
        this.confirmed.emit(this.data());
        this.closed.emit();
      },
      reject: () => {
        this.closed.emit();
      },
    });
  }
}
