import {
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DividerModule } from 'primeng/divider';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CheckboxModule } from 'primeng/checkbox';
import { ChipModule } from 'primeng/chip';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

export interface Filter {
  filterId: string;
  filterLabel: string;
  filterSearchPlaceholder: string;
  filterOptions: string[];
  shouldTranslateOptions?: boolean;
}

export interface FilterChange {
  filterId: string;
  selectedValues: string[];
}

interface RenderedOption {
  value: string;
  label: string;
  selected: boolean;
}

@Component({
  selector: 'jhi-filter-multiselect',
  imports: [FormsModule, DividerModule, CommonModule, FontAwesomeModule, CheckboxModule, ChipModule],
  templateUrl: './filter-multiselect.html',
  styleUrl: './filter-multiselect.scss',
  encapsulation: ViewEncapsulation.None,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(focusout)': 'onFocusOut($event)',
    // Bound on the host rather than the trigger: the dropdown is a sibling of the trigger, so key
    // presses made while the search field has focus never pass through it.
    '(keydown)': 'onKeydown($event)',
  },
})
export class FilterMultiselect {
  filterId = input.required<string>();
  filterLabel = input.required<string>();
  filterSearchPlaceholder = input.required<string>();
  filterOptions = input<string[]>([]);
  shouldTranslateOptions = input<boolean>(false);
  selectedValuesInput = input<string[] | undefined>(undefined);
  // Set to false when the consumer renders its own chip list outside the trigger
  // (e.g. subject-area subscription selector) and the in-trigger chips would be redundant.
  showChipsInTrigger = input<boolean>(true);
  focusedIndexOptionList = signal<number>(-1);

  listboxId = computed(() => `filter-${this.filterId()}-listbox`);
  // Undefined while nothing is highlighted, so the attribute is dropped rather than left empty.
  activeOptionId = computed(() => {
    const index = this.focusedIndexOptionList();
    return index >= 0 && index < this.visibleOptions().length ? this.optionId(index) : undefined;
  });

  selectedValues = signal<string[]>([]);

  isOpen = signal(false);
  searchTerm = signal('');
  dropdownAlignment = signal<'left' | 'right'>('left');
  maxVisibleChips = 2;

  filterChange = output<{ filterId: string; selectedValues: string[] }>();

  displayFilterLabel = computed(() => this.translator.translate(this.filterLabel()) ?? '');
  displaySearchPlaceholder = computed(() => this.translator.translate(this.filterSearchPlaceholder()) ?? '');
  displaySelectedHeader = computed(() => this.translator.translate('entity.filters.selected') ?? '');
  displayClearAllLabel = computed(() => this.translator.translate('entity.filters.clearAll') ?? '');
  displayNoResultsLabel = computed(() => this.translator.translate('entity.filters.noResults') ?? '');

  filteredOptions = computed(() => {
    const search = this.searchTerm().toLowerCase().trim();
    const options = this.filterOptions();

    if (!search) {
      return options;
    }

    return options.filter(option => {
      if (this.shouldTranslateOptions()) {
        const translatedValue = this.translateService.instant(option).toLowerCase();
        return translatedValue.includes(search);
      } else {
        return option.toLowerCase().includes(search);
      }
    });
  });

  visibleOptions = computed<RenderedOption[]>(() => {
    const snapshot = this.renderedOptions();
    const selected = this.selectedValues();
    const search = this.searchTerm().toLowerCase().trim();

    const withLiveSelection: RenderedOption[] = snapshot.map(opt => ({
      value: opt.value,
      label: opt.label,
      selected: selected.includes(opt.value),
    }));

    if (!search) {
      return withLiveSelection;
    }

    return withLiveSelection.filter(opt => opt.label.toLowerCase().includes(search));
  });

  unselectedStartIndex = computed(() => {
    const options = this.visibleOptions();
    const firstUnselected = options.findIndex(opt => !opt.selected);
    return firstUnselected > 0 ? firstUnselected : -1;
  });

  selectedOptions = computed<RenderedOption[]>(() => {
    this.translator.langChange();
    const selected = this.selectedValues();
    const translateLabels = this.shouldTranslateOptions();
    return this.filterOptions()
      .filter(value => selected.includes(value))
      .map(value => ({
        value,
        label: translateLabels ? this.translateService.instant(value) : value,
        selected: true,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  showChipsCounterOnly = computed(() => this.selectedOptions().length > this.maxVisibleChips);
  hasSelectedItems = computed(() => this.selectedOptions().length > 0);
  hasVisibleItems = computed(() => this.visibleOptions().length > 0);

  selectedCount = computed(() => this.selectedValues().length);
  totalCount = computed(() => this.filterOptions().length);

  private readonly renderedOptions = signal<RenderedOption[]>([]);
  private readonly elementRef = inject(ElementRef);
  private readonly dropdownRef = viewChild<ElementRef<HTMLElement>>('dropdown');
  private readonly optionElements = viewChildren<ElementRef<HTMLElement>>('optionRow');
  private readonly translator = injectTranslator();
  private readonly translateService = this.translator.translateService;

  private readonly syncSelectedValuesEffect = effect(() => {
    const externalSelectedValues = this.selectedValuesInput();
    if (externalSelectedValues === undefined) {
      return;
    }

    if (!this.areFilterValuesEqual(this.selectedValues(), externalSelectedValues)) {
      this.selectedValues.set([...externalSelectedValues]);
    }
  });

  private readonly scrollFocusedIntoViewEffect = effect(() => {
    const index = this.focusedIndexOptionList();
    if (index < 0) {
      return;
    }
    const elements = this.optionElements();
    elements[index]?.nativeElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });

  toggleDropdown(): void {
    const opening = !this.isOpen();
    this.isOpen.set(opening);
    if (opening) {
      this.searchTerm.set('');
      this.focusedIndexOptionList.set(-1);
      this.renderedOptions.set(this.computeSnapshot());
      this.calculateDropdownAlignment();
    } else {
      this.renderedOptions.set([]);
    }
  }

  /**
   * Builds the DOM id of the option row at the given index. Namespaced by filter id so that
   * several filters on the same page keep unique ids.
   *
   * @param index the index of the option in the rendered list
   * @returns the option's DOM id
   */
  optionId(index: number): string {
    return `filter-${this.filterId()}-option-${index}`;
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.isKeyOwnedByFocusedControl(event.target, event.key)) {
      return;
    }

    const options = this.visibleOptions();
    const maxIndex = options.length - 1;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();

        if (!this.isOpen()) {
          this.toggleDropdown();
          this.focusedIndexOptionList.set(0);
        } else if (this.focusedIndexOptionList() >= 0 && this.focusedIndexOptionList() <= maxIndex) {
          this.toggleOption(options[this.focusedIndexOptionList()].value);
        }
        break;

      case 'ArrowDown':
        event.preventDefault();

        if (!this.isOpen()) {
          this.toggleDropdown();
          this.focusedIndexOptionList.set(0);
        } else {
          const next = this.focusedIndexOptionList() < maxIndex ? this.focusedIndexOptionList() + 1 : 0;
          this.focusedIndexOptionList.set(next);
        }
        break;

      case 'ArrowUp':
        event.preventDefault();

        if (this.isOpen()) {
          const prev = this.focusedIndexOptionList() > 0 ? this.focusedIndexOptionList() - 1 : maxIndex;
          this.focusedIndexOptionList.set(prev);
        }
        break;

      case 'Escape':
        if (this.isOpen()) {
          this.toggleDropdown();
          this.focusedIndexOptionList.set(-1);
        }
        break;
    }
  }

  closeDropdown(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      this.renderedOptions.set([]);
    }
  }

  removeOption(value: string): void {
    this.toggleOption(value);
  }

  getSummaryLabel(): string {
    return this.translateService.instant('entity.filters.numberSelected', {
      selected: this.selectedOptions().length,
    });
  }

  clearAll(): void {
    this.selectedValues.set([]);
    this.emitChange();
  }

  toggleOption(option: string): void {
    const currentSelected = this.selectedValues();
    const isSelected = currentSelected.includes(option);

    if (isSelected) {
      this.selectedValues.set(currentSelected.filter(val => val !== option));
    } else {
      this.selectedValues.set([...currentSelected, option]);
    }

    this.emitChange();
  }

  onSearchChange(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.searchTerm.set(target.value);
      this.focusedIndexOptionList.set(-1);
    }
  }

  onDocumentClick(event: Event): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeDropdown();
    }
  }

  onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next === null || !this.elementRef.nativeElement.contains(next)) {
      this.closeDropdown();
    }
  }

  /**
   * Returns whether the focused control needs the key for itself, so that navigating the option
   * list never steals it. Space has to type in the search field, and Enter has to activate a
   * button such as "clear all" or a chip's remove control.
   *
   * @param target the element the key was pressed on
   * @param key    the pressed key
   * @returns true when the key belongs to the focused control
   */
  private isKeyOwnedByFocusedControl(target: EventTarget | null, key: string): boolean {
    if (target instanceof HTMLInputElement) {
      return key === ' ';
    }
    if (target instanceof HTMLButtonElement) {
      return key === ' ' || key === 'Enter';
    }
    return false;
  }

  private computeSnapshot(): RenderedOption[] {
    this.translator.langChange();
    const selected = this.selectedValues();
    const filtered = this.filteredOptions();
    const translateLabels = this.shouldTranslateOptions();

    const opts: RenderedOption[] = filtered.map(option => ({
      value: option,
      label: translateLabels ? this.translateService.instant(option) : option,
      selected: selected.includes(option),
    }));

    return opts.sort((a, b) => {
      if (a.selected && !b.selected) return -1;
      if (!a.selected && b.selected) return 1;
      return a.label.localeCompare(b.label);
    });
  }

  private areFilterValuesEqual(first: string[], second: string[]): boolean {
    if (first.length !== second.length) {
      return false;
    }

    return first.every((value, index) => value === second[index]);
  }

  private emitChange(): void {
    this.filterChange.emit({
      filterId: this.filterId(),
      selectedValues: this.selectedValues(),
    });
  }

  private calculateDropdownAlignment(): void {
    setTimeout(() => {
      const dropdown = this.dropdownRef()?.nativeElement;
      if (dropdown && window.innerWidth <= 768) {
        const rect = dropdown.getBoundingClientRect();
        const viewportWidth = window.innerWidth;

        if (rect.right > viewportWidth) {
          this.dropdownAlignment.set('right');
        } else if (rect.left < 0) {
          this.dropdownAlignment.set('left');
        }
      } else {
        this.dropdownAlignment.set('left');
      }
    }, 0);
  }
}
