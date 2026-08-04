import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RadioButtonModule } from 'primeng/radiobutton';
import TranslateDirective from 'app/shared/language/translate.directive';

import { SelectOption } from '../select/select.component';

/** One question of the grid; {@code key} identifies the row in {@code selected} and change events. */
export interface RatingGridRow {
  key: string;
  labelKey: string;
}

/** Payload emitted when an option is picked for a row. */
export interface RatingGridSelection {
  key: string;
  option: SelectOption;
}

/**
 * Matrix of radio buttons for answering several questions that share the same option scale, so a
 * choice takes one click instead of opening a dropdown per question. Renders one row per question
 * and one column per option on large screens; below that, each question collapses to a stacked
 * radio list with the option labels inline. Parent owns the selected values, the grid just emits
 * changes.
 */
@Component({
  selector: 'jhi-rating-grid',
  standalone: true,
  imports: [FormsModule, RadioButtonModule, TranslateDirective],
  templateUrl: './rating-grid.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RatingGridComponent {
  /** Prefix for the radio input ids and group names; override when a page shows several grids. */
  id = input<string>('rating-grid');

  /** The questions, one per grid row. */
  rows = input<RatingGridRow[]>([]);

  /** The option scale shared by every row; rendered as the grid columns. */
  options = input<SelectOption[]>([]);

  /** Selected option per row key. Parent controls this (one-way in); extra keys are ignored. */
  selected = input<Record<string, SelectOption | undefined>>({});

  /** Shows a required marker next to every row label. */
  required = input<boolean>(false);

  /** If true, row labels and option names are treated as translation keys. */
  shouldTranslate = input<boolean>(true);

  /** Emits the row key and the option the user picked. */
  selectedChange = output<RatingGridSelection>();

  /** Column template shared by the header and the rows: a wide label column, then one equal column per option. */
  protected readonly gridTemplateColumns = computed(() => `minmax(11rem, 2.2fr) repeat(${this.options().length}, minmax(0, 1fr))`);

  /**
   * Resolves the picked radio value back to its option and emits the change for the row.
   *
   * @param key   the row key the change belongs to
   * @param value the option value picked in the row's radio group
   */
  protected onValuePicked(key: string, value: string | number): void {
    const option = this.options().find(item => item.value === value);
    if (option) {
      this.selectedChange.emit({ key, option });
    }
  }
}
