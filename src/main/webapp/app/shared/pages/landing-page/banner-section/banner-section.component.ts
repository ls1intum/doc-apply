import { ChangeDetectionStrategy, Component } from '@angular/core';

import TranslateDirective from '../../../language/translate.directive';

@Component({
  selector: 'jhi-banner-section',
  imports: [TranslateDirective],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './banner-section.component.html',
})
export class BannerSectionComponent {}
