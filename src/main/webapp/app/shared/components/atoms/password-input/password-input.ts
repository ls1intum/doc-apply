import { Component, computed, forwardRef, input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { Password } from 'primeng/password';

import { BaseInputDirective } from '../base-input/base-input.component';

@Component({
  selector: 'jhi-password-input',
  imports: [FormsModule, FontAwesomeModule, InputTextModule, ReactiveFormsModule, TooltipModule, Password],
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

  promptLabel = computed(() => {
    this.langChange();
    return this.translate.instant('auth.common.password.prompt');
  });
  weakLabel = computed(() => {
    this.langChange();
    return this.translate.instant('auth.common.password.weakLabel');
  });
  mediumLabel = computed(() => {
    this.langChange();
    return this.translate.instant('auth.common.password.mediumLabel');
  });
  strongLabel = computed(() => {
    this.langChange();
    return this.translate.instant('auth.common.password.strongLabel');
  });

  onInputChange(value: string): void {
    this.modelChange.emit(value);
    const ctrl = this.formControl();
    ctrl.setValue(value);
    ctrl.markAsDirty();
    ctrl.updateValueAndValidity();
  }
}
