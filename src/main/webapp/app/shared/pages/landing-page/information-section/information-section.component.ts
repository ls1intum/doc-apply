import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import TranslateDirective from '../../../language/translate.directive';

import { InformationCardComponent } from './information-card/information-card/information-card.component';

@Component({
  selector: 'jhi-information-section',
  imports: [InformationCardComponent, TranslateModule, TranslateDirective],
  templateUrl: './information-section.component.html',
})
export class InformationSectionComponent {
  cards = [
    {
      imageSrc: '/content/images/landing-page/information-section/excellence.webp',
      text: 'landingPage.informationSection.tiles.1',
      link: 'https://www.tum.de/en/about-tum/university-of-excellence',
    },
    {
      imageSrc: '/content/images/landing-page/information-section/events.webp',
      text: 'landingPage.informationSection.tiles.2',
      link: 'https://www.gs.tum.de/gs/veranstaltungen/',
    },
    {
      imageSrc: '/content/images/landing-page/information-section/women.webp',
      text: 'landingPage.informationSection.tiles.3',
      link: 'https://www.community.tum.de/en/tum-community/women/',
    },
    {
      imageSrc: '/content/images/landing-page/information-section/internationality.webp',
      text: 'landingPage.informationSection.tiles.4',
      link: 'https://www.tum.de/en/studies/international-students',
    },
    {
      imageSrc: '/content/images/landing-page/information-section/funding.webp',
      text: 'landingPage.informationSection.tiles.5',
      link: 'https://www.gs.tum.de/en/gs/path-to-a-doctorate/funding/',
    },
    {
      imageSrc: '/content/images/landing-page/information-section/diversity.webp',
      text: 'landingPage.informationSection.tiles.6',
      link: 'https://www.zv.tum.de/en/diversity/homepage/',
    },
  ];
}
