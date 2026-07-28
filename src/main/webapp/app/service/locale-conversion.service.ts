import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root',
})
export class LocaleConversionService {
  // default value, will be overridden by the current language of Artemis
  locale = LocaleConversionService.getLang();

  private translateService = inject(TranslateService);

  constructor() {
    this.locale = this.translateService.getCurrentLang();
  }

  /**
   * Get the language set by the user.
   */
  private static getLang(): string {
    if (navigator.languages.length !== 0) {
      return navigator.languages[0];
    } else {
      return navigator.language;
    }
  }

  /**
   * Convert a number value to a locale string.
   * @param value
   * @param maximumFractionDigits
   */
  toLocaleString(value: number, maximumFractionDigits = 1): string {
    const options: Intl.NumberFormatOptions = {
      maximumFractionDigits,
    };

    if (isNaN(value)) {
      return '-';
    } else {
      return value.toLocaleString(this.locale, options);
    }
  }

  /**
   * Convert a number value to a locale string with a % added at the end.
   * @param value
   * @param maximumFractionDigits
   */
  toLocalePercentageString(value: number, maximumFractionDigits = 1): string {
    const options: Intl.NumberFormatOptions = {
      maximumFractionDigits,
    };

    if (isNaN(value)) {
      return '-';
    } else {
      return value.toLocaleString(this.locale, options) + '%';
    }
  }
}
