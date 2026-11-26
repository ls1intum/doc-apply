import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneInputComponent } from 'app/shared/components/atoms/phone-input/phone-input.component';
import { phoneNumberValidator } from 'app/shared/validators/custom-validators';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';

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

  function countrySelect(fixture: ReturnType<typeof createFixture>): HTMLSelectElement {
    return fixture.nativeElement.querySelector('select');
  }

  function type(fixture: ReturnType<typeof createFixture>, value: string): void {
    const input = numberInput(fixture);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhoneInputComponent],
      providers: [provideFontAwesomeTesting(), provideTranslateMock()],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should preselect Germany and store the typed number with +49', () => {
    const control = new FormControl<string | null>('');
    const fixture = createFixture(control);

    type(fixture, '17612345678');

    expect(countrySelect(fixture).value).toBe('de');
    expect(fixture.nativeElement.textContent).toContain('+49');
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

  it('should store the number with the dialling code of the country the user picks', () => {
    const control = new FormControl<string | null>('');
    const fixture = createFixture(control);
    type(fixture, '612345678');

    const select = countrySelect(fixture);
    select.value = 'fr';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(control.value).toBe('+33 612345678');
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

    expect(countrySelect(fixture).value).toBe('fr');
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

    expect(countrySelect(fixture).value).toBe(expectedCountry);
    expect(numberInput(fixture).value).toBe(expectedNumber);
    expect(control.dirty).toBe(false);
  });

  it('should keep a country that shares its dialling code when the form is rebuilt with the stored value', () => {
    const control = new FormControl<string | null>('');
    const fixture = createFixture(control);
    const select = countrySelect(fixture);
    select.value = 'ca';
    select.dispatchEvent(new Event('change'));
    type(fixture, '4165551234');

    fixture.componentRef.setInput('control', new FormControl<string | null>(control.value));
    fixture.detectChanges();

    expect(countrySelect(fixture).value).toBe('ca');
  });

  it('should show the phone number error for a stored value with other characters than digits', () => {
    const control = new FormControl<string | null>('089/123-456', [phoneNumberValidator]);
    control.markAsTouched();
    const fixture = createFixture(control);

    expect(fixture.nativeElement.querySelector('.error-text').textContent.trim()).toBe('global.input.error.phoneNumber');
  });
});
