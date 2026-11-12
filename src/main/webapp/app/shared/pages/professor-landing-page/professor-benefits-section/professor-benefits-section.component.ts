import { Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { ButtonGroupData } from 'app/shared/components/molecules/button-group/button-group.component';
import TranslateDirective from 'app/shared/language/translate.directive';

@Component({
  selector: 'jhi-professor-benefits-section',
  imports: [TranslateModule, TranslateDirective],
  templateUrl: './professor-benefits-section.component.html',
})
export class ProfessorBenefitsSectionComponent {
  private router = inject(Router);

  buttons(): ButtonGroupData {
    return {
      direction: 'horizontal',
      buttons: [
        {
          label: 'professorLandingPage.platformBenefits.button1',
          severity: 'secondary',
          variant: 'outlined',
          disabled: false,
          isExternalLink: false,
          onClick: () => void this.router.navigate(['/job-overview']),
        },
        {
          label: 'professorLandingPage.platformBenefits.button2',
          severity: 'primary',
          disabled: true,
          isExternalLink: false,
          onClick: () => void this.router.navigate(['/job-overview']),
        },
      ],
    };
  }
}
