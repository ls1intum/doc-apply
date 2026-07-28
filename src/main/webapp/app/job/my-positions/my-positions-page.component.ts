import { hasText } from 'app/shared/util/text.util';
import { Component, TemplateRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { AccountService } from 'app/core/auth/account.service';
import { Router } from '@angular/router';
import { TranslateDirective } from 'app/shared/language';
import { ToastService } from 'app/service/toast-service';
import { TranslateService } from '@ngx-translate/core';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';
import { SearchFilterSortBar } from 'app/shared/components/molecules/search-filter-sort-bar/search-filter-sort-bar';
import { Sort, SortDirection, SortOption } from 'app/shared/components/atoms/sorting/sorting';
import { FilterChange } from 'app/shared/components/atoms/filter-multiselect/filter-multiselect';
import { emptyToUndef } from 'app/core/util/array-util.service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { JhiMenuItem, MenuComponent } from 'app/shared/components/atoms/menu/menu.component';
import { UserAvatarComponent } from 'app/shared/components/atoms/user-avatar/user-avatar.component';

import { DynamicTableColumn, DynamicTableComponent } from '../../shared/components/organisms/dynamic-table/dynamic-table.component';
import LocalizedDatePipe from '../../shared/pipes/localized-date.pipe';
import { TagComponent } from '../../shared/components/atoms/tag/tag.component';
import { CreatedJobDTO, CreatedJobDTOStateEnum } from '../../generated/model/created-job-dto';
import { JobResourceApi } from '../../generated/api/job-resource-api';
import { ResearchGroupResourceApi } from '../../generated/api/research-group-resource-api';
import { UserShortDTO } from '../../generated/model/user-short-dto';
@Component({
  selector: 'jhi-my-positions-page',
  standalone: true,
  imports: [
    TagComponent,
    ButtonComponent,
    DynamicTableComponent,
    TranslateDirective,
    ConfirmDialog,
    SearchFilterSortBar,
    LocalizedDatePipe,
    MenuComponent,
    UserAvatarComponent,
    ButtonModule,
    FontAwesomeModule,
  ],
  templateUrl: './my-positions-page.component.html',
})
export class MyPositionsPageComponent {
  loading = signal(true);
  jobs = signal<CreatedJobDTO[]>([]);
  totalRecords = signal<number>(0);
  page = signal<number>(0);
  pageSize = signal<number>(10);
  userId = signal<string>('');
  searchQuery = signal<string>('');

  sortBy = signal<string>('lastModifiedAt');
  sortDirection = signal<SortDirection>('DESC');

  readonly sortableFields: SortOption[] = [
    { displayName: 'myPositionsPage.tableColumn.lastModified', fieldName: 'lastModifiedAt', type: 'NUMBER' },
    { displayName: 'myPositionsPage.tableColumn.job', fieldName: 'title', type: 'TEXT' },
    { displayName: 'myPositionsPage.tableColumn.status', fieldName: 'state', type: 'TEXT' },
    { displayName: 'myPositionsPage.tableColumn.startDate', fieldName: 'startDate', type: 'NUMBER' },
    { displayName: 'myPositionsPage.tableColumn.created', fieldName: 'createdAt', type: 'NUMBER' },
  ];

  readonly availableStatusOptions: { key: string; label: string }[] = [
    { key: CreatedJobDTOStateEnum.Draft, label: 'jobState.draft' },
    { key: CreatedJobDTOStateEnum.Published, label: 'jobState.published' },
    { key: CreatedJobDTOStateEnum.Closed, label: 'jobState.closed' },
    { key: CreatedJobDTOStateEnum.ApplicantFound, label: 'jobState.applicantFound' },
  ];

  readonly stateTextMap = computed<Record<string, string>>(() =>
    this.availableStatusOptions.reduce<Record<string, string>>((acc, cur) => {
      acc[cur.key] = cur.label;
      return acc;
    }, {}),
  );

  readonly actionTemplate = viewChild.required<TemplateRef<unknown>>('actionTemplate');
  readonly startDateTemplate = viewChild.required<TemplateRef<unknown>>('startDateTemplate');
  readonly createdAtTemplate = viewChild.required<TemplateRef<unknown>>('createdAtTemplate');
  readonly lastModifiedAtTemplate = viewChild.required<TemplateRef<unknown>>('lastModifiedAtTemplate');
  readonly stateTemplate = viewChild.required<TemplateRef<unknown>>('stateTemplate');
  readonly professorTemplate = viewChild.required<TemplateRef<unknown>>('professorTemplate');

  showEditPublishedDialog = signal(false);
  showDeleteDialog = signal(false);
  showCloseDialog = signal(false);

  currentJobId = signal<string | undefined>(undefined);

  readonly selectedStatusFilters = signal<string[]>([]);
  readonly selectedSupervisorIds = signal<string[]>([]);
  readonly availableSupervisors = signal<UserShortDTO[]>([]);
  readonly availableSupervisorNames = computed<string[]>(() =>
    this.availableSupervisors().map(s => `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()),
  );

  readonly columns = computed<DynamicTableColumn[]>(() => {
    const tpl = this.actionTemplate();
    const stateTpl = this.stateTemplate();
    const startDateTpl = this.startDateTemplate();
    const lastModifiedAtTpl = this.lastModifiedAtTemplate();
    const professorTpl = this.professorTemplate();

    return [
      { field: 'professorName', header: 'myPositionsPage.tableColumn.supervisingProfessor', width: '12rem', template: professorTpl },
      { field: 'title', header: 'myPositionsPage.tableColumn.job', width: '20rem' },
      {
        field: 'state',
        header: 'myPositionsPage.tableColumn.status',
        width: '10rem',
        template: stateTpl,
      },
      { field: 'startDate', header: 'myPositionsPage.tableColumn.startDate', width: '10rem', template: startDateTpl },
      { field: 'lastModifiedAt', header: 'myPositionsPage.tableColumn.lastModified', width: '10rem', template: lastModifiedAtTpl },
      { field: 'actions', header: '', width: '5rem', template: tpl },
    ];
  });

  readonly availableStatusLabels = this.availableStatusOptions.map(option => option.label);

  readonly stateSeverityMap = signal<Record<string, 'info' | 'success' | 'contrast' | 'secondary' | 'neutral'>>({
    DRAFT: 'neutral',
    PUBLISHED: 'secondary',
    CLOSED: 'contrast',
    APPLICANT_FOUND: 'success',
  });

  // Computed signal that creates a map of job IDs to their menu items
  readonly jobMenuItems = computed<Map<string, JhiMenuItem[]>>(() => {
    const menuMap = new Map<string, JhiMenuItem[]>();

    for (const job of this.jobs()) {
      const items: JhiMenuItem[] = [];

      // Edit action - different behavior for DRAFT vs PUBLISHED
      if (job.state === CreatedJobDTOStateEnum.Draft) {
        items.push({
          label: 'button.edit',
          icon: 'pencil',
          severity: 'primary',
          command: () => {
            this.onEditJob(job.jobId);
          },
        });
      } else if (job.state === CreatedJobDTOStateEnum.Published) {
        items.push({
          label: 'button.edit',
          icon: 'pencil',
          severity: 'primary',
          command: () => {
            this.currentJobId.set(job.jobId);
            this.showEditPublishedDialog.set(true);
          },
        });
      }

      // Delete/Close action - based on state
      if (job.state === CreatedJobDTOStateEnum.Draft) {
        items.push({
          label: 'button.delete',
          icon: 'trash',
          severity: 'danger',
          command: () => {
            this.currentJobId.set(job.jobId);
            this.showDeleteDialog.set(true);
          },
        });
      } else if (job.state === CreatedJobDTOStateEnum.Published) {
        items.push({
          label: 'button.close',
          icon: 'xmark',
          severity: 'danger',
          command: () => {
            this.currentJobId.set(job.jobId);
            this.showCloseDialog.set(true);
          },
        });
      }

      menuMap.set(job.jobId, items);
    }

    return menuMap;
  });

  readonly getMenuItems = computed(() => {
    const menuMap = this.jobMenuItems();
    return (job: CreatedJobDTO): JhiMenuItem[] => {
      return menuMap.get(job.jobId) ?? [];
    };
  });

  private jobApi = inject(JobResourceApi);
  private researchGroupApi = inject(ResearchGroupResourceApi);
  private accountService = inject(AccountService);
  private router = inject(Router);
  private toastService = inject(ToastService);
  private translate = inject(TranslateService);

  private readonly translationKey: string = 'myPositionsPage';

  // Skip the very first read so the initial render — which already triggers
  // loadJobs() via the table's lazy-load event — doesn't double-fetch.
  private hasSeenActiveGroup = false;
  private lastSeenActiveGroupId: string | undefined;
  private readonly activeGroupRefreshEffect = effect(() => {
    const activeId = this.accountService.activeResearchGroupId();
    if (!this.hasSeenActiveGroup) {
      this.hasSeenActiveGroup = true;
      this.lastSeenActiveGroupId = activeId;
      return;
    }
    if (activeId === this.lastSeenActiveGroupId) {
      return;
    }
    this.lastSeenActiveGroupId = activeId;
    this.page.set(0);
    void this.loadJobs();
  });

  constructor() {
    void this.loadSupervisors();
  }

  loadOnTableEmit(event: TableLazyLoadEvent): void {
    const page = Math.floor((event.first ?? 0) / (event.rows ?? this.pageSize()));
    const size = event.rows ?? this.pageSize();

    this.page.set(page);
    this.pageSize.set(size);
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
    if (filterChange.filterId === 'status') {
      this.page.set(0);
      const enumValues = this.mapTranslationKeysToEnumValues(filterChange.selectedValues);
      this.selectedStatusFilters.set(enumValues);
      void this.loadJobs();
    } else if (filterChange.filterId === 'supervisor') {
      this.page.set(0);
      const ids = this.mapSupervisorNamesToIds(filterChange.selectedValues);
      this.selectedSupervisorIds.set(ids);
      void this.loadJobs();
    }
  }

  loadOnSortEmit(event: Sort): void {
    this.page.set(0);
    this.sortBy.set(event.field);
    this.sortDirection.set(event.direction);
    void this.loadJobs();
  }

  onCreateJob(): void {
    void this.router.navigate(['/job/create']);
  }

  onEditJob(jobId: string): void {
    if (!jobId) {
      console.error('Unable to edit job with job id:', jobId);
    }
    void this.router.navigate([`/job/edit/${jobId}`]);
  }

  onViewJob(jobId: string): void {
    if (!jobId) {
      console.error('Unable to view job with job id:', jobId);
    }
    void this.router.navigate([`/job/detail/${jobId}`]);
  }

  async onDeleteJob(jobId: string): Promise<void> {
    try {
      await firstValueFrom(this.jobApi.deleteJob(jobId));
      this.toastService.showSuccessKey(`${this.translationKey}.toastMessages.deleteJobSuccess`);
      await this.loadJobs();
    } catch (error) {
      if (error instanceof Error) {
        this.toastService.showErrorKey(`${this.translationKey}.toastMessages.deleteJobFailed`, { detail: error.message });
      }
    }
  }

  async onCloseJob(jobId: string): Promise<void> {
    try {
      await firstValueFrom(this.jobApi.changeJobState(jobId, CreatedJobDTOStateEnum.Closed));
      this.toastService.showSuccessKey(`${this.translationKey}.toastMessages.closeJobSuccess`);
      await this.loadJobs();
    } catch (error) {
      if (error instanceof Error) {
        this.toastService.showErrorKey(`${this.translationKey}.toastMessages.closeJobFailed`, { detail: error.message });
      }
    }
  }

  onConfirmEdit(): void {
    const jobId = this.currentJobId();
    if (hasText(jobId)) {
      this.onEditJob(jobId);
    }
  }

  async onConfirmDelete(): Promise<void> {
    const jobId = this.currentJobId();
    if (hasText(jobId)) {
      await this.onDeleteJob(jobId);
    }
  }

  async onConfirmClose(): Promise<void> {
    const jobId = this.currentJobId();
    if (hasText(jobId)) {
      await this.onCloseJob(jobId);
    }
  }

  private mapTranslationKeysToEnumValues(translationKeys: string[]): string[] {
    const keyMap = new Map(this.availableStatusOptions.map(option => [option.label, option.key]));
    return translationKeys.map(key => keyMap.get(key) ?? key);
  }

  private mapSupervisorNamesToIds(names: string[]): string[] {
    if (names.length === 0) {
      return [];
    }
    const byName = new Map(this.availableSupervisors().map(s => [`${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(), s.userId]));
    return names.map(n => byName.get(n)).filter((id): id is string => id !== undefined);
  }

  private async loadSupervisors(): Promise<void> {
    try {
      const supervisors = await firstValueFrom(this.researchGroupApi.getResearchGroupProfessors());
      this.availableSupervisors.set(supervisors);
    } catch {
      this.availableSupervisors.set([]);
    }
  }

  private async loadJobs(): Promise<void> {
    this.loading.set(true);
    try {
      this.userId.set(this.accountService.loadedUser()?.id ?? '');
      if (this.userId() === '') {
        return;
      }
      const pageData = await firstValueFrom(
        this.jobApi.getJobsForCurrentResearchGroup(
          this.pageSize(),
          this.page(),
          emptyToUndef(this.selectedStatusFilters()),
          emptyToUndef(this.selectedSupervisorIds()),
          this.sortBy(),
          this.sortDirection(),
          this.searchQuery(),
        ),
      );
      this.jobs.set(pageData.content ?? []);
      this.totalRecords.set(pageData.totalElements ?? 0);
    } catch {
      this.toastService.showErrorKey('myPositionsPage.errors.loadJobs');
    } finally {
      this.loading.set(false);
    }
  }
}
