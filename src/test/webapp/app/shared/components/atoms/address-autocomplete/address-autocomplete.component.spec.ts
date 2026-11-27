import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddressSuggestionDTO } from 'app/generated/model/address-suggestion-dto';
import {
  ADDRESS_QUERY_DEBOUNCE_MS,
  AddressAutocompleteComponent,
} from 'app/shared/components/atoms/address-autocomplete/address-autocomplete.component';
import {
  AddressSuggestionResourceApiMock,
  createAddressSuggestionResourceApiMock,
  provideAddressSuggestionResourceApiMock,
} from 'util/address-suggestion-resource-api.service.mock';
import { provideTranslateMock } from 'util/translate.mock';

describe('AddressAutocompleteComponent', () => {
  const garching: AddressSuggestionDTO = {
    street: 'Boltzmannstraße',
    houseNumber: '3',
    postalCode: '85748',
    city: 'Garching bei München',
    countryCode: 'DE',
    label: 'Boltzmannstraße 3, 85748 Garching bei München, Deutschland',
  };
  const berlin: AddressSuggestionDTO = {
    street: 'Boltzmannstraße',
    postalCode: '14195',
    city: 'Berlin',
    countryCode: 'DE',
    label: 'Boltzmannstraße, 14195 Berlin, Deutschland',
  };

  let addressApi: AddressSuggestionResourceApiMock;

  function createFixture() {
    const fixture = TestBed.createComponent(AddressAutocompleteComponent);
    fixture.componentRef.setInput('label', 'Street');
    fixture.componentRef.setInput('id', 'street');
    fixture.componentRef.setInput('control', new FormControl<string | null>(''));
    fixture.detectChanges();
    return fixture;
  }

  function input(fixture: ReturnType<typeof createFixture>): HTMLInputElement {
    return fixture.nativeElement.querySelector('input');
  }

  async function typeAndWait(fixture: ReturnType<typeof createFixture>, value: string): Promise<void> {
    const field = input(fixture);
    field.dispatchEvent(new Event('focus'));
    field.value = value;
    field.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(ADDRESS_QUERY_DEBOUNCE_MS);
    fixture.detectChanges();
  }

  function press(fixture: ReturnType<typeof createFixture>, key: string): void {
    input(fixture).dispatchEvent(new KeyboardEvent('keydown', { key }));
    fixture.detectChanges();
  }

  function options(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    addressApi = createAddressSuggestionResourceApiMock();
    addressApi.getAddressSuggestions.mockReturnValue(of([garching, berlin]));
    await TestBed.configureTestingModule({
      imports: [AddressAutocompleteComponent],
      providers: [provideTranslateMock(), provideAddressSuggestionResourceApiMock(addressApi)],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should request suggestions once after the user pauses typing', async () => {
    const fixture = createFixture();
    const field = input(fixture);
    field.dispatchEvent(new Event('focus'));
    field.value = 'Boltz';
    field.dispatchEvent(new Event('input'));
    field.value = 'Boltzmannstr 3';
    field.dispatchEvent(new Event('input'));

    await vi.advanceTimersByTimeAsync(ADDRESS_QUERY_DEBOUNCE_MS - 1);
    expect(addressApi.getAddressSuggestions).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    fixture.detectChanges();
    expect(addressApi.getAddressSuggestions).toHaveBeenCalledOnce();
    expect(addressApi.getAddressSuggestions).toHaveBeenCalledWith('Boltzmannstr 3', 'en');
    expect(options().map(option => option.textContent.trim())).toEqual([garching.label, berlin.label]);
    expect(field.getAttribute('aria-expanded')).toBe('true');
  });

  it('should not request suggestions while the text is shorter than three characters', async () => {
    const fixture = createFixture();

    await typeAndWait(fixture, 'Bo ');

    expect(addressApi.getAddressSuggestions).not.toHaveBeenCalled();
    expect(options()).toHaveLength(0);
  });

  it('should emit the address the user clicks', async () => {
    const fixture = createFixture();
    const selectedSpy = vi.spyOn(fixture.componentInstance.addressSelected, 'emit');
    await typeAndWait(fixture, 'Boltzmannstr');

    options()[1].click();
    fixture.detectChanges();

    expect(selectedSpy).toHaveBeenCalledOnce();
    expect(selectedSpy).toHaveBeenCalledWith(berlin);
    expect(options()).toHaveLength(0);
  });

  it('should emit the address highlighted with the arrow keys when Enter is pressed', async () => {
    const fixture = createFixture();
    const selectedSpy = vi.spyOn(fixture.componentInstance.addressSelected, 'emit');
    await typeAndWait(fixture, 'Boltzmannstr');

    press(fixture, 'ArrowDown');
    press(fixture, 'ArrowDown');
    press(fixture, 'ArrowUp');
    expect(input(fixture).getAttribute('aria-activedescendant')).toBe(options()[0].id);
    press(fixture, 'Enter');

    expect(selectedSpy).toHaveBeenCalledOnce();
    expect(selectedSpy).toHaveBeenCalledWith(garching);
  });

  it('should close the suggestions on Escape without picking one', async () => {
    const fixture = createFixture();
    const selectedSpy = vi.spyOn(fixture.componentInstance.addressSelected, 'emit');
    await typeAndWait(fixture, 'Boltzmannstr');

    press(fixture, 'Escape');

    expect(options()).toHaveLength(0);
    expect(input(fixture).getAttribute('aria-expanded')).toBe('false');
    expect(selectedSpy).not.toHaveBeenCalled();
  });

  it('should tell the user that nothing matched when the lookup fails', async () => {
    addressApi.getAddressSuggestions.mockReturnValue(throwError(() => new Error('Too many requests')));
    const fixture = createFixture();

    await typeAndWait(fixture, 'Boltzmannstr');

    expect(options().map(option => option.textContent.trim())).toEqual(['global.input.address.noSuggestions']);
  });
});
