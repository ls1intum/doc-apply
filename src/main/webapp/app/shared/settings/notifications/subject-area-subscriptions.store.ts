import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApplicantResourceApi } from 'app/generated/api/applicant-resource-api';
import { JobCardDTOSubjectAreaEnum } from 'app/generated/model/job-card-dto';
import { ToastService } from 'app/service/toast-service';
import * as DropDownOptions from 'app/job/dropdown-options';

import { FilterChange } from '../../components/atoms/filter-multiselect/filter-multiselect';

export type SubjectArea = JobCardDTOSubjectAreaEnum;

/**
 * Component-scoped store for the applicant's subject area notification preferences.
 *
 * Responsibilities:
 * - load the current server-side selection
 * - expose derived values for the multiselect and tag UI
 * - persist incremental add/remove changes
 * - keep local subscription state consistent during loading and rollback scenarios
 */
@Injectable()
export class SubjectAreaSubscriptionsStore {
  readonly saving = signal(false);
  readonly selected = signal<SubjectArea[]>([]);

  readonly options = DropDownOptions.subjectAreas.map(option => ({
    name: option.name,
    value: option.value,
  }));

  /** Raw option labels used by the filter multiselect component. */
  readonly filterOptions: string[] = this.options.map(option => option.name);

  /** Selected labels mapped back into the multiselect's string-based API. */
  readonly selectedFilterValues = computed(() =>
    this.selected()
      .map(subjectArea => DropDownOptions.subjectAreaValueToNameMap.get(subjectArea))
      .filter((subjectAreaName): subjectAreaName is string => subjectAreaName !== undefined),
  );

  /** Selected option objects used by the custom tag renderer below the selector. */
  readonly selectedOptions = computed(() => {
    const selectedAreas = new Set(this.selected());
    return this.options.filter(option => selectedAreas.has(option.value));
  });

  private readonly applicantApi = inject(ApplicantResourceApi);
  private readonly toastService = inject(ToastService);

  /**
   * Loads the persisted subscriptions for the current applicant.
   *
   * On failure, the store is reset so the UI does not keep stale values.
   */
  async load(): Promise<void> {
    try {
      const subscriptions = await firstValueFrom(this.applicantApi.getSubjectAreaSubscriptions());
      this.selected.set(this.sortSubjectAreas(subscriptions as SubjectArea[]));
    } catch {
      this.reset();
      this.toastService.showErrorKey('settings.notifications.applicant.subjectAreas.loadFailed');
    }
  }

  /** Clears the currently selected subject areas. */
  reset(): void {
    this.selected.set([]);
  }

  /**
   * Persists the next selection by diffing it against the current one and only
   * sending the required add/remove requests.
   *
   * The local state is updated optimistically. On failure, the previous state is
   * restored and the latest server state is reloaded.
   */
  async updateSelection(subjectAreas: SubjectArea[] | undefined): Promise<void> {
    const nextSelection = this.sortSubjectAreas(subjectAreas ?? []);
    const previousSelection = this.selected();

    if (JSON.stringify(previousSelection) === JSON.stringify(nextSelection)) {
      return;
    }

    const previousSet = new Set(previousSelection);
    const nextSet = new Set(nextSelection);
    const subjectAreasToAdd = nextSelection.filter(subjectArea => !previousSet.has(subjectArea));
    const subjectAreasToRemove = previousSelection.filter(subjectArea => !nextSet.has(subjectArea));

    this.selected.set(nextSelection);
    this.saving.set(true);

    try {
      const updateRequests = subjectAreasToAdd
        .map(subjectArea => firstValueFrom(this.applicantApi.addSubjectAreaSubscription(subjectArea)))
        .concat(subjectAreasToRemove.map(subjectArea => firstValueFrom(this.applicantApi.removeSubjectAreaSubscription(subjectArea))));
      await Promise.all(updateRequests);
    } catch {
      this.selected.set(previousSelection);
      this.toastService.showErrorKey('settings.notifications.applicant.subjectAreas.saveFailed');
      await this.load();
    } finally {
      this.saving.set(false);
    }
  }

  async remove(subjectArea: SubjectArea): Promise<void> {
    await this.updateSelection(this.selected().filter(selectedSubjectArea => selectedSubjectArea !== subjectArea));
  }

  /** Adapts the multiselect output into domain values understood by the store. */
  onFilterChange(filterChange: FilterChange): void {
    void this.updateSelection(DropDownOptions.mapSubjectAreaNames(filterChange.selectedValues));
  }

  private sortSubjectAreas(subjectAreas: readonly SubjectArea[]): SubjectArea[] {
    const subjectAreaSet = new Set(subjectAreas);
    return this.options.filter(option => subjectAreaSet.has(option.value)).map(option => option.value);
  }
}
