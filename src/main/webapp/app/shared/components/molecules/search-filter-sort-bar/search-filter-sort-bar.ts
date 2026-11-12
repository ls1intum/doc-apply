import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { TumAetUiIconFieldComponent, TumAetUiInputDirective } from '@tumaet/ui-angular';
import { TranslateService } from '@ngx-translate/core';
import { hasText } from 'app/shared/util/text.util';

import TranslateDirective from '../../../language/translate.directive';
import { Filter, FilterChange, FilterMultiselect } from '../../atoms/filter-multiselect/filter-multiselect';
import { Sort, SortDirection, SortOption, Sorting } from '../../atoms/sorting/sorting';
import { ButtonComponent } from '../../atoms/button/button.component';
import { DrawerComponent } from '../drawer/drawer.component';

@Component({
  selector: 'jhi-search-filter-sort-bar',
  imports: [
    FormsModule,
    TumAetUiIconFieldComponent,
    TumAetUiInputDirective,
    TranslateDirective,
    FilterMultiselect,
    Sorting,
    ButtonComponent,
    DrawerComponent,
  ],
  templateUrl: './search-filter-sort-bar.html',
})
export class SearchFilterSortBar {
  // total number of records found
  totalRecords = input<number>(0);
  showRecords = input<boolean>(true);
  searchText = input<string | undefined>(undefined);
  searchWidth = input<string | undefined>(undefined);

  // list of filters to be displayed
  filters = input<Filter[]>([]);

  // list of sort options to be displayed
  sortableFields = input<SortOption[]>();

  // Translation keys for the entity name beside the record count. Pass the key, not translated text:
  // this component resolves them itself, and translating in the parent too misses on the second pass.
  singleEntity = input.required<string>();
  multipleEntities = input.required<string>();

  searchOutput = output<string>();
  filterOutput = output<FilterChange>();
  sortOutput = output<Sort>();

  // text entered in the search input field
  inputText = signal('');
  isMobileSidebarOpen = signal(false);

  selectedFiltersById = signal<Record<string, string[]>>({});
  selectedSortField = signal<string | undefined>(undefined);
  selectedSortDirection = signal<SortDirection>('DESC');

  readonly searchFieldClass = computed(() => this.searchWidth() ?? 'max-w-[18rem]');
  readonly hasMobileActions = computed(() => this.filters().length || (this.sortableFields()?.length ?? 0));
  readonly hasActiveFilters = computed(() => Object.values(this.selectedFiltersById()).some(values => values.length));
  readonly sortingAndFilterTooltip = computed(() => {
    this.langChange();
    return this.translateService.instant('entity.filters.sortingAndFilter');
  });
  readonly resetFilterLabel = computed(() => {
    this.langChange();
    return this.translateService.instant('entity.filters.resetFilter');
  });
  readonly showLabel = computed(() => {
    this.langChange();
    return this.translateService.instant('entity.filters.show');
  });

  readonly translatedEntityName = computed(() => {
    this.langChange();
    const key = this.totalRecords() === 1 ? this.singleEntity() : this.multipleEntities();
    return this.translateService.instant(key);
  });

  readonly placeHolderText = computed(() => {
    this.langChange();
    const key = this.searchText();
    return hasText(key) ? this.translateService.instant(key) : undefined;
  });

  protected readonly searchIcon = faMagnifyingGlass;

  private translateService = inject(TranslateService);
  private langChange = toSignal(this.translateService.onLangChange, { initialValue: undefined });

  private debounceTimeout: ReturnType<typeof setTimeout> | null = null;

  private readonly initializeSortDefaultsEffect = effect(() => {
    const fields = this.sortableFields();
    if (!fields || fields.length === 0 || this.selectedSortField() !== undefined) {
      return;
    }

    this.selectedSortField.set(fields[0].fieldName);
  });

  onSearch(): void {
    if (this.debounceTimeout !== null) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = setTimeout(() => {
      this.searchOutput.emit(this.inputText());
    }, 300);
  }

  onFilterChange(filterChange: FilterChange): void {
    this.selectedFiltersById.update(previous => {
      const next: Record<string, string[]> = Object.assign({}, previous);
      next[filterChange.filterId] = filterChange.selectedValues.slice();
      return next;
    });
    this.filterOutput.emit(filterChange);
  }

  onSortChange(event: Sort): void {
    this.selectedSortField.set(event.field);
    this.selectedSortDirection.set(event.direction);
    this.sortOutput.emit(event);
  }

  getSelectedFilterValues(filterId: string): string[] {
    return this.selectedFiltersById()[filterId] ?? [];
  }

  openMobileSidebar(): void {
    this.isMobileSidebarOpen.set(true);
  }

  closeMobileSidebar(): void {
    this.isMobileSidebarOpen.set(false);
  }

  clearAllFilter(): void {
    const previousSelectedFilters = this.selectedFiltersById();
    const hadSearchText = this.inputText().trim().length;
    const activeFilterIds = Object.entries(previousSelectedFilters)
      .filter(([, values]) => values.length)
      .map(([filterId]) => filterId);
    this.inputText.set('');
    this.selectedFiltersById.set({});

    if (hadSearchText) {
      this.searchOutput.emit('');
    }

    if (activeFilterIds.length) {
      activeFilterIds.forEach(filterId =>
        this.filterOutput.emit({
          filterId,
          selectedValues: [],
        }),
      );
    }
  }
}
