import { Component, ElementRef, afterNextRender, forwardRef, input, viewChild } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { TumAetUiInputDirective, TumAetUiTooltipDirective } from '@tumaet/ui-angular';

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
  imports: [FormsModule, FontAwesomeModule, ReactiveFormsModule, TumAetUiInputDirective, TumAetUiTooltipDirective],
})
export class StringInputComponent extends BaseInputDirective<string> {
  tooltipText = input<string | undefined>(undefined);

  private readonly inputElement = viewChild<ElementRef<HTMLInputElement>>('inputElement');

  constructor() {
    super();
    afterNextRender(() => {
      if (this.autofocus()) {
        this.inputElement()?.nativeElement.focus();
      }
    });
  }

  onInputChange(value: string): void {
    this.modelChange.emit(value);
    const ctrl = this.formControl();
    ctrl.setValue(value);
    ctrl.markAsDirty();
    ctrl.updateValueAndValidity();
  }
}
