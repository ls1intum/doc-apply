import { Component, inject } from '@angular/core';
import { AccountService } from 'app/core/auth/account.service';

import { BannerSectionComponent } from '../landing-page/banner-section/banner-section.component';

import { ProfessorHeroSectionComponent } from './professor-hero-section/professor-hero-section.component';
import { ProfessorBenefitsSectionComponent } from './professor-benefits-section/professor-benefits-section.component';
import { ProfessorWorkflowSectionComponent } from './professor-workflow-section/professor-workflow-section.component';
import { ProfessorInformationSectionComponent } from './professor-information-section/professor-information-section.component';
import { ProfessorFaqSectionComponent } from './professor-faq-section/professor-faq-section.component';

@Component({
  selector: 'jhi-professor-landing-page',
  imports: [
    ProfessorHeroSectionComponent,
    ProfessorBenefitsSectionComponent,
    ProfessorWorkflowSectionComponent,
    ProfessorInformationSectionComponent,
    ProfessorFaqSectionComponent,
    BannerSectionComponent,
  ],
  templateUrl: './professor-landing-page.component.html',
})
export class ProfessorLandingPageComponent {
  accountService = inject(AccountService);
}
