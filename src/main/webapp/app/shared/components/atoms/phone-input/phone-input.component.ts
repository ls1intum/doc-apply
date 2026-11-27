import {
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  Injector,
  TemplateRef,
  ViewContainerRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  OverlayRef,
  createFlexibleConnectedPositionStrategy,
  createOverlayRef,
  createRepositionScrollStrategy,
} from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TumAetUiInputDirective } from '@tumaet/ui-angular';
import TranslateDirective from 'app/shared/language/translate.directive';
import { COUNTRY_DIAL_CODES, countryFlag } from 'app/shared/language/countries';
import { DROPDOWN_POSITIONS } from 'app/shared/util/overlay-position.util';
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
  name: string;
  dialCode: string;
  flag: string;
  searchName: string;
}

/**
 * Phone number field with a country code dropdown in front of it. The dropdown button shows the flag and dialling
 * code of the selected country, Germany by default, and opens a searchable list of every country with its dialling
 * code. The list follows the combobox pattern: the search field keeps the focus, Arrow Up and Down move through the
 * countries, Enter picks one, and Escape or Tab closes the list. The number field accepts digits only. The value
 * written to the form is a single string such as "+49 17612345678", or an empty string while no number is entered.
 */
@Component({
  selector: 'jhi-phone-input',
  templateUrl: './phone-input.component.html',
  imports: [FontAwesomeModule, TumAetUiInputDirective, TranslateDirective],
})
export class PhoneInputComponent extends BaseInputDirective<string> {
  readonly selectedCountry = signal(DEFAULT_PHONE_COUNTRY);
  readonly nationalNumber = signal('');
  readonly panelOpen = signal(false);
  readonly searchQuery = signal('');
  readonly activeIndex = signal(-1);

  readonly selectedFlag = computed(() => countryFlag(this.selectedCountry()));
  readonly selectedDialCode = computed(() => COUNTRY_DIAL_CODES[this.selectedCountry()]);
  readonly countryTriggerId = computed(() => `${this.inputId()}-country`);
  readonly countrySearchId = computed(() => `${this.inputId()}-country-search`);
  readonly countryListId = computed(() => `${this.inputId()}-country-list`);
  readonly countryCodeLabel = computed(() => this.translator.translate('global.input.phone.countryCode') ?? '');
  readonly searchPlaceholder = computed(() => this.translator.translate('global.input.phone.searchCountry') ?? '');

  readonly isDisabled = computed(() => {
    this.formValidityVersion();
    return this.disabled() || (this.control()?.disabled ?? false);
  });

  /** Mirrors the look of the kit input next to it. */
  readonly countryTriggerClasses = computed(() => {
    const base =
      'flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-base shadow-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-default';
    if (this.isDisabled()) {
      return `${base} cursor-not-allowed border-border-default bg-background-disabled text-text-disabled`;
    }
    const border = this.inputState() === 'invalid' ? 'border-negative-default' : 'border-border-default hover:border-border-hover';
    return `${base} cursor-pointer ${border} bg-background-default text-text-primary`;
  });

  /** All countries, named in the current language and sorted by name. */
  readonly countryOptions = computed<CountryCodeOption[]>(() =>
    Object.entries(COUNTRY_DIAL_CODES)
      .map(([code, dialCode]) => {
        const name = this.translator.translate(`countries.${code}`) ?? code;
        return { code, name, dialCode, flag: countryFlag(code), searchName: normalizeSearchText(name) };
      })
      .sort((first, second) => first.name.localeCompare(second.name)),
  );

  readonly countryTriggerLabel = computed(() => {
    const option = this.countryOptions().find(country => country.code === this.selectedCountry());
    return (
      this.translator.translate('global.input.phone.selectedCountry', true, {
        country: option?.name ?? this.selectedCountry(),
        dialCode: this.selectedDialCode(),
      }) ?? ''
    );
  });

  /**
   * The countries that match the search. A query that starts with "+" or holds only digits matches the beginning of
   * the dialling code; any other query matches the country name, ignoring case and accents, or the ISO code.
   */
  readonly filteredCountries = computed(() => {
    const query = normalizeSearchText(this.searchQuery());
    const options = this.countryOptions();
    if (query === '') {
      return options;
    }
    if (query.startsWith('+') || /^\d+$/.test(query)) {
      const digits = query.replace(/^\+/, '');
      return options.filter(option => option.dialCode.startsWith(digits));
    }
    return options.filter(option => option.searchName.includes(query) || option.code === query);
  });

  readonly activeOptionId = computed(() => {
    const option = this.filteredCountries().at(this.activeIndex());
    return this.activeIndex() >= 0 && option !== undefined ? `${this.countryListId()}-${option.code}` : undefined;
  });

  private readonly translator = injectTranslator();
  private readonly injector = inject(Injector);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly document = inject(DOCUMENT);
  private readonly countryTrigger = viewChild.required<ElementRef<HTMLButtonElement>>('countryTrigger');
  private readonly numberInput = viewChild.required<ElementRef<HTMLInputElement>>('numberInput');
  private readonly countryPanel = viewChild.required<TemplateRef<unknown>>('countryPanel');
  private overlayRef?: OverlayRef;

  /** The value this field wrote last, so its own writes are not parsed again and do not reset a shared dialling code. */
  private lastSyncedValue: string | undefined;

  private readonly syncFromControlEffect = effect(onCleanup => {
    const control = this.control();
    if (control === undefined) {
      const model = this.model() ?? '';
      untracked(() => {
        this.applyStoredValue(model);
      });
      return;
    }
    untracked(() => {
      this.applyStoredValue(control.value);
    });
    const subscription = control.valueChanges.subscribe(value => {
      this.applyStoredValue(value);
    });
    onCleanup(() => {
      subscription.unsubscribe();
    });
  });

  constructor() {
    super();
    inject(DestroyRef).onDestroy(() => {
      this.overlayRef?.dispose();
    });
  }

  /** Opens the country list, or closes it when it is already open. */
  toggleCountryPanel(): void {
    if (this.panelOpen()) {
      this.closeCountryPanel(this.countryTrigger().nativeElement);
    } else {
      this.openCountryPanel();
    }
  }

  /**
   * Filters the country list and highlights its first match.
   *
   * @param value the text of the search field
   */
  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.activeIndex.set(this.filteredCountries().length > 0 ? 0 : -1);
  }

  /**
   * Moves through the list with the arrow keys and picks the highlighted country with Enter. Escape closes the list
   * and returns to the country button; it stops propagating, so a surrounding dialog stays open. Tab closes the list
   * and moves on to the number field, Shift+Tab back to the country button.
   *
   * @param event the key press in the search field
   */
  onSearchKeydown(event: KeyboardEvent): void {
    const count = this.filteredCountries().length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        if (count > 0) {
          const step = event.key === 'ArrowDown' ? 1 : -1;
          this.activeIndex.set(Math.min(count - 1, Math.max(0, this.activeIndex() + step)));
          this.scrollActiveOptionIntoView();
        }
        break;
      case 'Enter': {
        event.preventDefault();
        const option = this.filteredCountries().at(this.activeIndex());
        if (this.activeIndex() >= 0 && option !== undefined) {
          this.selectCountry(option.code);
        }
        break;
      }
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.closeCountryPanel(this.countryTrigger().nativeElement);
        break;
      case 'Tab':
        event.preventDefault();
        this.closeCountryPanel(event.shiftKey ? this.countryTrigger().nativeElement : this.numberInput().nativeElement);
        break;
    }
  }

  /**
   * Selects a country, stores the number with its dialling code and continues in the number field.
   *
   * @param countryCode the lowercase ISO code of the selected country
   */
  selectCountry(countryCode: string): void {
    this.selectedCountry.set(countryCode);
    this.storeValue();
    this.closeCountryPanel(this.numberInput().nativeElement);
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
    this.storeValue(number.startsWith('+') ? '' : undefined);
  }

  /** Marks the field as touched once the user leaves it, so validation messages appear. */
  onNumberBlur(): void {
    this.onBlur();
    this.control()?.markAsTouched();
  }

  /** Shows the country list below the country button with an empty search, the selected country highlighted. */
  private openCountryPanel(): void {
    // 1) Reset the search and highlight the selected country
    this.searchQuery.set('');
    this.activeIndex.set(this.countryOptions().findIndex(option => option.code === this.selectedCountry()));

    // 2) Create the overlay once; its transparent backdrop closes the list on a click outside
    const origin = this.countryTrigger().nativeElement;
    if (this.overlayRef === undefined) {
      const positionStrategy = createFlexibleConnectedPositionStrategy(this.injector, origin)
        .withFlexibleDimensions(false)
        .withPush(false)
        .withPositions(DROPDOWN_POSITIONS);
      this.overlayRef = createOverlayRef(this.injector, {
        positionStrategy,
        scrollStrategy: createRepositionScrollStrategy(this.injector),
        hasBackdrop: true,
        backdropClass: 'cdk-overlay-transparent-backdrop',
      });
      this.overlayRef.backdropClick().subscribe(() => {
        this.closeCountryPanel(this.countryTrigger().nativeElement);
      });
    }

    // 3) Show the list and move the focus into its search field
    this.overlayRef.attach(new TemplatePortal(this.countryPanel(), this.viewContainerRef));
    this.panelOpen.set(true);
    this.document.getElementById(this.countrySearchId())?.focus();
    this.scrollActiveOptionIntoView();
  }

  /**
   * Closes the country list and moves the focus out of it, since the focused search field disappears with it.
   *
   * @param focusTarget the element that receives the focus
   */
  private closeCountryPanel(focusTarget: HTMLElement): void {
    this.overlayRef?.detach();
    this.panelOpen.set(false);
    focusTarget.focus();
  }

  /** Scrolls the list so the highlighted country is visible. */
  private scrollActiveOptionIntoView(): void {
    const optionId = this.activeOptionId();
    if (optionId !== undefined) {
      this.document.getElementById(optionId)?.scrollIntoView({ block: 'nearest' });
    }
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

  /**
   * Writes the selected country and the typed number to the form control, or to the model without one. While the
   * user still types a dialling code, an empty value is written, so the form never keeps a number the field no
   * longer shows.
   *
   * @param override the value to write instead of the composed number
   */
  private storeValue(override?: string): void {
    const value = override ?? composePhoneNumber(this.selectedCountry(), this.nationalNumber());
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

/**
 * Prepares a text for searching: trimmed, lowercase and without accents, so "osterreich" finds "Österreich".
 *
 * @param value the text to prepare
 * @returns the prepared text
 */
function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}
