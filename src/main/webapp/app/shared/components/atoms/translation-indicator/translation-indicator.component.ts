import { Component, computed, input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ProgressSpinnerComponent } from 'app/shared/components/atoms/progress-spinner/progress-spinner.component';
import TranslateDirective from 'app/shared/language/translate.directive';

/** Shows that an automatic translation is running and in which direction, for example "Translating EN → DE". */
@Component({
  selector: 'jhi-translation-indicator',
  templateUrl: './translation-indicator.component.html',
  imports: [FontAwesomeModule, ProgressSpinnerComponent, TranslateDirective],
})
export class TranslationIndicatorComponent {
  /** The language the text is being translated into, 'de' or 'en'. */
  targetLang = input.required<string>();

  protected readonly source = computed(() => (this.targetLang() === 'de' ? 'EN' : 'DE'));
  protected readonly target = computed(() => (this.targetLang() === 'de' ? 'DE' : 'EN'));
}
