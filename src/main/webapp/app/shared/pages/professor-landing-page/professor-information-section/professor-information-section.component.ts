import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import TranslateDirective from '../../../language/translate.directive';
import { InformationCardComponent } from '../../landing-page/information-section/information-card/information-card/information-card.component';

@Component({
  selector: 'jhi-professor-information-section',
  standalone: true,
  imports: [InformationCardComponent, TranslateModule, TranslateDirective],
  templateUrl: './professor-information-section.component.html',
})
export class ProfessorInformationSectionComponent {
  readonly translationKey = 'professorLandingPage.informationSection.tiles';
  readonly imageSrc = '/content/images/landing-page/information-section/professor/';

  cards = [
    {
      imageSrc: `${this.imageSrc}research.webp`,
      text: `${this.translationKey}.1`,
      link: 'https://www.tum.de/en/research',
    },
    {
      imageSrc: `${this.imageSrc}development.webp`,
      text: `${this.translationKey}.2`,
      link: 'https://www.tum.de/en/lifelong-learning/all-employees',
    },
    {
      imageSrc: `${this.imageSrc}networks.webp`,
      text: `${this.translationKey}.3`,
      link: 'https://web.tum.de/en/inw/home/',
    },
    {
      imageSrc: `${this.imageSrc}services.webp`,
      text: `${this.translationKey}.4`,
      link: 'https://www.tum.de/en/research/support-for-researchers',
    },
    {
      imageSrc: `${this.imageSrc}transfer.webp`,
      text: `${this.translationKey}.5`,
      link: 'https://www.tum.de/en/innovation/patents-and-licenses',
    },
    {
      imageSrc: `${this.imageSrc}partnerships.webp`,
      text: `${this.translationKey}.6`,
      link: 'https://www.international.tum.de/en/global/partnerships-initiatives/',
    },
  ];
}
