import { Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { TumAetUiInputDirective } from '@tumaet/ui-angular';
import { startWith, switchMap } from 'rxjs';

import { BaseInputDirective } from '../base-input/base-input.component';

/**
 * A labelled field for plain multi-line text. When it has a maximum length, it stops the input there and counts the
 * characters below the field.
 */
@Component({
  selector: 'jhi-text-area',
  templateUrl: './text-area.component.html',
  standalone: true,
  imports: [ReactiveFormsModule, TumAetUiInputDirective],
})
export class TextAreaComponent extends BaseInputDirective<string> {
  /** The most characters the field accepts. */
  maxLength = input<number | undefined>(undefined);

  readonly characterCount = computed(() => {
    const value = this.value();
    return typeof value === 'string' ? value.length : 0;
  });

  private readonly value = toSignal(
    toObservable(this.formControl).pipe(switchMap(control => control.valueChanges.pipe(startWith(control.value)))),
    { initialValue: '' },
  );
}
