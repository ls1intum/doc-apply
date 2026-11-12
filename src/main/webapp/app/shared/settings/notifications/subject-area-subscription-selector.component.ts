import { Component, computed, input, output, signal, viewChild } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateModule } from '@ngx-translate/core';

import { FilterChange, FilterMultiselect } from '../../components/atoms/filter-multiselect/filter-multiselect';
import TranslateDirective from '../../language/translate.directive';

import { SubjectArea } from './subject-area-subscriptions.store';

export interface SubjectAreaOption {
  name: string;
  value: SubjectArea;
}

@Component({
  selector: 'jhi-subject-area-subscription-selector',
  imports: [FilterMultiselect, FontAwesomeModule, TranslateModule, TranslateDirective],
  templateUrl: './subject-area-subscription-selector.component.html',
})
export class SubjectAreaSubscriptionSelectorComponent {
  private static readonly REMOVE_ANIMATION_MS = 150;

  saving = input<boolean>(false);
  filterOptions = input<string[]>([]);
  selectedValues = input<string[]>([]);
  selectedOptions = input<SubjectAreaOption[]>([]);

  filterChange = output<FilterChange>();
  removeSubjectArea = output<SubjectArea>();

  protected readonly removingSubjectArea = signal<SubjectArea | undefined>(undefined);
  protected readonly filterMultiselect = viewChild(FilterMultiselect);
  protected readonly isDropdownOpen = computed(() => this.filterMultiselect()?.isOpen() ?? false);

  onFilterChange(filterChange: FilterChange): void {
    this.filterChange.emit(filterChange);
  }

  onRemoveSubjectArea(subjectArea: SubjectArea): void {
    if (this.removingSubjectArea() !== undefined) {
      return;
    }

    this.removingSubjectArea.set(subjectArea);
    setTimeout(() => {
      this.removeSubjectArea.emit(subjectArea);
      this.removingSubjectArea.set(undefined);
    }, SubjectAreaSubscriptionSelectorComponent.REMOVE_ANIMATION_MS);
  }
}
