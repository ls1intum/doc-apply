import { hasText } from 'app/shared/util/text.util';
import { TranslateService } from '@ngx-translate/core';

/**
 * Gets the current locale from TranslateService.
 * Returns 'de-DE' for German, 'en-US' otherwise.
 */
export function getLocale(translateService: TranslateService): string {
  return translateService.getCurrentLang() === 'de' ? 'de-DE' : 'en-US';
}

/**
 * Formats a date string to a localized date (e.g., "27. Dezember 2025" or "December 27, 2025").
 * @param date The ISO date string to format
 * @param locale The locale string (e.g., 'de-DE', 'en-US')
 * @returns Formatted date string, or empty string if date is undefined
 */
export function formatDate(date: string | undefined, locale: string): string {
  if (!hasText(date)) return '';
  return new Date(date).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Formats a date string to a localized time (e.g., "14:30").
 * @param date The ISO date string to format
 * @param locale The locale string (e.g., 'de-DE', 'en-US'), defaults to system locale if not provided
 * @returns Formatted time string, or empty string if date is undefined
 */
export function formatTime(date: string | undefined, locale?: string): string {
  if (!hasText(date)) return '';
  const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  return hasText(locale) ? new Date(date).toLocaleTimeString(locale, options) : new Date(date).toLocaleTimeString([], options);
}

/**
 * Formats a time range from start to end (e.g., "14:30 - 15:00").
 * @param startDate The ISO date string for start time
 * @param endDate The ISO date string for end time
 * @param locale Optional locale string
 * @returns Formatted time range string
 */
export function formatTimeRange(startDate: string | undefined, endDate: string | undefined, locale?: string): string {
  return `${formatTime(startDate, locale)} - ${formatTime(endDate, locale)}`;
}

/**
 * Formats a date string to a localized date with weekday (e.g., "Freitag, 27.12.2025" or "Friday, 12/27/2025").
 * @param date The ISO date string to format
 * @param locale The locale string (e.g., 'de-DE', 'en-US')
 * @returns Formatted date string with weekday, or empty string if date is undefined
 */
export function formatDateWithWeekday(date: string | undefined, locale: string): string {
  if (!hasText(date)) return '';
  return new Date(date).toLocaleDateString(locale, {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Converts a date to a string in the format "YYYY-MM-DD" using local time (not UTC).
 * Useful for Date input values or map keys.
 * @param date The date to convert
 * @returns The date string in "YYYY-MM-DD" format
 */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a local date string in the format "YYYY-MM-DD" into a Date object.
 * Uses local time instead of UTC to avoid timezone shifts for date-only values.
 *
 * @param value The date string to parse
 * @returns The parsed local Date, or undefined if the input is invalid
 */
export function parseLocalDateString(value: string | undefined): Date | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const parts = value.split('-');
  if (parts.length !== 3) {
    return undefined;
  }

  const [year, month, day] = parts.map(Number);
  if (!year || !month || !day) {
    return undefined;
  }

  if (year <= 1900 || month < 1 || month > 12 || day < 1 || day > 31) {
    return undefined;
  }

  const parsedDate = new Date(year, month - 1, day);
  if (parsedDate.getFullYear() !== year || parsedDate.getMonth() !== month - 1 || parsedDate.getDate() !== day) {
    return undefined;
  }

  parsedDate.setHours(0, 0, 0, 0);
  return parsedDate;
}
