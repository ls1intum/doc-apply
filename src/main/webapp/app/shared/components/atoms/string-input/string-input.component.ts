import { Component, forwardRef, input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { AutoFocusModule } from 'primeng/autofocus';

import { BaseInputDirective } from '../base-input/base-input.component';

@Component({
  selector: 'jhi-string-input',
  templateUrl: './string-input.component.html',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => StringInputComponent),
      multi: true,
    },
  ],
  imports: [AutoFocusModule, FormsModule, FontAwesomeModule, InputTextModule, ReactiveFormsModule, TooltipModule],
})
export class StringInputComponent extends BaseInputDirective<string> {
  tooltipText = input<string | undefined>(undefined);

  onInputChange(value: string): void {
    this.modelChange.emit(value);
    const ctrl = this.formControl();
    ctrl.setValue(value);
    ctrl.markAsDirty();
    ctrl.updateValueAndValidity();
  }
}
