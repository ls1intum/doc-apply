import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

import TranslateDirective from '../../language/translate.directive';

@Component({
  selector: 'jhi-about-us-page',
  standalone: true,
  imports: [TranslateDirective],
  templateUrl: './about-us-page.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  encapsulation: ViewEncapsulation.None,
})
export class AboutUsPageComponent {}
