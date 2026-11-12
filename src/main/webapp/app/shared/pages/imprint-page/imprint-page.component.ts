import { Component, ViewEncapsulation } from '@angular/core';

import TranslateDirective from '../../language/translate.directive';

interface ImprintSection {
  titleKey: string;
  contentKey: string;
  extraClasses?: string;
}

@Component({
  selector: 'jhi-imprint-page',
  standalone: true,
  imports: [TranslateDirective],
  templateUrl: './imprint-page.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class ImprintPageComponent {
  readonly sections: ImprintSection[] = [
    { titleKey: 'imprint.publisher.headline', contentKey: 'imprint.publisher.contact', extraClasses: 'leading-8' },
    { titleKey: 'imprint.authorized.headline', contentKey: 'imprint.authorized.text' },
    { titleKey: 'imprint.vat.headline', contentKey: 'imprint.vat.text' },
    { titleKey: 'imprint.responsibility.headline', contentKey: 'imprint.responsibility.text', extraClasses: 'leading-8' },
    { titleKey: 'imprint.tou.headline', contentKey: 'imprint.tou.text' },
    { titleKey: 'imprint.liability.headline', contentKey: 'imprint.liability.text' },
    { titleKey: 'imprint.links.headline', contentKey: 'imprint.links.text' },
  ];
}
