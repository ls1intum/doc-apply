import { Component, computed, effect, input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { AbstractControl, FormsModule, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { TumAetUiInputNumberComponent, TumAetUiTooltipDirective } from '@tumaet/ui-angular';

import { BaseInputDirective } from '../base-input/base-input.component';

const FILL_HOST_CLASSES = '[&_input]:w-full [&_input]:min-w-0';
const INHERIT_HOST_TEXT_CLASSES = '[&_input]:h-full [&_input]:[font-size:inherit] [&_input]:[text-align:inherit]';

@Component({
  selector: 'jhi-number-input',
  templateUrl: './number-input.component.html',
  standalone: true,
  imports: [FormsModule, FontAwesomeModule, ReactiveFormsModule, TumAetUiInputNumberComponent, TumAetUiTooltipDirective],
})
export class NumberInputComponent extends BaseInputDirective<number | undefined> {
  min = input<number>(0);
  max = input<number>(100);
  maxFractionDigits = input<number>(3);
  inputStyleClass = input<string>('');

  smallerThanMin = computed<boolean>(() => {
    const model = this.model();
    return model !== undefined && model < this.min();
  });

  largerThanMax = computed<boolean>(() => {
    const model = this.model();
    return model !== undefined && model > this.max();
  });

  /**
   * The kit renders the native input inside its own host element, so caller classes such as a fixed height,
   * font size or text alignment are set on the host and handed down to the input.
   */
  protected readonly hostClass = computed<string>(() => {
    const custom = this.inputStyleClass();
    return custom === '' ? FILL_HOST_CLASSES : `${FILL_HOST_CLASSES} ${INHERIT_HOST_TEXT_CLASSES} ${custom}`;
  });

  private readonly updateValidatorsEffect = effect(() => {
    this.min();
    this.max();
    const ctrl = this.formControl();

    // Revalidate when min/max changes
    if (ctrl.value !== null && ctrl.value !== undefined) {
      this.validateMinMax(ctrl.value, ctrl);
      ctrl.updateValueAndValidity();
    }
  });

  onInputChange(value: number | undefined): void {
    this.modelChange.emit(value);
    const ctrl = this.formControl();
    ctrl.setValue(value);
    ctrl.markAsDirty();

    ctrl.updateValueAndValidity();
    this.validateMinMax(value, ctrl);

    this.formValidityVersion.update(v => v + 1);
  }

  private validateMinMax(value: number | null | undefined, control: AbstractControl): void {
    const errors: ValidationErrors = {};
    const current = control.errors ?? {};
    for (const key of Object.keys(current)) {
      if (key !== 'min' && key !== 'max') {
        errors[key] = current[key];
      }
    }

    if (value !== null && value !== undefined && value < this.min()) {
      errors.min = { min: this.min(), actual: value };
    }

    if (value !== null && value !== undefined && value > this.max()) {
      errors.max = { max: this.max(), actual: value };
    }

    control.setErrors(Object.keys(errors).length > 0 ? errors : null);
  }
}
