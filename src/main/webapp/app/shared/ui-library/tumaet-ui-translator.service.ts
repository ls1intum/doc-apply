import { Injectable, Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { TumAetUiTranslator } from '@tumaet/ui-angular';
import { map, merge } from 'rxjs';

/**
 * Lets the TUM AET UI kit translate its own labels and the keys the app passes to it through ngx-translate. The kit's
 * labels live in the `tumAetUi` i18n files.
 */
@Injectable({ providedIn: 'root' })
export class TumAetUiTranslatorService implements TumAetUiTranslator {
  readonly locale: Signal<string | undefined>;
  readonly translationChanges: Signal<unknown>;

  private readonly translateService = inject(TranslateService);

  constructor() {
    const currentLang: string | undefined = this.translateService.getCurrentLang() || undefined;
    this.locale = toSignal(this.translateService.onLangChange.pipe(map((event): string | undefined => event.lang)), {
      initialValue: currentLang,
    });
    this.translationChanges = toSignal(merge(this.translateService.onLangChange, this.translateService.onTranslationChange), {
      initialValue: undefined,
    });
  }

  /**
   * Translates a key with the active language.
   *
   * @param key the translation key
   * @param params values for the placeholders in the translation
   * @returns the translated text, or the key while no translation is loaded
   */
  translate(key: string, params?: Readonly<Record<string, number | string>>): string {
    return this.translateService.instant(key, params);
  }
}
