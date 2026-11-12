import { Component, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CancelInterviewDTO } from 'app/generated/model/cancel-interview-dto';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { CheckboxComponent } from 'app/shared/components/atoms/checkbox/checkbox.component';
import { DialogComponent } from 'app/shared/components/atoms/dialog/dialog.component';
import TranslateDirective from 'app/shared/language/translate.directive';

@Component({
  selector: 'jhi-cancel-interview-modal',
  standalone: true,
  imports: [TranslateModule, TranslateDirective, DialogComponent, ButtonComponent, CheckboxComponent],
  templateUrl: './cancel-interview-modal.component.html',
})
export class CancelInterviewModalComponent {
  visible = input.required<boolean>();

  visibleChange = output<boolean>();
  confirmed = output<CancelInterviewDTO>();

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
