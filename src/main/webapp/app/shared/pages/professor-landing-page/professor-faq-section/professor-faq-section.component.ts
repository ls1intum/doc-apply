import { Component, computed, inject } from '@angular/core';
import { AccordionModule } from 'primeng/accordion';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { DialogService } from 'primeng/dynamicdialog';
import { AccountService } from 'app/core/auth/account.service';
import { OnboardingDialog } from 'app/shared/components/molecules/onboarding-dialog/onboarding-dialog';
import { ONBOARDING_FORM_DIALOG_CONFIG } from 'app/shared/constants/onboarding-dialog.constants';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';

import TranslateDirective from '../../../language/translate.directive';

@Component({
  selector: 'jhi-professor-faq-section',
  imports: [AccordionModule, TranslateModule, TranslateDirective, FontAwesomeModule, ButtonComponent],
  templateUrl: './professor-faq-section.component.html',
})
export class ProfessorFaqSectionComponent {
  readonly translationKey = 'professorLandingPage.faq.questions';
  tabs = [
    {
      value: 'registration',
      title: `${this.translationKey}.registration.title`,
      content: `${this.translationKey}.registration.content`,
    },
    {
      value: 'login',
      title: `${this.translationKey}.login.title`,
      content: `${this.translationKey}.login.content`,
    },
    {
      value: 'multiple-applications',
      title: `${this.translationKey}.multipleApplications.title`,
      content: `${this.translationKey}.multipleApplications.content`,
    },
    {
      value: 'documents',
      title: `${this.translationKey}.documents.title`,
      content: `${this.translationKey}.documents.content`,
    },
    {
      value: 'status',
      title: `${this.translationKey}.status.title`,
      content: `${this.translationKey}.status.content`,
    },
  ];
  readonly faArrowUpRightFromSquare = faArrowUpRightFromSquare;
  readonly accountService = inject(AccountService);
  readonly loggedIn = computed(() => this.accountService.signedIn());
  readonly isApplicant = computed(() => this.accountService.hasAnyAuthority([UserShortDTORolesEnum.Applicant]));

  private readonly translate = inject(TranslateService);
  private readonly dialogService = inject(DialogService);

  openRegistrationForm(): void {
    this.dialogService.open(OnboardingDialog, {
      ...ONBOARDING_FORM_DIALOG_CONFIG,
      header: this.translate.instant('onboarding.title'),
    });
  }
}
