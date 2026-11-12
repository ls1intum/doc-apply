import { Component, ViewEncapsulation, computed, effect, input, output, signal } from '@angular/core';
import { InputGroupModule } from 'primeng/inputgroup';

import { SelectComponent, SelectOption } from '../select/select.component';
import { ButtonComponent } from '../button/button.component';

export interface SortOption {
  displayName: string;
  fieldName: string;
  type: 'TEXT' | 'NUMBER';
}

export interface Sort {
  field: string;
  direction: SortDirection;
}

export type SortDirection = 'ASC' | 'DESC';

@Component({
  selector: 'jhi-sorting',
  imports: [SelectComponent, ButtonComponent, InputGroupModule],
  templateUrl: './sorting.html',
  encapsulation: ViewEncapsulation.None,
})
export class Sorting {
  sortableFields = input.required<SortOption[]>();
  selectedField = input<string | undefined>(undefined);
  selectedDirection = input<SortDirection | undefined>(undefined);

  isAsc = signal<boolean>(false);
  selectedOption = signal<SortOption | undefined>(undefined);

  sortChange = output<Sort>();

  readonly currentOption = computed(() => this.selectedOption() ?? this.sortableFields()[0]);

  readonly selectOptions = computed<SelectOption[]>(() =>
    this.sortableFields().map(opt => ({
      name: opt.displayName,
      value: opt.fieldName,
    })),
  );

  readonly selectedSelectOption = computed<SelectOption | undefined>(() => {
    const cur = this.currentOption();
    return { name: cur.displayName, value: cur.fieldName };
  });

  private readonly syncSortStateEffect = effect(() => {
    const fields = this.sortableFields();
    const selectedField = this.selectedField();
    const selectedDirection = this.selectedDirection();

    if (selectedField !== undefined) {
      const match = fields.find(field => field.fieldName === selectedField);
      this.selectedOption.set(match);
    }

    if (selectedDirection) {
      this.isAsc.set(selectedDirection === 'ASC');
    }
  });

  getSortIcon(): string {
    const type = this.currentOption().type;
    const asc = this.isAsc();

    if (type === 'NUMBER') {
      return asc ? 'arrow-up-9-1' : 'arrow-down-9-1';
    } else {
      return asc ? 'arrow-up-z-a' : 'arrow-down-z-a';
    }
  }

  getSortTooltip(): string {
    const type = this.currentOption().type;
    const asc = this.isAsc();

    if (type === 'NUMBER') {
      return asc ? 'entity.sorting.ascending.number' : 'entity.sorting.descending.number';
    } else {
      return asc ? 'entity.sorting.ascending.text' : 'entity.sorting.descending.text';
    }
  }

  onSortFieldChange(opt: SelectOption): void {
    if (opt.value === '') {
      this.selectedOption.set(undefined);
    } else {
      const match = this.sortableFields().find(so => so.fieldName === opt.value);
      this.selectedOption.set(match);
    }
    this.emitChange();
  }

  toggleDirection(): void {
    this.isAsc.update(v => !v);
    this.emitChange();
  }

  private emitChange(): void {
    const sel = this.currentOption();
    this.sortChange.emit({
      field: sel.fieldName,
      direction: this.isAsc() ? 'ASC' : 'DESC',
    });
  }
}
