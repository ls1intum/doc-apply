/** A gender note such as (m/w/d), (w/m/d), (m/f/d) or (m/w/x) that authors often type into a job title themselves. */
const GENDER_NOTE_PATTERN = /\(\s*[mwfdx]\s*\/\s*[mwfdx]\s*\/\s*[mwfdx]\s*\)/i;

/**
 * Tells whether a job title already contains a gender note, so the page does not add a second one.
 *
 * @param title the job title as the author entered it
 * @returns whether the title already names the genders it addresses
 */
export function hasGenderNote(title: string | undefined): boolean {
  return GENDER_NOTE_PATTERN.test(title ?? '');
}
