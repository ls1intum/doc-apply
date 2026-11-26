import { EmailTemplateTranslationDTO } from 'app/generated/model/email-template-translation-dto';

/**
 * Tells whether a language of a template has neither a subject nor any text in its body.
 *
 * @param translation the subject and body of one language
 * @returns whether both are empty
 */
export function isEmptyTranslation(translation: EmailTemplateTranslationDTO): boolean {
  return (translation.subject ?? '').trim() === '' && !hasBodyText(translation.body);
}

/**
 * Tells whether a language of a template has both a subject and text in its body. The server sends the other language
 * instead of an incomplete one, so only a complete language reaches recipients as written.
 *
 * @param translation the subject and body of one language
 * @returns whether both are filled in
 */
export function isCompleteTranslation(translation: EmailTemplateTranslationDTO): boolean {
  return (translation.subject ?? '').trim() !== '' && hasBodyText(translation.body);
}

/**
 * Tells whether editor HTML shows any text, so an untouched editor's empty paragraph counts as empty.
 *
 * @param html the editor HTML
 * @returns whether there is visible text or a variable
 */
function hasBodyText(html: string | undefined): boolean {
  const parsed = new DOMParser().parseFromString(html ?? '', 'text/html');
  return parsed.body.textContent.trim() !== '' || (parsed.body.querySelector('.mention') ?? undefined) !== undefined;
}
