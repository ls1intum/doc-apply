import { Component, computed, inject, signal } from '@angular/core';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { PaginatorModule } from 'primeng/paginator';
import { firstValueFrom, map } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { SearchFilterSortBar } from 'app/shared/components/molecules/search-filter-sort-bar/search-filter-sort-bar';
import { FilterChange } from 'app/shared/components/atoms/filter-multiselect/filter-multiselect';
import { ToastService } from 'app/service/toast-service';
import { Sort, SortOption } from 'app/shared/components/atoms/sorting/sorting';
import { emptyToUndef } from 'app/core/util/array-util.service';
import { TranslateDirective } from 'app/shared/language';
import { AccountService } from 'app/core/auth/account.service';
import { JobFormDTOLocationEnum, JobFormDTOSubjectAreaEnum } from 'app/generated/model/job-form-dto';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';

import { ApplicationStatusExtended, JobCardComponent } from '../job-card/job-card.component';
import { JobCardDTO } from '../../../generated/model/job-card-dto';
import { JobResourceApi } from '../../../generated/api/job-resource-api';
import * as DropdownOptions from '../.././dropdown-options';

@Component({
  selector: 'jhi-job-card-list',
  standalone: true,
  imports: [TableModule, JobCardComponent, PaginatorModule, SearchFilterSortBar, TranslateDirective, RouterLink],
  templateUrl: './job-card-list.component.html',
})
export class JobCardListComponent {
  ApplicationStatusExtendedLocal = ApplicationStatusExtended;

  jobs = signal<JobCardDTO[]>([]);
  totalRecords = signal<number>(0);
  page = signal<number>(0);
  pageSize = signal<number>(12);
  searchQuery = signal<string>('');

  sortBy = signal<string>('startDate');
  sortDirection = signal<'ASC' | 'DESC'>('DESC');

  DropdownOptions = DropdownOptions;

  readonly accountService = inject(AccountService);
  readonly selectedSubjectAreaFilters = signal<JobFormDTOSubjectAreaEnum[]>([]);
  readonly selectedLocationFilters = signal<JobFormDTOLocationEnum[]>([]);
  readonly selectedSupervisorFilters = signal<string[]>([]);

  readonly allSubjectAreas = this.DropdownOptions.subjectAreas.map(option => option.name);
  readonly availableLocationLabels = this.DropdownOptions.locations.map(option => option.name);
  readonly allSupervisorNames = signal<string[]>([]);

  readonly sortableFields: SortOption[] = [
    { displayName: 'jobOverviewPage.sortingOptions.startDate', fieldName: 'startDate', type: 'NUMBER' },
    { displayName: 'jobOverviewPage.sortingOptions.jobTitle', fieldName: 'title', type: 'TEXT' },
    { displayName: 'jobOverviewPage.sortingOptions.subjectArea', fieldName: 'subjectArea', type: 'TEXT' },
    { displayName: 'jobOverviewPage.sortingOptions.location', fieldName: 'location', type: 'TEXT' },
    { displayName: 'jobOverviewPage.sortingOptions.professor', fieldName: 'professorName', type: 'TEXT' },
    { displayName: 'jobOverviewPage.sortingOptions.workload', fieldName: 'workload', type: 'NUMBER' },
  ];

  translateService = inject(TranslateService);
  currentLanguage = toSignal(this.translateService.onLangChange.pipe(map(event => event.lang.toUpperCase())), {
    initialValue: this.translateService.getCurrentLang() ? this.translateService.getCurrentLang().toUpperCase() : 'EN',
  });
  readonly canManageSubjectAreaSubscriptions = computed(
    () => this.accountService.signedIn() && this.accountService.hasAnyAuthority([UserShortDTORolesEnum.Applicant]),
  );
  private hasHandledInitialLazyLoad = false;
  private jobApi = inject(JobResourceApi);
  private readonly toastService = inject(ToastService);

  loadOnTableEmit(event: TableLazyLoadEvent): void {
    const page = Math.floor((event.first ?? 0) / (event.rows ?? this.pageSize()));
    const size = event.rows ?? this.pageSize();

    this.page.set(page);
    this.pageSize.set(size);

    if (!this.hasHandledInitialLazyLoad) {
      this.hasHandledInitialLazyLoad = true;
      void this.initializePage();
      return;
    }

    void this.loadJobs();
  }

  onSearchEmit(searchQuery: string): void {
    const normalizedQuery = searchQuery.trim().replace(/\s+/g, ' ');
    const currentQuery = this.searchQuery().trim().replace(/\s+/g, ' ');

    if (normalizedQuery !== currentQuery) {
      this.page.set(0);
      this.searchQuery.set(normalizedQuery);
      void this.loadJobs();
    }
  }

  onFilterEmit(filterChange: FilterChange): void {
    this.page.set(0);
    if (filterChange.filterId === 'subjectArea') {
      this.selectedSubjectAreaFilters.set(DropdownOptions.mapSubjectAreaNames(filterChange.selectedValues));
    } else if (filterChange.filterId === 'location') {
      const enumValues = DropdownOptions.mapLocationNames(filterChange.selectedValues);
      this.selectedLocationFilters.set(enumValues);
    } else if (filterChange.filterId === 'supervisor') {
      this.selectedSupervisorFilters.set(filterChange.selectedValues);
    } else {
      return;
    }
    void this.loadJobs();
  }

  onSortEmit(event: Sort): void {
    this.page.set(0);
    this.sortBy.set(event.field);
    this.sortDirection.set(event.direction);
    void this.loadJobs();
  }

  async loadAllFilter(showErrorToast = true): Promise<boolean> {
    try {
      const filterOptions = await firstValueFrom(this.jobApi.getAllFilters());
      this.allSupervisorNames.set(filterOptions.supervisorNames ?? []);
      return true;
    } catch {
      this.allSupervisorNames.set([]);
      if (showErrorToast) {
        this.toastService.showErrorKey('jobOverviewPage.errors.loadFilter');
      }
      return false;
    }
  }

  async loadJobs(showErrorToast = true): Promise<boolean> {
    try {
      const pageData = await firstValueFrom(
        this.jobApi.getAvailableJobs(
          this.pageSize(),
          this.page(),
          emptyToUndef(this.selectedSubjectAreaFilters()),
          emptyToUndef(this.selectedLocationFilters()),
          emptyToUndef(this.selectedSupervisorFilters()),
          this.sortBy(),
          this.sortDirection(),
          this.searchQuery() || undefined,
        ),
      );
      this.jobs.set(pageData.content ?? []);
      this.totalRecords.set(pageData.totalElements ?? 0);
      return true;
    } catch (error) {
      console.error('Failed to load jobs from API:', error);
      if (showErrorToast) {
        this.toastService.showErrorKey('jobOverviewPage.errors.loadJobs');
      }
      return false;
    }
  }

  getExampleImageUrl(index: number): string {
    const headerImages = [
      '/content/images/job-banner/job-banner1.jpg',
      '/content/images/job-banner/job-banner2.jpg',
      '/content/images/job-banner/job-banner3.jpg',
      '/content/images/job-banner/job-banner4.jpg',
      '/content/images/job-banner/job-banner5.jpg',
      '/content/images/job-banner/job-banner6.jpg',
    ];

    return headerImages[index % headerImages.length];
  }

  private async initializePage(): Promise<void> {
    const [filtersLoaded, jobsLoaded] = await Promise.all([this.loadAllFilter(false), this.loadJobs(false)]);

    if (!jobsLoaded) {
      this.toastService.showErrorKey('jobOverviewPage.errors.loadJobs');
      return;
    }

    if (!filtersLoaded) {
      this.toastService.showErrorKey('jobOverviewPage.errors.loadFilter');
    }
  }
}
