import { Component, computed, effect, input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { AbstractControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';

import { BaseInputDirective } from '../base-input/base-input.component';

@Component({
  selector: 'jhi-number-input',
  templateUrl: './number-input.component.html',
  standalone: true,
  imports: [FormsModule, FontAwesomeModule, InputNumberModule, ReactiveFormsModule, InputNumberModule, TooltipModule],
})
export class NumberInputComponent extends BaseInputDirective<number | undefined> {
  min = input<number>(0);
  max = input<number>(100);
  minFractionDigits = input<number>(0);
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

  onInputChange(value: number): void {
    this.modelChange.emit(value);
    const ctrl = this.formControl();
    ctrl.setValue(value);
    ctrl.markAsDirty();

    ctrl.updateValueAndValidity();
    this.validateMinMax(value, ctrl);

    this.formValidityVersion.update(v => v + 1);
  }

  private validateMinMax(value: number | null | undefined, control: AbstractControl): void {
    const errors = { ...control.errors };

    delete errors.min;
    delete errors.max;

    if (value !== null && value !== undefined && value < this.min()) {
      errors.min = { min: this.min(), actual: value };
    }

    if (value !== null && value !== undefined && value > this.max()) {
      errors.max = { max: this.max(), actual: value };
    }

    control.setErrors(Object.keys(errors).length > 0 ? errors : null);
  }
}
