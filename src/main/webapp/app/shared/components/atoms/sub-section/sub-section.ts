import { Component, input } from '@angular/core';
import TranslateDirective from 'app/shared/language/translate.directive';

@Component({
  selector: 'jhi-sub-section',
  imports: [TranslateDirective],
  templateUrl: './sub-section.html',
})
export class SubSection {
  titleKey = input.required<string>();
  shouldTranslate = input<boolean>(true);
  /**
   * Optional placeholder values interpolated into {@code titleKey} when {@code shouldTranslate}
   * is true. Lets callers pass dynamic values (e.g. a referee name) without losing translation.
   */
  titleParams = input<Record<string, unknown> | undefined>(undefined);
}
