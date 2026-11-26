import { Component, computed, input, model } from '@angular/core';
import { CheckboxComponent } from 'app/shared/components/atoms/checkbox/checkbox.component';
import { TranslateDirective } from 'app/shared/language';

const BASE_ROW_CLASSES =
  'btn-bare flex w-full items-start gap-3 rounded-lg border p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-default';

/**
 * A bordered row that switches one option of a dialog on or off. It shows a checkbox, a bold title and a short
 * description of what the option causes. The whole row is the control, so the checkbox only mirrors its state.
 */
@Component({
  selector: 'jhi-option-row',
  imports: [CheckboxComponent, TranslateDirective],
  templateUrl: './option-row.component.html',
})
export class OptionRowComponent {
  checked = model<boolean>(false);
  titleKey = input.required<string>();
  descriptionKey = input.required<string>();

  readonly rowClass = computed(() =>
    this.checked()
      ? `${BASE_ROW_CLASSES} border-primary-default bg-primary-default/10`
      : `${BASE_ROW_CLASSES} border-border-default hover:border-border-hover hover:bg-background-surface-alt`,
  );

  /** Switches the option to the opposite state. */
  toggle(): void {
    this.checked.set(!this.checked());
  }
}
