import { Component, computed, effect, signal, untracked } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TumAetUiInputDirective } from '@tumaet/ui-angular';
import { COUNTRY_DIAL_CODES, countryFlag } from 'app/shared/language/countries';
import {
  DEFAULT_PHONE_COUNTRY,
  LONGEST_DIAL_CODE_LENGTH,
  composePhoneNumber,
  parseInternationalNumber,
  parsePhoneNumber,
} from 'app/shared/util/phone-number.util';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

import { BaseInputDirective } from '../base-input/base-input.component';

/** One entry of the country code list. */
interface CountryCodeOption {
  code: string;
  label: string;
}

/**
 * Phone number field with a country code dropdown in front of it. The dropdown shows the flag and dialling code of
 * the selected country, Germany by default, and lists every country with its dialling code. The field accepts digits
 * only. The value written to the form is a single string such as "+49 17612345678", or an empty string while no
 * number is entered.
 */
@Component({
  selector: 'jhi-phone-input',
  templateUrl: './phone-input.component.html',
  imports: [FontAwesomeModule, TumAetUiInputDirective],
})
export class PhoneInputComponent extends BaseInputDirective<string> {
  readonly selectedCountry = signal(DEFAULT_PHONE_COUNTRY);
  readonly nationalNumber = signal('');

  readonly selectedFlag = computed(() => countryFlag(this.selectedCountry()));
  readonly selectedDialCode = computed(() => COUNTRY_DIAL_CODES[this.selectedCountry()]);
  readonly countrySelectId = computed(() => `${this.inputId()}-country`);
  readonly countryCodeLabel = computed(() => this.translator.translate('global.input.phone.countryCode') ?? '');

  readonly isDisabled = computed(() => {
    this.formValidityVersion();
    return this.disabled() || (this.control()?.disabled ?? false);
  });

  /** Mirrors the look of the kit input next to it, since the native select inside is invisible. */
  readonly countryTriggerClasses = computed(() => {
    const base =
      'relative flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-base shadow-xs transition-colors has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-primary-default';
    if (this.isDisabled()) {
      return `${base} border-border-default bg-background-disabled text-text-disabled`;
    }
    const border = this.inputState() === 'invalid' ? 'border-negative-default' : 'border-border-default hover:border-border-hover';
    return `${base} ${border} bg-background-default text-text-primary`;
  });

  /** All countries, named in the current language and sorted by name. */
  readonly countryOptions = computed<CountryCodeOption[]>(() =>
    Object.entries(COUNTRY_DIAL_CODES)
      .map(([code, dialCode]) => ({ code, name: this.translator.translate(`countries.${code}`) ?? code, dialCode }))
      .sort((first, second) => first.name.localeCompare(second.name))
      .map(country => ({ code: country.code, label: `${countryFlag(country.code)} ${country.name} (+${country.dialCode})` })),
  );

  private readonly translator = injectTranslator();

  /** The value this field wrote last, so its own writes are not parsed again and do not reset a shared dialling code. */
  private lastSyncedValue: string | undefined;

  private readonly syncFromControlEffect = effect(onCleanup => {
    const control = this.control();
    if (control === undefined) {
      const model = this.model() ?? '';
      untracked(() => this.applyStoredValue(model));
      return;
    }
    untracked(() => this.applyStoredValue(control.value));
    const subscription = control.valueChanges.subscribe(value => this.applyStoredValue(value));
    onCleanup(() => subscription.unsubscribe());
  });

  /**
   * Selects a country and stores the number with its dialling code.
   *
   * @param countryCode the lowercase ISO code of the selected country
   */
  onCountryChange(countryCode: string): void {
    this.selectedCountry.set(countryCode);
    this.storeValue();
  }

  /**
   * Keeps only the digits of what the user typed or pasted. A number that starts with "+" or "00" and a known
   * dialling code selects that country, so pasting "+33 1 23 45 67 89" works; the "+" stays while the dialling code
   * is still incomplete.
   *
   * @param input the number field
   */
  onNumberInput(input: HTMLInputElement): void {
    const raw = input.value;
    const international = parseInternationalNumber(raw, this.selectedCountry());
    let number: string;
    if (international !== undefined) {
      this.selectedCountry.set(international.countryCode);
      number = digitsOnly(international.nationalNumber);
    } else if (raw.trimStart().startsWith('+') && digitsOnly(raw).length < LONGEST_DIAL_CODE_LENGTH) {
      number = `+${digitsOnly(raw)}`;
    } else {
      number = digitsOnly(raw);
    }
    if (input.value !== number) {
      input.value = number;
    }
    this.nationalNumber.set(number);
    if (!number.startsWith('+')) {
      this.storeValue();
    }
  }

  /** Marks the field as touched once the user leaves it, so validation messages appear. */
  onNumberBlur(): void {
    this.onBlur();
    this.control()?.markAsTouched();
  }

  /**
   * Shows a stored phone number in the dropdown and the number field.
   *
   * @param value the stored value; anything that is not a string counts as empty
   */
  private applyStoredValue(value: unknown): void {
    const stored = typeof value === 'string' ? value : '';
    if (stored === this.lastSyncedValue) {
      return;
    }
    this.lastSyncedValue = stored;
    const parts = parsePhoneNumber(stored, this.selectedCountry());
    this.selectedCountry.set(parts.countryCode);
    this.nationalNumber.set(parts.nationalNumber);
  }

  /** Writes the selected country and the typed number to the form control, or to the model without one. */
  private storeValue(): void {
    const value = composePhoneNumber(this.selectedCountry(), this.nationalNumber());
    this.lastSyncedValue = value;
    const control = this.control();
    if (control === undefined) {
      this.modelChange.emit(value);
      return;
    }
    if (control.value !== value) {
      control.setValue(value);
      control.markAsDirty();
    }
  }
}

/**
 * Removes everything but digits.
 *
 * @param value the text to clean
 * @returns the digits of the text, in order
 */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}
