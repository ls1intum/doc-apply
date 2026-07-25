import { hasText } from 'app/shared/util/text.util';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { parseLocalDateString } from 'app/shared/util/date-time.util';

export const INVALID_DATE_ORDER_ERROR = 'invalidDateOrder';

/**
 * Validates that the end field is on or after the start field when both values are present.
 * The validator expects ISO date strings in the form `YYYY-MM-DD`.
 */
export function dateOrderValidator(startFieldName: string, endFieldName: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const startDate = control.get(startFieldName)?.value as string | undefined;
    const endDate = control.get(endFieldName)?.value as string | undefined;

    if (!hasText(startDate) || !hasText(endDate)) {
      return null;
    }

    const parsedStartDate = parseLocalDateString(startDate);
    const parsedEndDate = parseLocalDateString(endDate);

    if (!parsedStartDate || !parsedEndDate) {
      return null;
    }

    return parsedEndDate.getTime() >= parsedStartDate.getTime() ? null : { [INVALID_DATE_ORDER_ERROR]: true };
  };
}
