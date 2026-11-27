import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneInputComponent } from 'app/shared/components/atoms/phone-input/phone-input.component';
import { phoneNumberValidator } from 'app/shared/validators/custom-validators';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';

const COUNTRY_NAMES: Record<string, string> = { 'countries.fr': 'France', 'countries.de': 'Germany', 'countries.at': 'Österreich' };

describe('PhoneInputComponent', () => {
  function createFixture(control: FormControl<string | null>) {
    const fixture = TestBed.createComponent(PhoneInputComponent);
    fixture.componentRef.setInput('label', 'Phone');
    fixture.componentRef.setInput('id', 'phone');
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();
    return fixture;
  }

  function numberInput(fixture: ReturnType<typeof createFixture>): HTMLInputElement {
    return fixture.nativeElement.querySelector('input');
  }

  function countryTrigger(fixture: ReturnType<typeof createFixture>): HTMLButtonElement {
    return fixture.nativeElement.querySelector('#phone-country');
  }

  function searchInput(): HTMLInputElement | undefined {
    return document.querySelector<HTMLInputElement>('#phone-country-search') ?? undefined;
  }

  function options(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('#phone-country-list [role="option"]'));
  }

  function openList(fixture: ReturnType<typeof createFixture>): void {
    countryTrigger(fixture).click();
    fixture.detectChanges();
  }

  function search(fixture: ReturnType<typeof createFixture>, query: string): void {
    const input = searchInput();
    if (input === undefined) {
      throw new Error('The country list is not open');
    }
    input.value = query;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function pressKey(fixture: ReturnType<typeof createFixture>, key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    searchInput()?.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  function pickCountry(fixture: ReturnType<typeof createFixture>, code: string): void {
    openList(fixture);
    document.getElementById(`phone-country-list-${code}`)?.click();
    fixture.detectChanges();
  }

  function selectedCountryName(fixture: ReturnType<typeof createFixture>): string {
    const label = countryTrigger(fixture).getAttribute('aria-label') ?? '';
    const params: { country: string } = JSON.parse(label.slice(label.indexOf('{')));
    return params.country;
  }

  function type(fixture: ReturnType<typeof createFixture>, value: string): void {
    const input = numberInput(fixture);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    Element.prototype.scrollIntoView = vi.fn();
    await TestBed.configureTestingModule({
      imports: [PhoneInputComponent],
      providers: [provideFontAwesomeTesting(), provideTranslateMock()],
    }).compileComponents();
    vi.spyOn(TestBed.inject(TranslateService), 'instant').mockImplementation((key: string | string[], params?: object) => {
      const text = COUNTRY_NAMES[String(key)] ?? String(key);
      return params !== undefined && Object.keys(params).length > 0 ? `${text} ${JSON.stringify(params)}` : text;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should preselect Germany and store the typed number with +49', () => {
    const control = new FormControl<string | null>('');
    const fixture = createFixture(control);

    type(fixture, '17612345678');

    expect(selectedCountryName(fixture)).toBe('Germany');
    expect(countryTrigger(fixture).textContent).toContain('+49');
    expect(control.value).toBe('+49 17612345678');
    expect(control.dirty).toBe(true);
  });

  it('should drop every character that is not a digit', () => {
    const control = new FormControl<string | null>('');
    const fixture = createFixture(control);

    type(fixture, '0176-123 45/678a');

    expect(numberInput(fixture).value).toBe('017612345678');
    expect(control.value).toBe('+49 017612345678');
  });

  it('should open the country list with the search focused and the selected country marked', () => {
    const fixture = createFixture(new FormControl<string | null>(''));

    openList(fixture);

    expect(countryTrigger(fixture).getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(searchInput());
    const selected = options().filter(option => option.getAttribute('aria-selected') === 'true');
    expect(selected.map(option => option.id)).toEqual(['phone-country-list-de']);
    expect(searchInput()?.getAttribute('aria-activedescendant')).toBe('phone-country-list-de');
  });

  it.each([
    ['the country name', 'france', 'fr'],
    ['the country name without accents', 'osterreich', 'at'],
    ['the dialling code with +', '+33', 'fr'],
    ['the dialling code without +', '33', 'fr'],
  ])('should filter the country list by %s', (_, query, expectedCountry) => {
    const fixture = createFixture(new FormControl<string | null>(''));
    openList(fixture);

    search(fixture, query);

    expect(options().map(option => option.id)).toEqual([`phone-country-list-${expectedCountry}`]);
  });

  it('should show that no country matches the search', () => {
    const fixture = createFixture(new FormControl<string | null>(''));
    openList(fixture);

    search(fixture, 'zzz');

    expect(options()).toHaveLength(1);
    expect(options()[0].getAttribute('aria-disabled')).toBe('true');
    expect(options()[0].textContent?.trim()).toBe('global.input.phone.noCountry');
  });

  it('should store the number with the dialling code of the country the user picks and continue in the number field', () => {
    const control = new FormControl<string | null>('');
    const fixture = createFixture(control);
    type(fixture, '612345678');

    pickCountry(fixture, 'fr');

    expect(control.value).toBe('+33 612345678');
    expect(control.dirty).toBe(true);
    expect(numberInput(fixture).value).toBe('612345678');
    expect(searchInput()).toBeUndefined();
    expect(document.activeElement).toBe(numberInput(fixture));
  });

  it.each([
    [['ArrowDown'], 'de', '+49 612345678'],
    [['ArrowUp'], 'fr', '+33 612345678'],
    [['ArrowDown', 'ArrowDown', 'ArrowUp'], 'fr', '+33 612345678'],
    [['ArrowDown', 'ArrowDown'], 'de', '+49 612345678'],
  ])('should move through the matches with %j and pick the highlighted country %s with Enter', (keys, expectedCountry, expectedValue) => {
    const control = new FormControl<string | null>('');
    const fixture = createFixture(control);
    type(fixture, '612345678');
    openList(fixture);
    search(fixture, 'an');

    keys.forEach(key => pressKey(fixture, key));

    expect(searchInput()?.getAttribute('aria-activedescendant')).toBe(`phone-country-list-${expectedCountry}`);
    pressKey(fixture, 'Enter');
    expect(control.value).toBe(expectedValue);
    expect(searchInput()).toBeUndefined();
  });

  it.each([
    ['Escape', 'country button'],
    ['Tab', 'number field'],
  ])('should close the country list with %s and focus the %s', (key, focusTarget) => {
    const control = new FormControl<string | null>('+49 176');
    const fixture = createFixture(control);
    openList(fixture);
    const documentListener = vi.fn();
    document.addEventListener('keydown', documentListener);

    pressKey(fixture, key);
    document.removeEventListener('keydown', documentListener);

    expect(searchInput()).toBeUndefined();
    expect(countryTrigger(fixture).getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(focusTarget === 'country button' ? countryTrigger(fixture) : numberInput(fixture));
    expect(control.value).toBe('+49 176');
    if (key === 'Escape') {
      expect(documentListener).not.toHaveBeenCalled();
    }
  });

  it.each([
    ['cleared', ''],
    ['replaced by an incomplete dialling code', '+3'],
  ])('should store an empty value instead of the old number when the number is %s', (_, typed) => {
    const control = new FormControl<string | null>('+49 176');
    const fixture = createFixture(control);

    type(fixture, typed);

    expect(control.value).toBe('');
  });

  it('should select the country of a pasted international number', () => {
    const control = new FormControl<string | null>('');
    const fixture = createFixture(control);

    type(fixture, '+33 1 23 45 67 89');

    expect(selectedCountryName(fixture)).toBe('France');
    expect(numberInput(fixture).value).toBe('123456789');
    expect(control.value).toBe('+33 123456789');
  });

  it.each([
    ['+44 2071234567', 'gb', '2071234567'],
    ['0041 441234567', 'ch', '441234567'],
    ['+1 2125551234', 'us', '2125551234'],
    ['+1 268 4641234', 'ag', '4641234'],
    ['+7 4951234567', 'ru', '4951234567'],
    ['0176 12345678', 'de', '0176 12345678'],
  ])('should show the stored number %s as country %s and number %s', (stored, expectedCountry, expectedNumber) => {
    const control = new FormControl<string | null>(stored);
    const fixture = createFixture(control);

    expect(selectedCountryName(fixture)).toBe(COUNTRY_NAMES[`countries.${expectedCountry}`] ?? `countries.${expectedCountry}`);
    expect(numberInput(fixture).value).toBe(expectedNumber);
    expect(control.dirty).toBe(false);
  });

  it('should keep a country that shares its dialling code when the form is rebuilt with the stored value', () => {
    const control = new FormControl<string | null>('');
    const fixture = createFixture(control);
    pickCountry(fixture, 'ca');
    type(fixture, '4165551234');

    fixture.componentRef.setInput('control', new FormControl<string | null>(control.value));
    fixture.detectChanges();

    expect(selectedCountryName(fixture)).toBe('countries.ca');
  });

  it('should show the phone number error for a stored value with other characters than digits', () => {
    const control = new FormControl<string | null>('089/123-456', [phoneNumberValidator]);
    control.markAsTouched();
    const fixture = createFixture(control);

    expect(fixture.nativeElement.querySelector('.error-text').textContent.trim()).toBe('global.input.error.phoneNumber');
  });
});
