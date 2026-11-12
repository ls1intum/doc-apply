import { Component, computed, forwardRef, input, linkedSignal, signal } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { TumAetUiInputDirective, TumAetUiTooltipDirective } from '@tumaet/ui-angular';
import { TranslateDirective } from 'app/shared/language';

import { BaseInputDirective } from '../base-input/base-input.component';

type PasswordStrength = 'none' | 'weak' | 'medium' | 'strong';

const MEDIUM_PASSWORD = /^(((?=.*[a-z])(?=.*[A-Z]))|((?=.*[a-z])(?=.*[0-9]))|((?=.*[A-Z])(?=.*[0-9])))(?=.{6,})/;
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.{8,})/;

const STRENGTH_LABEL_KEYS: Record<PasswordStrength, string> = {
  none: 'auth.common.password.prompt',
  weak: 'auth.common.password.weakLabel',
  medium: 'auth.common.password.mediumLabel',
  strong: 'auth.common.password.strongLabel',
};

const STRENGTH_BAR_CLASSES: Record<PasswordStrength, string> = {
  none: 'w-0',
  weak: 'w-1/3 bg-negative-default',
  medium: 'w-2/3 bg-warning-default',
  strong: 'w-full bg-positive-default',
};

@Component({
  selector: 'jhi-password-input',
  imports: [FormsModule, FontAwesomeModule, ReactiveFormsModule, TranslateDirective, TumAetUiInputDirective, TumAetUiTooltipDirective],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PasswordInputComponent),
      multi: true,
    },
  ],
  templateUrl: './password-input.html',
  standalone: true,
})
export class PasswordInputComponent extends BaseInputDirective<string> {
  tooltipText = input<string | undefined>(undefined);
  showStrength = input<boolean>(false);

  readonly passwordVisible = signal(false);

  protected readonly inputType = computed(() => (this.passwordVisible() ? 'text' : 'password'));
  protected readonly toggleIcon = computed(() => (this.passwordVisible() ? 'eye-slash' : 'eye'));
  protected readonly toggleLabel = computed(() => {
    this.langChange();
    return this.translate.instant(this.passwordVisible() ? 'auth.common.password.hide' : 'auth.common.password.show');
  });

  protected readonly strength = computed<PasswordStrength>(() => {
    const value = this.currentValue();
    if (value === '') {
      return 'none';
    }
    if (STRONG_PASSWORD.test(value)) {
      return 'strong';
    }
    return MEDIUM_PASSWORD.test(value) ? 'medium' : 'weak';
  });

  protected readonly strengthLabelKey = computed(() => STRENGTH_LABEL_KEYS[this.strength()]);
  protected readonly strengthBarClass = computed(() => STRENGTH_BAR_CLASSES[this.strength()]);

  private readonly currentValue = linkedSignal(() => this.model() ?? '');

  /**
   * Switches the field between masked and plain text.
   */
  togglePasswordVisibility(): void {
    this.passwordVisible.update(visible => !visible);
  }

  onInputChange(value: string): void {
    this.currentValue.set(value);
    this.modelChange.emit(value);
    const ctrl = this.formControl();
    ctrl.setValue(value);
    ctrl.markAsDirty();
    ctrl.updateValueAndValidity();
  }
}
