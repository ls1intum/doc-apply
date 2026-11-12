import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { SelectModule } from 'primeng/select';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TooltipModule } from 'primeng/tooltip';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

import { TranslateDirective } from '../../../language';

export type SelectOption = {
  name: string;
  value: string | number;
  icon?: string;
};
export type size = 'small' | 'large' | undefined;

@Component({
  selector: 'jhi-select',
  standalone: true,
  templateUrl: './select.component.html',
  styleUrls: ['./select.component.scss'],
  imports: [SelectModule, FontAwesomeModule, FormsModule, CommonModule, TooltipModule, TranslateDirective],
  encapsulation: ViewEncapsulation.None,
})
export class SelectComponent {
  id = input<string | undefined>(undefined);
  items = input<SelectOption[]>([]);
  selected = input<SelectOption | undefined>(undefined);
  label = input<string>('');
  required = input<boolean>(false);
  placeholder = input<string>('');
  disabled = input<boolean>(false);
  labelField = input<string>('name');
  valueField = input<string>('value');
  iconField = input<string | undefined>(undefined); // For displaying custom icons for each select item
  prefixIcon = input<string | undefined>(undefined); // For default icon for select placeholder
  width = input<string>('100%');
  icon = input<string | undefined>(undefined);
  tooltipText = input<string | undefined>(undefined);
  translateItems = input<boolean>(false);
  shouldTranslate = input<boolean>(true);
  filter = input<boolean>(false);
  showClear = input<boolean>(false);
  appendTo = input<string | undefined>(undefined);
  dataKey = input<string | undefined>(undefined);
  size = input<size>(undefined);
  errorEnabled = input<boolean>(false);

  inline = input<boolean>(false);
  inlineWidth = input<string>('24rem');

  selectedChange = output<SelectOption>();

  isOpen = false;
  readonly inputId = computed(() => this.id() ?? 'select-input');

  /** Marks the wrapper as a size container so the inline row layout can respond to its width. */
  readonly containerClasses = computed(() => (this.inline() ? '@container' : ''));

  /** Stacked by default; inline mode switches to a spaced row once the container is wide enough. */
  readonly layoutClasses = computed(() =>
    this.inline() ? 'flex flex-col @xl:flex-row @xl:items-center @xl:justify-between @xl:gap-x-4' : 'flex flex-col',
  );

  /** Cancels the label's stacked-layout bottom margin while the inline row layout is active. */
  readonly labelLayoutClasses = computed(() => (this.inline() ? '@xl:mb-0!' : ''));

  /** In inline mode the dropdown is full-width while stacked and exactly {@code inlineWidth} wide in the row, so neighboring dropdowns line up; the label wraps instead of the dropdown shrinking. */
  readonly selectWidthClasses = computed(() => (this.inline() ? 'w-full @xl:w-(--jhi-select-inline-width) @xl:shrink-0' : ''));

  /** Inline mode sizes the dropdown via classes; otherwise the {@code width} input applies directly. */
  readonly selectStyle = computed(() => (this.inline() ? undefined : { width: this.width() }));

  readonly displayLabel = computed(() => this.translator.translate(this.label(), this.shouldTranslate()) ?? '');
  readonly displayPlaceholder = computed(() => this.translator.translate(this.placeholder(), this.shouldTranslate()) ?? '');
  readonly displayTooltipText = computed(() => this.translator.translate(this.tooltipText(), this.shouldTranslate()) ?? '');

  private translator = injectTranslator();

  onSelectionChange(value: SelectOption): void {
    this.selectedChange.emit(value);
  }
}
