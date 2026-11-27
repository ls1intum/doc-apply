import { AbstractControl } from '@angular/forms';
import { ReactiveTranslator } from 'app/shared/util/translate-signal.util';

/**
 * Maps the path of a form control, as `AbstractControl.get` takes it, to the translation key of the label the form shows
 * for that control. Callers list the entries in the order the form shows its fields, so the reason names them in that order.
 */
export type FieldLabels = Record<string, string>;

/**
 * A translation key together with the parameters it is translated with.
 */
export interface TranslatableMessage {
  key: string;
  params: Record<string, unknown>;
}

const MAX_NAMED_MISSING_FIELDS = 3;

/**
 * Finds the labelled controls of a form that are invalid, for example because a required value is missing.
 * Disabled controls never count as invalid.
 *
 * @param form the form group whose controls are checked
 * @param labels the label translation key of each control that should be named
 * @returns the label translation keys of the invalid controls, in the order of `labels`, without duplicates
 */
export function findMissingFields(form: AbstractControl, labels: FieldLabels): string[] {
  const missing: string[] = [];
  for (const [path, labelKey] of Object.entries(labels)) {
    if (form.get(path)?.invalid === true && !missing.includes(labelKey)) {
      missing.push(labelKey);
    }
  }
  return missing;
}

/**
 * Builds the disabled reason of a button that waits for missing fields. It names up to three fields and counts the rest,
 * and falls back to the generic hint about fields marked with `*` when no field is known. Call it inside a `computed()`:
 * the translator reads the language, so the field names follow a language change.
 *
 * @param labelKeys the label translation keys of the missing fields, in the order the form shows them
 * @param translator the reactive translator that translates the field names
 * @returns the translation key of the reason and the parameters to pass as `disabledReasonParams`
 */
export function describeMissingFields(labelKeys: string[], translator: ReactiveTranslator): TranslatableMessage {
  if (labelKeys.length === 0) {
    return { key: 'global.input.completeRequiredFields', params: {} };
  }
  const fields = labelKeys
    .slice(0, MAX_NAMED_MISSING_FIELDS)
    .map(labelKey => translator.translate(labelKey) ?? labelKey)
    .join(', ');
  const remaining = labelKeys.length - MAX_NAMED_MISSING_FIELDS;
  if (remaining > 0) {
    return { key: 'global.input.missingFieldsAndMore', params: { fields, count: remaining } };
  }
  return { key: 'global.input.missingFields', params: { fields, count: labelKeys.length } };
}
