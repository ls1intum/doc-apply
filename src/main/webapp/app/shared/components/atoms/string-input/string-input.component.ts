import { Component, ElementRef, afterNextRender, computed, forwardRef, input, viewChild } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { TumAetUiInputDirective, TumAetUiTooltipDirective } from '@tumaet/ui-angular';
import TranslateDirective from 'app/shared/language/translate.directive';

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
  imports: [FontAwesomeModule, ReactiveFormsModule, TumAetUiInputDirective, TumAetUiTooltipDirective, TranslateDirective],
})
export class StringInputComponent extends BaseInputDirective<string> {
  tooltipText = input<string | undefined>(undefined);
  /** Translation key of a short text shown right after the field, such as a unit or a fixed addition to the value. */
  suffix = input<string | undefined>(undefined);
  /** Translation key of a tooltip that explains the suffix, shown on an info icon next to it. */
  suffixTooltip = input<string | undefined>(undefined);

  readonly displaySuffixTooltip = computed(() => this.maybeTranslate(this.suffixTooltip()));

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
