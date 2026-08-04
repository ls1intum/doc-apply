import { Component, TemplateRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { TableLazyLoadEvent } from 'primeng/table';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute, Params, Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { SearchFilterSortBar } from 'app/shared/components/molecules/search-filter-sort-bar/search-filter-sort-bar';
import { FilterChange } from 'app/shared/components/atoms/filter-multiselect/filter-multiselect';
import { ToastService } from 'app/service/toast-service';

import LocalizedDatePipe from '../../shared/pipes/localized-date.pipe';
import { DynamicTableColumn, DynamicTableComponent } from '../../shared/components/organisms/dynamic-table/dynamic-table.component';
import { ButtonComponent } from '../../shared/components/atoms/button/button.component';
import { Sort } from '../../shared/components/atoms/sorting/sorting';
import { TagComponent } from '../../shared/components/atoms/tag/tag.component';
import { UserAvatarComponent } from '../../shared/components/atoms/user-avatar/user-avatar.component';
import { availableStatusOptions, sortableFields } from '../filterSortOptions';
import TranslateDirective from '../../shared/language/translate.directive';
import { ApplicationEvaluationResourceApi } from '../../generated/api/application-evaluation-resource-api';
import { ApplicationEvaluationOverviewDTO } from '../../generated/model/application-evaluation-overview-dto';

@Component({
  selector: 'jhi-application-overview',
  standalone: true,
  imports: [
    RouterModule,
    LocalizedDatePipe,
    ButtonComponent,
    DynamicTableComponent,
    TagComponent,
    TranslateDirective,
    SearchFilterSortBar,
    UserAvatarComponent,
  ],
  templateUrl: './application-overview.component.html',
})
export class ApplicationOverviewComponent {
  loading = signal(true);
  pageData = signal<ApplicationEvaluationOverviewDTO[]>([]);
  pageSize = signal(10);
  page = signal(0);
  sortBy = signal<string>('createdAt');
  sortDirection = signal<'ASC' | 'DESC'>('DESC');
  total = signal(0);
  searchQuery = signal<string>('');

  readonly actionTemplate = viewChild.required<TemplateRef<unknown>>('actionTemplate');
  readonly stateTemplate = viewChild.required<TemplateRef<unknown>>('stateTemplate');
  readonly appliedAtTemplate = viewChild.required<TemplateRef<unknown>>('appliedAtTemplate');
  readonly nameTemplate = viewChild.required<TemplateRef<unknown>>('nameTemplate');

  readonly selectedJobFilters = signal<string[]>([]);
  readonly selectedStatusFilters = signal<string[]>([]);
  readonly allAvailableJobNames = signal<string[]>([]);

  readonly columns = computed<DynamicTableColumn[]>(() => {
    const tpl = this.actionTemplate();
    const stateTpl = this.stateTemplate();
    const appliedAtTpl = this.appliedAtTemplate();
    const nameTpl = this.nameTemplate();
    return [
      { field: 'name', header: 'evaluation.tableHeaders.name', width: '12rem', template: nameTpl },
      {
        field: 'state',
        header: 'evaluation.tableHeaders.status',
        width: '10rem',
        template: stateTpl,
      },
      { field: 'jobName', header: 'evaluation.tableHeaders.job', width: '26rem' },
      // { field: 'rating', header: 'Rating', width: '10rem' },
      { field: 'appliedAt', header: 'evaluation.tableHeaders.appliedAt', template: appliedAtTpl, width: '10rem' },
      { field: 'actions', header: '', width: '5rem', template: tpl },
    ];
  });

  readonly stateSeverityMap = signal<Record<string, 'success' | 'warn' | 'danger' | 'info' | 'neutral'>>({
    SENT: 'info',
    ACCEPTED: 'success',
    REJECTED: 'danger',
    IN_REVIEW: 'warn',
    INTERVIEW: 'neutral',
    JOB_CLOSED: 'info',
  });

  readonly availableStatusLabels = availableStatusOptions.map(option => option.label);

  protected readonly sortableFields = sortableFields;

  private isSearchInitiatedByUser = false;
  private isSortInitiatedByUser = false;

  private readonly evaluationApi = inject(ApplicationEvaluationResourceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private toastService = inject(ToastService);

  private readonly queryParamsSignal = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  constructor() {
    effect(() => {
      const queryParams = this.queryParamsSignal();
      const rawPage = queryParams.get('page');
      this.page.set(rawPage !== null && !isNaN(+rawPage) ? Math.max(0, +rawPage) : 0);

      const rawSize = queryParams.get('pageSize');
      this.pageSize.set(rawSize !== null && !isNaN(+rawSize) ? Math.max(1, +rawSize) : 10);

      if (!this.isSortInitiatedByUser) {
        this.sortBy.set(queryParams.get('sortBy') ?? this.sortableFields[0].fieldName);
        const rawSD = queryParams.get('sortDir');
        this.sortDirection.set(rawSD === 'ASC' || rawSD === 'DESC' ? rawSD : 'DESC');
      } else {
        this.isSortInitiatedByUser = false;
      }

      if (!this.isSearchInitiatedByUser) {
        this.searchQuery.set(queryParams.get('search') ?? '');
      }

      this.isSearchInitiatedByUser = false;

      void this.loadAllJobNames();

      void this.loadPage();
    });
  }

  async loadAllJobNames(): Promise<void> {
    try {
      const jobNames = await firstValueFrom(this.evaluationApi.getAllJobNames());
      this.allAvailableJobNames.set(jobNames.sort());
    } catch {
      this.allAvailableJobNames.set([]);
      this.toastService.showErrorKey('evaluation.errors.loadJobNames');
    }
  }

  loadOnTableEmit(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? 10;
    this.page.set(first / rows);
    this.pageSize.set(rows);
    this.updateUrlQueryParams();
  }

  loadOnSearchEmit(searchQuery: string): void {
    this.isSearchInitiatedByUser = true;
    this.page.set(0);
    this.searchQuery.set(searchQuery);
    this.updateUrlQueryParams();
  }

  loadOnFilterEmit(filterChange: FilterChange): void {
    if (filterChange.filterId === 'jobTitle') {
      this.page.set(0);
      this.selectedJobFilters.set(filterChange.selectedValues);
    } else if (filterChange.filterId === 'status') {
      this.page.set(0);
      const enumValues = this.mapTranslationKeysToEnumValues(filterChange.selectedValues);
      this.selectedStatusFilters.set(enumValues);
    }
    this.updateUrlQueryParams();
  }

  loadOnSortEmit(event: Sort): void {
    this.isSortInitiatedByUser = true;
    this.page.set(0);

    this.sortBy.set(event.field);
    this.sortDirection.set(event.direction);

    this.updateUrlQueryParams();
  }

  navigateToDetail(application: ApplicationEvaluationOverviewDTO): void {
    const queryParams: Params = {
      sortBy: this.sortBy(),
      sortDir: this.sortDirection(),
      applicationId: application.applicationId,
    };

    void this.router.navigate(['/evaluation/application'], {
      queryParams,
    });
  }

  async loadPage(): Promise<void> {
    this.loading.set(true);
    try {
      const offset = this.pageSize() * this.page();
      const limit = this.pageSize();
      const sortBy = this.sortBy();
      const direction = this.sortDirection();
      const search = this.searchQuery();

      const statusFilters = this.selectedStatusFilters().length > 0 ? this.selectedStatusFilters() : [];
      const jobFilters = this.selectedJobFilters().length > 0 ? this.selectedJobFilters() : [];

      const res = await firstValueFrom(
        this.evaluationApi.getApplicationsOverviews(
          offset,
          limit,
          sortBy,
          direction,
          statusFilters.length ? statusFilters : undefined,
          jobFilters.length ? jobFilters : undefined,
          search || undefined,
        ),
      );

      setTimeout(() => {
        this.pageData.set(res.applications ?? []);
        this.total.set(res.totalRecords ?? 0);
      });
    } catch (error) {
      console.error('Failed to load applications:', error);
      this.toastService.showErrorKey('evaluation.errors.loadApplications');
    } finally {
      this.loading.set(false);
    }
  }

  private mapTranslationKeysToEnumValues(translationKeys: string[]): string[] {
    const keyMap = new Map(availableStatusOptions.map(option => [option.label, option.key]));
    return translationKeys.map(key => keyMap.get(key) ?? key);
  }

  private buildQueryParams(): Params {
    const params: Params = {
      page: this.page(),
      pageSize: this.pageSize(),
      sortBy: this.sortBy(),
      sortDir: this.sortDirection(),
    };
    if (this.searchQuery()) {
      params.search = this.searchQuery();
    }
    return params;
  }

  private updateUrlQueryParams(): void {
    const queryParams: Params = this.buildQueryParams();
    void this.router.navigate([], {
      queryParams,
      replaceUrl: true,
    });
  }
}
