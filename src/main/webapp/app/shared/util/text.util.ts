/**
 * Checks whether an optional string carries any content.
 * Narrows the value to a string, so callers can use it directly afterwards.
 *
 * @param value - The string to check
 * @returns True when the value is present and not empty
 */
export function hasText(value: string | undefined): value is string {
  return value !== undefined && value !== '';
}

/**
 * Extracts plain text from an HTML string.
 * Removes any tags and trims whitespace. The HTML is parsed into a separate document, which neither runs event
 * handlers nor loads images, so untrusted markup such as `<img onerror>` cannot execute while its text is read.
 *
 * @param htmlText - The HTML string to extract text from
 * @returns The plain text content, or an empty string if none found
 */
export function extractTextFromHtml(htmlText: string): string {
  return new DOMParser().parseFromString(htmlText, 'text/html').body.textContent.trim();
}
