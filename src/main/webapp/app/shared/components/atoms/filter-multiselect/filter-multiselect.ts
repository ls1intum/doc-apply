import { Component, ElementRef, computed, effect, inject, input, output, signal, viewChild, viewChildren } from '@angular/core';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TumAetUiCheckboxComponent } from '@tumaet/ui-angular';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

import { DividerComponent } from '../divider/divider.component';

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

/** A selected option shown as a chip in the trigger. */
interface SelectedChip {
  value: string;
  label: string;
  removeLabel: string;
}

/** Below the trigger where it fits, otherwise above it; aligned to whichever edge keeps the list on screen. */
const DROPDOWN_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
];

@Component({
  selector: 'jhi-filter-multiselect',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, DividerComponent, FontAwesomeModule, TumAetUiCheckboxComponent],
  templateUrl: './filter-multiselect.html',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(focusout)': 'onFocusOut($event)',
    // Bound on the host for the trigger; the dropdown renders in an overlay outside the host and binds its own.
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
  /** The list is at least as wide as the trigger. */
  dropdownMinWidth = signal(0);
  readonly dropdownPositions = DROPDOWN_POSITIONS;
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
        const translatedValue = String(this.translateService.instant(option)).toLowerCase();
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

  selectedChips = computed<SelectedChip[]>(() =>
    this.selectedOptions().map(option => ({
      value: option.value,
      label: option.label,
      removeLabel: this.translateService.instant('entity.filters.removeOption', { option: option.label }),
    })),
  );

  showChipsCounterOnly = computed(() => this.selectedOptions().length > this.maxVisibleChips);
  hasSelectedItems = computed(() => this.selectedOptions().length > 0);
  hasVisibleItems = computed(() => this.visibleOptions().length > 0);

  selectedCount = computed(() => this.selectedValues().length);
  totalCount = computed(() => this.filterOptions().length);

  private readonly renderedOptions = signal<RenderedOption[]>([]);
  private readonly elementRef: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly triggerRef = viewChild.required<ElementRef<HTMLElement>>('trigger');
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
      this.selectedValues.set(externalSelectedValues.slice());
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
      this.dropdownMinWidth.set(this.triggerRef().nativeElement.getBoundingClientRect().width);
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
      this.selectedValues.set(currentSelected.concat(option));
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
    if (!this.isInside(event.target)) {
      this.closeDropdown();
    }
  }

  onFocusOut(event: FocusEvent): void {
    if (!this.isInside(event.relatedTarget)) {
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

  /**
   * Returns whether an event target belongs to this filter: the trigger or the dropdown, which renders in an overlay
   * outside the host element.
   *
   * @param target the element the event came from or went to
   * @returns true when the target is part of the filter
   */
  private isInside(target: EventTarget | null): boolean {
    if (!(target instanceof Node)) {
      return false;
    }
    return this.elementRef.nativeElement.contains(target) || this.dropdownRef()?.nativeElement.contains(target) === true;
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
}
