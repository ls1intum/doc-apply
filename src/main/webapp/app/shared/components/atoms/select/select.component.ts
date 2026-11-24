import { Component, computed, input, output } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { FormsModule } from '@angular/forms';
import { TumAetUiSelectComponent, TumAetUiTooltipDirective } from '@tumaet/ui-angular';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

export type SelectOption = {
  name: string;
  value: string | number;
  icon?: string;
};
export type size = 'small' | 'large' | undefined;

/** One entry handed to the kit select: the visible text and the position of its option in {@code items}. */
interface DisplayOption {
  label: string;
  index: number;
}

/**
 * Reads a field of an option by name, for the configurable label and key fields. Form values bound to
 * {@code selected} are not type-checked at runtime, so anything that is not an object reads as undefined.
 *
 * @param option the option to read from
 * @param field  the name of the field
 * @returns the field value, or undefined when the option is not an object or has no such field
 */
function readField(option: SelectOption, field: string): unknown {
  return option instanceof Object ? Reflect.get(option, field) : undefined;
}

/**
 * Turns a field value into display text.
 *
 * @param value the raw field value
 * @returns the value as text, or an empty string for anything that is not a string or number
 */
function toText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  return typeof value === 'number' ? String(value) : '';
}

@Component({
  selector: 'jhi-select',
  standalone: true,
  templateUrl: './select.component.html',
  imports: [TumAetUiSelectComponent, TumAetUiTooltipDirective, FontAwesomeModule, FormsModule],
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
  widthClass = input<string>('w-full');
  icon = input<string | undefined>(undefined);
  tooltipText = input<string | undefined>(undefined);
  translateItems = input<boolean>(false);
  shouldTranslate = input<boolean>(true);
  filter = input<boolean>(false);
  showClear = input<boolean>(false);
  dataKey = input<string | undefined>(undefined);
  size = input<size>(undefined);
  errorEnabled = input<boolean>(false);

  inline = input<boolean>(false);

  selectedChange = output<SelectOption | undefined>();

  readonly inputId = computed(() => this.id() ?? 'select-input');

  /** Marks the wrapper as a size container so the inline row layout can respond to its width. */
  readonly containerClasses = computed(() => (this.inline() ? '@container' : ''));

  /** Stacked by default; inline mode switches to a spaced row once the container is wide enough. */
  readonly layoutClasses = computed(() =>
    this.inline() ? 'flex flex-col @xl:flex-row @xl:items-center @xl:justify-between @xl:gap-x-4' : 'flex flex-col',
  );

  /** Cancels the label's stacked-layout bottom margin while the inline row layout is active. */
  readonly labelLayoutClasses = computed(() => (this.inline() ? '@xl:mb-0' : ''));

  readonly selectWidthClasses = computed(() => (this.inline() ? 'w-full @xl:w-96 @xl:shrink-0' : this.widthClass()));

  readonly displayLabel = computed(() => this.translator.translate(this.label(), this.shouldTranslate()) ?? '');
  readonly displayPlaceholder = computed(() => this.translator.translate(this.placeholder(), this.shouldTranslate()) ?? '');
  readonly displayTooltipText = computed(() => this.translator.translate(this.tooltipText(), this.shouldTranslate()) ?? '');

  readonly displayOptions = computed<DisplayOption[]>(() => {
    const translateItems = this.translateItems();
    const labelField = this.labelField();
    return this.items().map((item, index) => {
      const rawLabel = toText(readField(item, labelField));
      return { label: translateItems ? (this.translator.translate(rawLabel) ?? '') : rawLabel, index };
    });
  });

  readonly selectedIndex = computed<number | undefined>(() => {
    const selected = this.selected();
    if (selected === undefined) {
      return undefined;
    }
    const matchField = this.dataKey() ?? this.valueField();
    const index = this.items().findIndex(item => item === selected || readField(item, matchField) === readField(selected, matchField));
    return index >= 0 ? index : undefined;
  });

  private translator = injectTranslator();

  /**
   * Resolves the value the kit select wrote back to its option and emits it.
   *
   * @param value the position of the picked option, or undefined when the selection was cleared
   */
  onKitSelectionChange(value: unknown): void {
    const option = typeof value === 'number' ? this.items()[value] : undefined;
    this.onSelectionChange(option);
  }

  /**
   * Emits a new selection to the parent.
   *
   * @param value the picked option, or undefined when the selection was cleared
   */
  onSelectionChange(value: SelectOption | undefined): void {
    this.selectedChange.emit(value);
  }
}
