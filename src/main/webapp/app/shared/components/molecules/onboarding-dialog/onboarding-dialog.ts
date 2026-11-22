import { Component, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { DialogRef, DialogService } from 'app/shared/dialog/dialog.service';
import { onboardingDialogOptions } from 'app/shared/constants/onboarding-dialog.constants';

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
  imports: [ButtonComponent, TranslateDirective],
  templateUrl: './onboarding-dialog.html',
})
export class OnboardingDialog {
  private readonly ref = inject(DialogRef, { optional: true });
  private readonly api = inject(ProfOnboardingResourceApi);
  private readonly translate = inject(TranslateService);
  private readonly dialogService = inject(DialogService);

  markOnboarded(openForm = true): void {
    if (openForm) {
      this.ref?.close();

      this.dialogService.open(
        ResearchGroupCreationFormComponent,
        onboardingDialogOptions(this.translate.instant('onboarding.professorRequest.dialogTitle')),
      );
    } else {
      void firstValueFrom(this.api.confirmOnboarding()).catch();
      this.ref?.close();
    }
  }

  openEmployeeForm(): void {
    this.ref?.close();

    this.dialogService.open(
      EmployeeRequestAccessFormComponent,
      onboardingDialogOptions(this.translate.instant('onboarding.employeeRequest.dialogTitle')),
    );
  }
}
