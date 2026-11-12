import { Component, input, output } from '@angular/core';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';

import { DialogComponent } from '../../../components/atoms/dialog/dialog.component';
import TranslateDirective from '../../../language/translate.directive';

@Component({
  selector: 'jhi-ai-consent-modal',
  standalone: true,
  imports: [DialogComponent, TranslateDirective],
  templateUrl: './ai-consent-modal.component.html',
})
export class AiConsentModalComponent {
  visible = input.required<boolean>();
  currentRole = input<UserShortDTORolesEnum | undefined>(undefined);
  settings = input<boolean>(true);
  visibleChange = output<boolean>();

  protected readonly RolesEnum = UserShortDTORolesEnum;

  close(): void {
    this.visibleChange.emit(false);
  }
}
