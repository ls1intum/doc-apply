import { Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { TranslateService } from '@ngx-translate/core';
import { MessageModule } from 'primeng/message';
import { firstValueFrom } from 'rxjs';
import { DialogService } from 'primeng/dynamicdialog';
import { ONBOARDING_FORM_DIALOG_CONFIG } from 'app/shared/constants/onboarding-dialog.constants';

import { ButtonComponent } from '../../atoms/button/button.component';
import TranslateDirective from '../../../language/translate.directive';
import { ProfOnboardingResourceApi } from '../../../../generated/api/prof-onboarding-resource-api';
import { ResearchGroupCreationFormComponent } from '../research-group-creation-form/research-group-creation-form.component';

import { EmployeeRequestAccessFormComponent } from './employee-request-access-form/employee-request-access-form.component';

/**
 * Professor onboarding dialog.
 */
@Component({
  selector: 'jhi-onboarding-dialog',
  standalone: true,
  imports: [ButtonModule, ButtonComponent, TranslateDirective, MessageModule],
  templateUrl: './onboarding-dialog.html',
})
export class OnboardingDialog {
  private readonly ref = inject(DynamicDialogRef, { optional: true });
  private readonly api = inject(ProfOnboardingResourceApi);
  private readonly translate = inject(TranslateService);
  private readonly dialogService = inject(DialogService);

  markOnboarded(openForm = true): void {
    if (openForm) {
      this.ref?.close();

      this.dialogService.open(ResearchGroupCreationFormComponent, {
        ...ONBOARDING_FORM_DIALOG_CONFIG,
        header: this.translate.instant('onboarding.professorRequest.dialogTitle'),
      });
    } else {
      void firstValueFrom(this.api.confirmOnboarding()).catch();
      this.ref?.close();
    }
  }

  openEmployeeForm(): void {
    this.ref?.close();

    this.dialogService.open(EmployeeRequestAccessFormComponent, {
      ...ONBOARDING_FORM_DIALOG_CONFIG,
      header: this.translate.instant('onboarding.employeeRequest.dialogTitle'),
    });
  }
}
