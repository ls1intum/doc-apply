import { Component, inject } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { IconDefinition, faBuildingColumns, faUserGraduate, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { DialogRef, DialogService } from 'app/shared/dialog/dialog.service';
import { onboardingDialogOptions } from 'app/shared/constants/onboarding-dialog.constants';

import TranslateDirective from '../../../language/translate.directive';
import { ProfOnboardingResourceApi } from '../../../../generated/api/prof-onboarding-resource-api';
import { ResearchGroupCreationFormComponent } from '../research-group-creation-form/research-group-creation-form.component';

import { EmployeeRequestAccessFormComponent } from './employee-request-access-form/employee-request-access-form.component';

/** One role a signed-in user without rights can pick, shown as a card in the onboarding dialog. */
interface OnboardingChoice {
  icon: IconDefinition;
  titleKey: string;
  descriptionKey: string;
  select: VoidFunction;
}

/**
 * Professor onboarding dialog. Asks a signed-in user without rights whether they lead a research group, work in
 * one or apply for positions, and opens the matching next step.
 */
@Component({
  selector: 'jhi-onboarding-dialog',
  standalone: true,
  imports: [FontAwesomeModule, TranslateDirective],
  templateUrl: './onboarding-dialog.html',
})
export class OnboardingDialog {
  readonly choices: OnboardingChoice[] = [
    {
      icon: faBuildingColumns,
      titleKey: 'onboarding.choices.professor.title',
      descriptionKey: 'onboarding.choices.professor.description',
      select: () => this.markOnboarded(),
    },
    {
      icon: faUserPlus,
      titleKey: 'onboarding.choices.employee.title',
      descriptionKey: 'onboarding.choices.employee.description',
      select: () => this.openEmployeeForm(),
    },
    {
      icon: faUserGraduate,
      titleKey: 'onboarding.choices.applicant.title',
      descriptionKey: 'onboarding.choices.applicant.description',
      select: () => this.markOnboarded(false),
    },
  ];

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
