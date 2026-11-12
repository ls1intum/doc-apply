import { Component, forwardRef, input } from '@angular/core';
import { NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TumAetUiCheckboxChangeEvent, TumAetUiCheckboxComponent, TumAetUiTooltipDirective } from '@tumaet/ui-angular';
import TranslateDirective from 'app/shared/language/translate.directive';

import { BaseInputDirective } from '../base-input/base-input.component';

@Component({
  selector: 'jhi-checkbox',
  templateUrl: './checkbox.component.html',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxComponent),
      multi: true,
    },
  ],
  imports: [ReactiveFormsModule, TumAetUiCheckboxComponent, TumAetUiTooltipDirective, TranslateDirective, FontAwesomeModule],
})
export class CheckboxComponent extends BaseInputDirective<boolean> {
  /** Set to -1 where the box only shows state and something around it takes the focus. */
  tabIndex = input<number>(0);

  /**
   * Writes a toggle made on the box into the bound form control and tells the parent.
   *
   * @param event the change reported by the kit checkbox
   */
  onCheckboxChange(event: TumAetUiCheckboxChangeEvent): void {
    const value = event.checked;
    this.modelChange.emit(value);
    const ctrl = this.formControl();
    ctrl.setValue(value);
    ctrl.markAsDirty();
    ctrl.updateValueAndValidity();
  }
}
