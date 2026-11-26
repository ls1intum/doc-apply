import { Component, input, output, signal } from '@angular/core';
import { faCalendarXmark } from '@fortawesome/free-solid-svg-icons';
import { CancelInterviewDTO } from 'app/generated/model/cancel-interview-dto';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { DialogComponent } from 'app/shared/components/atoms/dialog/dialog.component';
import { DialogIconHeaderComponent } from 'app/shared/components/molecules/dialog-icon-header/dialog-icon-header.component';
import { OptionRowComponent } from 'app/shared/components/molecules/option-row/option-row.component';
import TranslateDirective from 'app/shared/language/translate.directive';

@Component({
  selector: 'jhi-cancel-interview-modal',
  standalone: true,
  imports: [TranslateDirective, DialogComponent, DialogIconHeaderComponent, ButtonComponent, OptionRowComponent],
  templateUrl: './cancel-interview-modal.component.html',
})
export class CancelInterviewModalComponent {
  visible = input.required<boolean>();

  visibleChange = output<boolean>();
  confirmed = output<CancelInterviewDTO>();

  readonly faCalendarXmark = faCalendarXmark;

  deleteSlot = signal(false);
  sendReinvite = signal(false);

  onConfirm(): void {
    this.confirmed.emit({
      deleteSlot: this.deleteSlot(),
      sendReinvite: this.sendReinvite(),
    });
  }

  onVisibleChange(value: boolean): void {
    if (!value) {
      this.resetState();
    }
    this.visibleChange.emit(value);
  }

  close(): void {
    this.onVisibleChange(false);
  }

  private resetState(): void {
    this.deleteSlot.set(false);
    this.sendReinvite.set(false);
  }
}
