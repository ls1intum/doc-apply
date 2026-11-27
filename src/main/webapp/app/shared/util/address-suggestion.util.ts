import { FormGroup } from '@angular/forms';
import { AddressSuggestionDTO } from 'app/generated/model/address-suggestion-dto';
import { SelectOption } from 'app/shared/components/atoms/select/select.component';
import { selectCountries } from 'app/shared/language/countries';
import { hasText } from 'app/shared/util/text.util';

/**
 * The names of the form controls an address suggestion fills.
 */
export interface AddressControlNames {
  street: string;
  postalCode: string;
  city: string;
}

/**
 * Fills the street, postal code and city controls of a form from a picked address suggestion. The street control
 * receives the street and house number in one line, as the forms store them. Values the suggestion does not have
 * leave their control unchanged, and every filled control is marked dirty and touched, so validation and autosave
 * react as if the user had typed the value.
 *
 * @param form the form holding the address controls
 * @param controlNames the names of the street, postal code and city controls in the form
 * @param suggestion the picked address
 */
export function applyAddressSuggestion(form: FormGroup, controlNames: AddressControlNames, suggestion: AddressSuggestionDTO): void {
  // 1) Collect the values the suggestion has
  const streetLine = [suggestion.street, suggestion.houseNumber].filter(hasText).join(' ');
  const patch: Record<string, string> = {};
  if (hasText(streetLine)) {
    patch[controlNames.street] = streetLine;
  }
  if (hasText(suggestion.postalCode)) {
    patch[controlNames.postalCode] = suggestion.postalCode;
  }
  if (hasText(suggestion.city)) {
    patch[controlNames.city] = suggestion.city;
  }

  // 2) Write them in one change and mark the filled controls as edited by the user
  form.patchValue(patch);
  Object.keys(patch).forEach(name => {
    const control = form.get(name);
    control?.markAsDirty();
    control?.markAsTouched();
  });
}

/**
 * Finds the country option of an address suggestion in the country list.
 *
 * @param suggestion the picked address
 * @returns the matching country option, or undefined when the suggestion has no country or one the list lacks
 */
export function countryOptionOf(suggestion: AddressSuggestionDTO): SelectOption | undefined {
  const countryCode = suggestion.countryCode?.toLowerCase();
  return countryCode === undefined ? undefined : selectCountries.find(country => country.value === countryCode);
}
