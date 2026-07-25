import { hasText } from 'app/shared/util/text.util';
import { Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { Router } from '@angular/router';
import { TranslateDirective } from 'app/shared/language';
import { ToastService } from 'app/service/toast-service';
import { TranslateModule } from '@ngx-translate/core';
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
import { AdminCreatedJobDTO, AdminCreatedJobDTOStateEnum } from '../../generated/model/admin-created-job-dto';
import { JobResourceApi } from '../../generated/api/job-resource-api';
import { ResearchGroupResourceApi } from '../../generated/api/research-group-resource-api';
import { UserResourceApi } from '../../generated/api/user-resource-api';

const TRANSLATION_KEY = 'allPositionsPage';

/**
 * Admin-only page listing every job across all research groups. The kebab menu
 * offers Edit and Delete on every state, plus Close on PUBLISHED and Reopen
 * on CLOSED or APPLICANT_FOUND. Edit on PUBLISHED routes through a warning dialog.
 */
@Component({
  selector: 'jhi-all-positions-page',
  standalone: true,
  imports: [
    TagComponent,
    ButtonComponent,
    DynamicTableComponent,
    TranslateDirective,
    TranslateModule,
    ConfirmDialog,
    SearchFilterSortBar,
    LocalizedDatePipe,
    MenuComponent,
    UserAvatarComponent,
    ButtonModule,
    FontAwesomeModule,
  ],
  templateUrl: './all-positions-page.component.html',
})
export class AllPositionsPageComponent {
  loading = signal(true);
  jobs = signal<AdminCreatedJobDTO[]>([]);
  totalRecords = signal<number>(0);
  page = signal<number>(0);
  pageSize = signal<number>(10);
  searchQuery = signal<string>('');

  sortBy = signal<string>('lastModifiedAt');
  sortDirection = signal<SortDirection>('DESC');

  readonly sortableFields: SortOption[] = [
    { displayName: 'allPositionsPage.tableColumn.lastModified', fieldName: 'lastModifiedAt', type: 'NUMBER' },
    { displayName: 'allPositionsPage.tableColumn.job', fieldName: 'title', type: 'TEXT' },
    { displayName: 'allPositionsPage.tableColumn.status', fieldName: 'state', type: 'TEXT' },
    { displayName: 'allPositionsPage.tableColumn.startDate', fieldName: 'startDate', type: 'NUMBER' },
    { displayName: 'allPositionsPage.tableColumn.created', fieldName: 'createdAt', type: 'NUMBER' },
  ];

  readonly availableStatusOptions: { key: string; label: string }[] = [
    { key: AdminCreatedJobDTOStateEnum.Draft, label: 'jobState.draft' },
    { key: AdminCreatedJobDTOStateEnum.Published, label: 'jobState.published' },
    { key: AdminCreatedJobDTOStateEnum.Closed, label: 'jobState.closed' },
    { key: AdminCreatedJobDTOStateEnum.ApplicantFound, label: 'jobState.applicantFound' },
  ];

  readonly stateTextMap = computed<Record<string, string>>(() =>
    this.availableStatusOptions.reduce<Record<string, string>>((acc, cur) => {
      acc[cur.key] = cur.label;
      return acc;
    }, {}),
  );

  readonly actionTemplate = viewChild.required<TemplateRef<unknown>>('actionTemplate');
  readonly startDateTemplate = viewChild.required<TemplateRef<unknown>>('startDateTemplate');
  readonly lastModifiedAtTemplate = viewChild.required<TemplateRef<unknown>>('lastModifiedAtTemplate');
  readonly stateTemplate = viewChild.required<TemplateRef<unknown>>('stateTemplate');
  readonly professorTemplate = viewChild.required<TemplateRef<unknown>>('professorTemplate');

  showEditPublishedDialog = signal(false);
  showDeleteDialog = signal(false);
  showCloseDialog = signal(false);
  showReopenDialog = signal(false);

  currentJobId = signal<string | undefined>(undefined);

  readonly deleteDialogHeaderKey = computed<string>(() => {
    const id = this.currentJobId();
    const job = this.jobs().find(j => j.jobId === id);
    return job && job.state !== AdminCreatedJobDTOStateEnum.Draft
      ? 'allPositionsPage.confirmDialog.deleteHeaderNonDraft'
      : 'allPositionsPage.confirmDialog.deleteHeader';
  });

  readonly deleteDialogMessageKey = computed<string>(() => {
    const id = this.currentJobId();
    const job = this.jobs().find(j => j.jobId === id);
    return job && job.state !== AdminCreatedJobDTOStateEnum.Draft
      ? 'allPositionsPage.confirmDialog.deleteMessageNonDraft'
      : 'allPositionsPage.confirmDialog.deleteMessage';
  });

  readonly selectedStatusFilters = signal<string[]>([]);
  readonly selectedResearchGroupIds = signal<string[]>([]);
  readonly selectedProfessorIds = signal<string[]>([]);

  readonly researchGroupOptions = signal<{ id: string; name: string }[]>([]);
  readonly professorOptions = signal<{ id: string; name: string }[]>([]);

  readonly researchGroupOptionLabels = computed(() => this.researchGroupOptions().map(o => o.name));
  readonly professorOptionLabels = computed(() => this.professorOptions().map(o => o.name));

  readonly columns = computed<DynamicTableColumn[]>(() => {
    const tpl = this.actionTemplate();
    const stateTpl = this.stateTemplate();
    const startDateTpl = this.startDateTemplate();
    const lastModifiedAtTpl = this.lastModifiedAtTemplate();
    const professorTpl = this.professorTemplate();

    return [
      { field: 'professorName', header: 'allPositionsPage.tableColumn.supervisingProfessor', width: '14rem', template: professorTpl },
      { field: 'researchGroupName', header: 'allPositionsPage.tableColumn.researchGroup', width: '12rem' },
      { field: 'title', header: 'allPositionsPage.tableColumn.job', width: '18rem' },
      { field: 'state', header: 'allPositionsPage.tableColumn.status', width: '10rem', template: stateTpl },
      { field: 'startDate', header: 'allPositionsPage.tableColumn.startDate', width: '10rem', template: startDateTpl },
      { field: 'lastModifiedAt', header: 'allPositionsPage.tableColumn.lastModified', width: '10rem', template: lastModifiedAtTpl },
      { field: 'actions', header: '', width: '5rem', template: tpl },
    ];
  });

  readonly availableStatusLabels = this.availableStatusOptions.map(option => option.label);

  readonly stateSeverityMap = signal<Record<string, 'info' | 'success' | 'contrast' | 'secondary'>>({
    DRAFT: 'info',
    PUBLISHED: 'secondary',
    CLOSED: 'contrast',
    APPLICANT_FOUND: 'success',
  });

  readonly jobMenuItems = computed<Map<string, JhiMenuItem[]>>(() => {
    const menuMap = new Map<string, JhiMenuItem[]>();

    for (const job of this.jobs()) {
      const items: JhiMenuItem[] = [];

      // 1) Edit — always available; PUBLISHED routes through a warning dialog.
      if (job.state === AdminCreatedJobDTOStateEnum.Published) {
        items.push({
          label: 'button.edit',
          icon: 'pencil',
          severity: 'primary',
          command: () => {
            this.currentJobId.set(job.jobId);
            this.showEditPublishedDialog.set(true);
          },
        });
      } else {
        items.push({
          label: 'button.edit',
          icon: 'pencil',
          severity: 'primary',
          command: () => {
            this.onEditJob(job.jobId);
          },
        });
      }

      // 2) Delete — always available; copy varies by state via deleteDialog*Key.
      items.push({
        label: 'button.delete',
        icon: 'trash',
        severity: 'danger',
        command: () => {
          this.currentJobId.set(job.jobId);
          this.showDeleteDialog.set(true);
        },
      });

      // 3) State-change action: Close on PUBLISHED, Reopen on CLOSED / APPLICANT_FOUND.
      if (job.state === AdminCreatedJobDTOStateEnum.Published) {
        items.push({
          label: 'button.close',
          icon: 'xmark',
          severity: 'danger',
          command: () => {
            this.currentJobId.set(job.jobId);
            this.showCloseDialog.set(true);
          },
        });
      } else if (job.state === AdminCreatedJobDTOStateEnum.Closed || job.state === AdminCreatedJobDTOStateEnum.ApplicantFound) {
        items.push({
          label: 'button.reopen',
          icon: 'rotate-right',
          severity: 'primary',
          command: () => {
            this.currentJobId.set(job.jobId);
            this.showReopenDialog.set(true);
          },
        });
      }

      menuMap.set(job.jobId, items);
    }

    return menuMap;
  });

  readonly filters = computed(() => [
    {
      filterId: 'status',
      filterLabel: 'allPositionsPage.tableColumn.status',
      filterSearchPlaceholder: 'allPositionsPage.searchFilterSortBar.filterOptions.stateSearchPlaceholder',
      filterOptions: this.availableStatusLabels,
      shouldTranslateOptions: true,
    },
    {
      filterId: 'researchGroup',
      filterLabel: 'allPositionsPage.filters.researchGroupLabel',
      filterSearchPlaceholder: 'allPositionsPage.searchFilterSortBar.filterOptions.researchGroupSearchPlaceholder',
      filterOptions: this.researchGroupOptionLabels(),
      shouldTranslateOptions: false,
    },
    {
      filterId: 'professor',
      filterLabel: 'allPositionsPage.filters.professorLabel',
      filterSearchPlaceholder: 'allPositionsPage.searchFilterSortBar.filterOptions.professorSearchPlaceholder',
      filterOptions: this.professorOptionLabels(),
      shouldTranslateOptions: false,
    },
  ]);

  private jobApi = inject(JobResourceApi);
  private researchGroupApi = inject(ResearchGroupResourceApi);
  private userApi = inject(UserResourceApi);
  private router = inject(Router);
  private toastService = inject(ToastService);

  constructor() {
    void Promise.all([this.loadResearchGroupOptions(), this.loadProfessorOptions()]);
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
      this.selectedStatusFilters.set(this.mapTranslationKeysToEnumValues(filterChange.selectedValues));
      void this.loadJobs();
    } else if (filterChange.filterId === 'researchGroup') {
      this.page.set(0);
      this.selectedResearchGroupIds.set(this.mapNamesToIds(filterChange.selectedValues, this.researchGroupOptions()));
      void this.loadJobs();
    } else if (filterChange.filterId === 'professor') {
      this.page.set(0);
      this.selectedProfessorIds.set(this.mapNamesToIds(filterChange.selectedValues, this.professorOptions()));
      void this.loadJobs();
    }
  }

  loadOnSortEmit(event: Sort): void {
    this.page.set(0);
    this.sortBy.set(event.field);
    this.sortDirection.set(event.direction);
    void this.loadJobs();
  }

  onEditJob(jobId: string): void {
    if (!jobId) {
      console.error('Unable to edit job with job id:', jobId);
    }
    void this.router.navigate([`/job/edit/${jobId}`]);
  }

  onCreateJob(): void {
    void this.router.navigate(['/job/create']);
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
      this.toastService.showSuccessKey(`${TRANSLATION_KEY}.toastMessages.deleteJobSuccess`);
      await this.loadJobs();
    } catch (error) {
      if (error instanceof Error) {
        this.toastService.showErrorKey(`${TRANSLATION_KEY}.toastMessages.deleteJobFailed`, { detail: error.message });
      }
    }
  }

  async onCloseJob(jobId: string): Promise<void> {
    try {
      await firstValueFrom(this.jobApi.changeJobState(jobId, AdminCreatedJobDTOStateEnum.Closed));
      this.toastService.showSuccessKey(`${TRANSLATION_KEY}.toastMessages.closeJobSuccess`);
      await this.loadJobs();
    } catch (error) {
      if (error instanceof Error) {
        this.toastService.showErrorKey(`${TRANSLATION_KEY}.toastMessages.closeJobFailed`, { detail: error.message });
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

  async onReopenJob(jobId: string): Promise<void> {
    try {
      await firstValueFrom(this.jobApi.changeJobState(jobId, AdminCreatedJobDTOStateEnum.Published));
      this.toastService.showSuccessKey(`${TRANSLATION_KEY}.toastMessages.reopenJobSuccess`);
      await this.loadJobs();
    } catch (error) {
      if (error instanceof Error) {
        this.toastService.showErrorKey(`${TRANSLATION_KEY}.toastMessages.reopenJobFailed`, { detail: error.message });
      }
    }
  }

  async onConfirmReopen(): Promise<void> {
    const jobId = this.currentJobId();
    if (hasText(jobId)) {
      await this.onReopenJob(jobId);
    }
  }

  private mapTranslationKeysToEnumValues(translationKeys: string[]): string[] {
    const keyMap = new Map(this.availableStatusOptions.map(option => [option.label, option.key]));
    return translationKeys.map(key => keyMap.get(key) ?? key);
  }

  private mapNamesToIds(names: string[], options: { id: string; name: string }[]): string[] {
    const map = new Map(options.map(o => [o.name, o.id]));
    return names.map(n => map.get(n) ?? n);
  }

  /**
   * Loads the research-group options for the filter dropdown using the admin
   * paged endpoint, since `ResearchGroupDTO` from `getAllResearchGroups` does
   * not expose a stable id field but `ResearchGroupAdminDTO` does.
   */
  private async loadResearchGroupOptions(): Promise<void> {
    try {
      const page = await firstValueFrom(this.researchGroupApi.getResearchGroupsForAdmin(1000, 0));
      const options = (page.content ?? [])
        .map(rg => ({ id: rg.id ?? '', name: rg.researchGroup ?? '' }))
        .filter(o => o.id !== '' && o.name !== '');
      this.researchGroupOptions.set(options);
    } catch {
      this.toastService.showErrorKey(`${TRANSLATION_KEY}.errors.loadFilters`);
    }
  }

  private async loadProfessorOptions(): Promise<void> {
    try {
      const list = await firstValueFrom(this.userApi.getAllProfessors());
      const options = list
        .map(u => ({
          id: u.userId ?? '',
          name: [u.firstName, u.lastName].filter(part => hasText(part)).join(' '),
        }))
        .filter(o => o.id !== '' && o.name !== '');
      this.professorOptions.set(options);
    } catch {
      this.toastService.showErrorKey(`${TRANSLATION_KEY}.errors.loadFilters`);
    }
  }

  private async loadJobs(): Promise<void> {
    this.loading.set(true);
    try {
      const pageData = await firstValueFrom(
        this.jobApi.getAllJobs(
          this.pageSize(),
          this.page(),
          emptyToUndef(this.selectedStatusFilters()),
          emptyToUndef(this.selectedResearchGroupIds()),
          emptyToUndef(this.selectedProfessorIds()),
          this.sortBy(),
          this.sortDirection(),
          this.searchQuery(),
        ),
      );
      this.jobs.set(pageData.content ?? []);
      this.totalRecords.set(pageData.totalElements ?? 0);
    } catch {
      this.toastService.showErrorKey(`${TRANSLATION_KEY}.errors.loadJobs`);
    } finally {
      this.loading.set(false);
    }
  }
}
