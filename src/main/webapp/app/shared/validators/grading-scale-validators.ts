import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { GradeType, getGradeType, isNumericInRange, setControlError } from 'app/shared/util/grading-scale.utils';

/**
 * Validator for a single grading scale limit (upper or lower).
 *
 * Ensures that the limit has the same format/type as the current grade
 * (e.g. numeric vs. letter-based grading).
 */
export function gradingScaleTypeValidator(getCurrentGrade: () => string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const untrimmedLimit: unknown = control.value;
    const untrimmedFirstGrade = getCurrentGrade();

    if (typeof untrimmedLimit !== 'string' || untrimmedLimit === '' || untrimmedFirstGrade === '') {
      return null;
    }

    const limit = untrimmedLimit.trim();
    const grade = untrimmedFirstGrade.trim();

    const gradeType = getGradeType(grade);
    const limitType = getGradeType(limit);

    return validateGradeTypesMatch(gradeType, limitType);
  };
}

function validateGradeTypesMatch(gradeType: GradeType, limitType: GradeType): ValidationErrors | null {
  if (gradeType === 'numeric' || gradeType === 'numericFraction') {
    return limitType === 'numeric' ? null : { invalidLimitType: true };
  }

  if (gradeType === 'percentage' && (limitType === 'percentage' || limitType === 'numeric')) {
    return null;
  }

  if (gradeType === 'letter') {
    return limitType === 'letter' ? null : { invalidLimitType: true };
  }

  return null;
}

/**
 * Cross-field validator for grading scale limits.
 *
 * Validates that the current grade lies within the range defined by
 * upperLimit and lowerLimit.
 */
export function gradingScaleRangeValidator(getCurrentGrade: () => string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const upperCtrl = group.get('upperLimit');
    const lowerCtrl = group.get('lowerLimit');

    if (!upperCtrl || !lowerCtrl) {
      return null;
    }

    if (upperCtrl.hasError('invalidLimitType') || lowerCtrl.hasError('invalidLimitType')) {
      clearRangeErrors(upperCtrl, lowerCtrl);
      return null;
    }

    const untrimmedUpper: unknown = upperCtrl.value;
    const untrimmedLower: unknown = lowerCtrl.value;
    const untrimmedGrade = getCurrentGrade();

    if (
      typeof untrimmedUpper !== 'string' ||
      untrimmedUpper === '' ||
      typeof untrimmedLower !== 'string' ||
      untrimmedLower === '' ||
      untrimmedGrade === ''
    ) {
      clearRangeErrors(upperCtrl, lowerCtrl);
      return null;
    }

    const upper = untrimmedUpper.trim();
    const lower = untrimmedLower.trim();
    const grade = untrimmedGrade.trim();

    const type = getGradeType(grade);
    const inRange = checkGradeInRange(type, grade, upper, lower);

    if (!inRange) {
      setRangeErrors(upperCtrl, lowerCtrl);
      return { outOfRange: true };
    }

    clearRangeErrors(upperCtrl, lowerCtrl);
    return null;
  };
}

function clearRangeErrors(upperCtrl: AbstractControl, lowerCtrl: AbstractControl): void {
  setControlError(upperCtrl, 'outOfRange', false);
  setControlError(lowerCtrl, 'outOfRange', false);
}

function setRangeErrors(upperCtrl: AbstractControl, lowerCtrl: AbstractControl): void {
  setControlError(upperCtrl, 'outOfRange', true);
  setControlError(lowerCtrl, 'outOfRange', true);
}

function checkGradeInRange(type: GradeType, grade: string, upper: string, lower: string): boolean {
  // Don't check range for letter grades in the validator to allow different metricts like S - F. Check range in conversion as it can't be correctly converted
  if (type === 'letter') {
    return true;
  }
  if (type === 'numeric' || type === 'numericFraction' || type === 'percentage') {
    return isNumericInRange(grade, upper, lower);
  }
  return false;
}
