import { Component, inject } from '@angular/core';
import { Carousel } from 'primeng/carousel';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthFacadeService } from 'app/core/auth/auth-facade.service';
import { Router } from '@angular/router';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import TranslateDirective from 'app/shared/language/translate.directive';
import { IdpProvider } from 'app/core/auth/keycloak-authentication.service';
import { AccountService } from 'app/core/auth/account.service';
import { DialogService } from 'primeng/dynamicdialog';
import { OnboardingDialog } from 'app/shared/components/molecules/onboarding-dialog/onboarding-dialog';
import { ONBOARDING_FORM_DIALOG_CONFIG } from 'app/shared/constants/onboarding-dialog.constants';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';

@Component({
  selector: 'jhi-professor-hero-section',
  imports: [ButtonComponent, Carousel, TranslateModule, TranslateDirective],
  templateUrl: './professor-hero-section.component.html',
})
export class ProfessorHeroSectionComponent {
  imagesWithBackgroundClass = [
    {
      image: 'professor-landing-page-hero-section-1',
      backgroundClass:
        "bg-[url('/content/images/landing-page/hero-section/professor/professor-landing-page-hero-section-1.webp')] bg-cover bg-no-repeat bg-[position:50%_30%] max-lg:bg-center",
    },
    {
      image: 'professor-landing-page-hero-section-2',
      backgroundClass:
        "bg-[url('/content/images/landing-page/hero-section/landing-page-hero-section-2.webp')] bg-cover bg-no-repeat bg-[position:50%_30%] max-lg:bg-center",
    },
    {
      image: 'professor-landing-page-hero-section-3',
      backgroundClass:
        "bg-[url('/content/images/landing-page/hero-section/professor/professor-landing-page-hero-section-3.webp')] bg-cover bg-no-repeat bg-[position:50%_60%] max-lg:bg-center",
    },
  ];

  private authFacadeService = inject(AuthFacadeService);
  private accountService = inject(AccountService);
  private router = inject(Router);
  private dialogService = inject(DialogService);
  private translate = inject(TranslateService);

  async navigateToGetStarted(): Promise<void> {
    if (this.accountService.signedIn()) {
      const isProfessorOrEmployee = this.accountService.hasAnyAuthority([UserShortDTORolesEnum.Professor, UserShortDTORolesEnum.Employee]);
      if (isProfessorOrEmployee) {
        await this.router.navigate(['/my-positions']);
      } else {
        // Open onboarding dialog so user can choose between employee or professor form
        this.dialogService.open(
          OnboardingDialog,
          Object.assign({}, ONBOARDING_FORM_DIALOG_CONFIG, {
            header: this.translate.instant('onboarding.title'),
          }),
        );
      }
    } else {
      await this.authFacadeService.loginWithProvider(IdpProvider.TUM, '/my-positions');
    }
  }
}
