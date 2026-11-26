import { COUNTRY_DIAL_CODES, PREFERRED_COUNTRY_FOR_DIAL_CODE } from 'app/shared/language/countries';

/**
 * A phone number split into the country whose dialling code it starts with and the number dialled after it.
 */
export interface PhoneNumberParts {
  countryCode: string;
  nationalNumber: string;
}

/** The country a phone number belongs to when it names none, since most users of the platform live in Germany. */
export const DEFAULT_PHONE_COUNTRY = 'de';

/** The longest dialling code in the country list, used to tell an incomplete code from an unknown one. */
export const LONGEST_DIAL_CODE_LENGTH = 4;

/**
 * Builds the phone number that is stored from the selected country and the number typed after it.
 *
 * @param countryCode the lowercase ISO code of the selected country
 * @param nationalNumber the number typed after the dialling code
 * @returns the number as "+49 17612345678", or an empty string when no number was typed
 */
export function composePhoneNumber(countryCode: string, nationalNumber: string): string {
  const number = nationalNumber.trim();
  if (number === '') {
    return '';
  }
  const dialCode = COUNTRY_DIAL_CODES[countryCode] ?? COUNTRY_DIAL_CODES[DEFAULT_PHONE_COUNTRY];
  return `+${dialCode} ${number}`;
}

/**
 * Splits a stored phone number into its country and the number after the dialling code. Numbers without a known
 * dialling code, such as those saved before the country selection existed, keep the default country and their text
 * unchanged, so nothing the user typed is lost or reinterpreted.
 *
 * @param value the stored phone number
 * @param preferredCountry the country to keep when it shares the dialling code with others, such as Canada for +1
 * @returns the country and the number after its dialling code
 */
export function parsePhoneNumber(value: string | undefined, preferredCountry?: string): PhoneNumberParts {
  const trimmed = value?.trim() ?? '';
  return parseInternationalNumber(trimmed, preferredCountry) ?? { countryCode: DEFAULT_PHONE_COUNTRY, nationalNumber: trimmed };
}

/**
 * Splits a phone number that starts with "+" or "00" into its country and the number after the dialling code,
 * matching the longest known dialling code. Dialling codes are prefix-free, apart from the area codes of the North
 * American Numbering Plan, so a match is final as soon as it is found.
 *
 * @param value the phone number
 * @param preferredCountry the country to keep when it shares the dialling code with others, such as Canada for +1
 * @returns the country and the number after its dialling code, or undefined when the number has no international
 *          prefix or no known dialling code follows it
 */
export function parseInternationalNumber(value: string, preferredCountry?: string): PhoneNumberParts | undefined {
  const trimmed = value.trim();
  const prefixLength = internationalPrefixLength(trimmed);
  if (prefixLength === 0) {
    return undefined;
  }

  // 1) Find the longest dialling code that the digits after the prefix start with
  const rest = trimmed.slice(prefixLength);
  const leadingDigits = rest.replace(/\D/g, '').slice(0, LONGEST_DIAL_CODE_LENGTH);
  let dialCode: string | undefined;
  for (let length = leadingDigits.length; length > 0 && dialCode === undefined; length--) {
    const candidate = leadingDigits.slice(0, length);
    if (Object.values(COUNTRY_DIAL_CODES).includes(candidate)) {
      dialCode = candidate;
    }
  }
  if (dialCode === undefined) {
    return undefined;
  }

  // 2) Pick the country, keeping the preferred one when it shares the dialling code
  const countryCode =
    preferredCountry !== undefined && COUNTRY_DIAL_CODES[preferredCountry] === dialCode
      ? preferredCountry
      : (PREFERRED_COUNTRY_FOR_DIAL_CODE[dialCode] ?? countryForDialCode(dialCode));

  // 3) Drop the dialling code digits, along with any separators between them
  let index = 0;
  let consumedDigits = 0;
  while (index < rest.length && consumedDigits < dialCode.length) {
    if (/\d/.test(rest[index])) {
      consumedDigits++;
    }
    index++;
  }
  return { countryCode, nationalNumber: rest.slice(index).trim() };
}

/**
 * Measures the international prefix a phone number starts with.
 *
 * @param value the trimmed phone number
 * @returns 1 for "+", 2 for "00", or 0 when the number has no international prefix
 */
function internationalPrefixLength(value: string): number {
  if (value.startsWith('+')) {
    return 1;
  }
  return value.startsWith('00') ? 2 : 0;
}

/**
 * Finds the first country in the country list with the given dialling code.
 *
 * @param dialCode a dialling code that exists in the list
 * @returns the lowercase ISO code of the country
 */
function countryForDialCode(dialCode: string): string {
  return Object.keys(COUNTRY_DIAL_CODES).find(code => COUNTRY_DIAL_CODES[code] === dialCode) ?? DEFAULT_PHONE_COUNTRY;
}
