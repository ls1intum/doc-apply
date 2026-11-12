import { Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AccountService } from 'app/core/auth/account.service';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';

import { HeroSectionComponent } from './hero-section/hero-section.component';
import { ApplicationStepsSectionComponent } from './application-steps-section/application-steps-section.component';
import { DoctoralJourneySectionComponent } from './doctoral-journey-section/doctoral-journey-section.component';
import { InformationSectionComponent } from './information-section/information-section.component';
import { FaqSectionComponent } from './faq-section/faq-section.component';
import { JobsPreviewSectionComponent } from './jobs-preview-section/jobs-preview-section.component';
import { BannerSectionComponent } from './banner-section/banner-section.component';

@Component({
  selector: 'jhi-landing-page',
  imports: [
    HeroSectionComponent,
    JobsPreviewSectionComponent,
    ApplicationStepsSectionComponent,
    DoctoralJourneySectionComponent,
    InformationSectionComponent,
    FaqSectionComponent,
    BannerSectionComponent,
  ],
  templateUrl: './landing-page.component.html',
})
export class LandingPageComponent {
  router = inject(Router);
  accountService = inject(AccountService);

  private redirectEffect = effect(() => {
    const user = this.accountService.user();
    if (user && this.accountService.hasAnyAuthority([UserShortDTORolesEnum.Professor, UserShortDTORolesEnum.Employee])) {
      void this.router.navigate(['/professor']);
    }
  });
}
