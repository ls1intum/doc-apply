import { Component, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import ButtonGroupComponent, { ButtonGroupData } from '../../../components/molecules/button-group/button-group.component';
import TranslateDirective from '../../../language/translate.directive';

@Component({
  selector: 'jhi-doctoral-journey-section',
  imports: [TranslateModule, ButtonGroupComponent, TranslateDirective],
  templateUrl: './doctoral-journey-section.component.html',
})
export class DoctoralJourneySectionComponent {
  private translate = inject(TranslateService);

  buttons(): ButtonGroupData {
    return {
      direction: 'horizontal',
      buttons: [
        {
          label: this.translate.instant('landingPage.doctoralJourney.button1'),
          severity: 'secondary',
          variant: 'outlined',
          disabled: false,
          isExternalLink: true,
          onClick: () => window.open('https://www.gs.tum.de/en/gs/path-to-a-doctorate/why-do-your-doctorate-at-tum/', '_blank'),
        },
        {
          label: this.translate.instant('landingPage.doctoralJourney.button2'),
          severity: 'primary',
          disabled: false,
          isExternalLink: true,
          onClick: () => window.open('https://www.gs.tum.de/en/gs/doctorate-at-tum/', '_blank'),
        },
      ],
    };
  }
}
