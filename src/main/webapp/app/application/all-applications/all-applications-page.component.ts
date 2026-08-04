import { hasText } from 'app/shared/util/text.util';
import { Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { Router, RouterModule } from '@angular/router';
import { TranslateDirective } from 'app/shared/language';
import { ToastService } from 'app/service/toast-service';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SearchFilterSortBar } from 'app/shared/components/molecules/search-filter-sort-bar/search-filter-sort-bar';
import { Sort, SortDirection, SortOption } from 'app/shared/components/atoms/sorting/sorting';
import { FilterChange } from 'app/shared/components/atoms/filter-multiselect/filter-multiselect';
import { emptyToUndef } from 'app/core/util/array-util.service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { JhiMenuItem, MenuComponent } from 'app/shared/components/atoms/menu/menu.component';
import { UserAvatarComponent } from 'app/shared/components/atoms/user-avatar/user-avatar.component';
import { TimeAgoPipe } from 'app/shared/pipes/time-ago.pipe';
import { BadgeModule } from 'primeng/badge';

import { DynamicTableColumn, DynamicTableComponent } from '../../shared/components/organisms/dynamic-table/dynamic-table.component';
import { AdminApplicationOverviewDTO, AdminApplicationOverviewDTOStateEnum } from '../../generated/model/admin-application-overview-dto';
import { ApplicationResourceApi } from '../../generated/api/application-resource-api';
import { ResearchGroupResourceApi } from '../../generated/api/research-group-resource-api';
import { ApplicationStateForApplicantsComponent } from '../application-state-for-applicants/application-state-for-applicants.component';

// nosemgrep: javascript.security.hard-coded-password
const TRANSLATION_KEY = 'entity.allApplicationsPage';

/**
 * Admin-only page listing every application across all applicants and research groups.
 * Row actions mirror the applicant "My Applications" view: View (always), Edit + Delete
 * on SAVED, Withdraw on SENT/IN_REVIEW, View only on terminal states.
 */
@Component({
  selector: 'jhi-all-applications-page',
  standalone: true,
  imports: [
    DynamicTableComponent,
    ButtonComponent,
    BadgeModule,
    TranslateDirective,
    ApplicationStateForApplicantsComponent,
    RouterModule,
    ConfirmDialogModule,
    ConfirmDialog,
    SearchFilterSortBar,
    TimeAgoPipe,
    MenuComponent,
    UserAvatarComponent,
    ButtonModule,
    FontAwesomeModule,
  ],
  templateUrl: './all-applications-page.component.html',
})
export class AllApplicationsPageComponent {
  loading = signal(true);
  applications = signal<AdminApplicationOverviewDTO[]>([]);
  totalRecords = signal<number>(0);
  page = signal<number>(0);
  pageSize = signal<number>(10);
  searchQuery = signal<string>('');

  sortBy = signal<string>('createdAt');
  sortDirection = signal<SortDirection>('DESC');

  readonly sortableFields: SortOption[] = [
    { displayName: 'entity.allApplicationsPage.tableColumn.created', fieldName: 'createdAt', type: 'TEXT' },
  ];

  readonly availableStatusOptions: { key: string; label: string }[] = [
    { key: AdminApplicationOverviewDTOStateEnum.Saved, label: 'applicationState.saved' },
    { key: AdminApplicationOverviewDTOStateEnum.Sent, label: 'applicationState.sent' },
    { key: AdminApplicationOverviewDTOStateEnum.InReview, label: 'applicationState.inReview' },
    { key: AdminApplicationOverviewDTOStateEnum.Accepted, label: 'applicationState.accepted' },
    { key: AdminApplicationOverviewDTOStateEnum.Rejected, label: 'applicationState.rejected' },
    { key: AdminApplicationOverviewDTOStateEnum.Withdrawn, label: 'applicationState.withdrawn' },
    { key: AdminApplicationOverviewDTOStateEnum.JobClosed, label: 'applicationState.jobClosed' },
    { key: AdminApplicationOverviewDTOStateEnum.Interview, label: 'applicationState.interview' },
  ];

  readonly availableStatusLabels = computed(() => this.availableStatusOptions.map(o => o.label));

  readonly actionTemplate = viewChild.required<TemplateRef<unknown>>('actionTemplate');
  readonly stateTemplate = viewChild.required<TemplateRef<unknown>>('stateTemplate');
  readonly applicantTemplate = viewChild.required<TemplateRef<unknown>>('applicantTemplate');
  readonly jobTemplate = viewChild.required<TemplateRef<unknown>>('jobTemplate');
  readonly createdAtTemplate = viewChild.required<TemplateRef<unknown>>('createdAtTemplate');

  showDeleteDialog = signal(false);
  showWithdrawDialog = signal(false);

  currentApplicationId = signal<string | undefined>(undefined);

  readonly selectedStatusFilters = signal<string[]>([]);
  readonly selectedResearchGroupIds = signal<string[]>([]);
  readonly selectedProfessorIds = signal<string[]>([]);

  readonly researchGroupOptions = signal<{ id: string; name: string }[]>([]);
  readonly professorOptions = signal<{ id: string; name: string }[]>([]);

  readonly researchGroupOptionLabels = computed(() => this.researchGroupOptions().map(o => o.name));
  readonly professorOptionLabels = computed(() => this.professorOptions().map(o => o.name));

  readonly columns = computed<DynamicTableColumn[]>(() => {
    const actionTpl = this.actionTemplate();
    const stateTpl = this.stateTemplate();
    const applicantTpl = this.applicantTemplate();
    const jobTpl = this.jobTemplate();
    const createdAtTpl = this.createdAtTemplate();
    return [
      { field: 'applicantName', header: 'entity.allApplicationsPage.tableColumn.applicant', width: '14rem', template: applicantTpl },
      { field: 'jobTitle', header: 'entity.allApplicationsPage.tableColumn.job', width: '20rem', template: jobTpl },
      { field: 'researchGroupName', header: 'entity.allApplicationsPage.tableColumn.researchGroup', width: '12rem' },
      { field: 'supervisingProfessorName', header: 'entity.allApplicationsPage.tableColumn.supervisingProfessor', width: '14rem' },
      { field: 'state', header: 'entity.allApplicationsPage.tableColumn.status', width: '10rem', template: stateTpl },
      { field: 'createdAt', header: 'entity.allApplicationsPage.tableColumn.created', width: '10rem', template: createdAtTpl },
      { field: 'actions', header: '', width: '7rem', template: actionTpl },
    ];
  });

  readonly applicationMenuItems = computed<Map<string, JhiMenuItem[]>>(() => {
    const menuMap = new Map<string, JhiMenuItem[]>();
    for (const application of this.applications()) {
      const items: JhiMenuItem[] = [];
      const id = application.applicationId;

      if (application.state === AdminApplicationOverviewDTOStateEnum.Saved) {
        items.push({
          label: 'button.edit',
          icon: 'pencil',
          severity: 'primary',
          command: () => {
            this.onEditApplication(id);
          },
        });
        items.push({
          label: 'button.delete',
          icon: 'trash',
          severity: 'danger',
          command: () => {
            this.currentApplicationId.set(id);
            this.showDeleteDialog.set(true);
          },
        });
      } else if (
        application.state === AdminApplicationOverviewDTOStateEnum.Sent ||
        application.state === AdminApplicationOverviewDTOStateEnum.InReview
      ) {
        items.push({
          label: 'button.withdraw',
          icon: 'withdraw',
          severity: 'danger',
          command: () => {
            this.currentApplicationId.set(id);
            this.showWithdrawDialog.set(true);
          },
        });
      }

      menuMap.set(id, items);
    }
    return menuMap;
  });

  readonly getMenuItems = computed(() => {
    const menuMap = this.applicationMenuItems();
    return (application: AdminApplicationOverviewDTO): JhiMenuItem[] => menuMap.get(application.applicationId) ?? [];
  });

  private applicationApi = inject(ApplicationResourceApi);
  private researchGroupApi = inject(ResearchGroupResourceApi);
  private router = inject(Router);
  private toastService = inject(ToastService);

  constructor() {
    void Promise.all([this.loadResearchGroupOptions(), this.loadProfessorOptions()]);
  }

  /**
   * Handles lazy-load events from the dynamic table.
   *
   * @param event - PrimeNG lazy load event with first row index and page size.
   */
  loadOnTableEmit(event: TableLazyLoadEvent): void {
    const size = event.rows ?? this.pageSize();
    const pageIndex = Math.floor((event.first ?? 0) / size);
    this.page.set(pageIndex);
    this.pageSize.set(size);
    void this.loadApplications();
  }

  /**
   * Reloads from the first page when the search query meaningfully changes.
   *
   * @param searchQuery - Raw user input from the search bar.
   */
  onSearchEmit(searchQuery: string): void {
    const normalized = searchQuery.trim().replace(/\s+/g, ' ');
    const current = this.searchQuery().trim().replace(/\s+/g, ' ');
    if (normalized !== current) {
      this.page.set(0);
      this.searchQuery.set(normalized);
      void this.loadApplications();
    }
  }

  /**
   * Updates the matching filter signal and reloads the first page.
   *
   * @param filterChange - Filter change event from the search-filter-sort bar.
   */
  onFilterEmit(filterChange: FilterChange): void {
    if (filterChange.filterId === 'status') {
      this.page.set(0);
      this.selectedStatusFilters.set(this.mapTranslationKeysToEnumValues(filterChange.selectedValues));
      void this.loadApplications();
    } else if (filterChange.filterId === 'researchGroup') {
      this.page.set(0);
      this.selectedResearchGroupIds.set(this.mapNamesToIds(filterChange.selectedValues, this.researchGroupOptions()));
      void this.loadApplications();
    } else if (filterChange.filterId === 'professor') {
      this.page.set(0);
      this.selectedProfessorIds.set(this.mapNamesToIds(filterChange.selectedValues, this.professorOptions()));
      void this.loadApplications();
    }
  }

  /**
   * Updates sort signals and reloads from the first page.
   *
   * @param event - Sort change event with field and direction.
   */
  loadOnSortEmit(event: Sort): void {
    this.page.set(0);
    this.sortBy.set(event.field);
    this.sortDirection.set(event.direction);
    void this.loadApplications();
  }

  /**
   * Navigates to the application detail view.
   *
   * @param applicationId - The application identifier to view.
   */
  onViewApplication(applicationId: string): void {
    void this.router.navigate([`/application/detail/${applicationId}`]);
  }

  /**
   * Navigates to the application form preloaded with the chosen application.
   *
   * @param applicationId - The draft application to edit.
   */
  onEditApplication(applicationId: string): void {
    void this.router.navigate(['/application/form'], { queryParams: { application: applicationId } });
  }

  /**
   * Deletes a draft application and refreshes the table.
   *
   * @param applicationId - The application to delete.
   */
  async onDeleteApplication(applicationId: string): Promise<void> {
    try {
      await firstValueFrom(this.applicationApi.deleteApplication(applicationId));
      this.toastService.showSuccessKey(`${TRANSLATION_KEY}.toastMessages.deleteSuccess`);
      await this.loadApplications();
    } catch (error) {
      if (error instanceof Error) {
        this.toastService.showErrorKey(`${TRANSLATION_KEY}.toastMessages.deleteFailed`, { detail: error.message });
      }
    }
  }

  /**
   * Withdraws a sent or in-review application and refreshes the table.
   *
   * @param applicationId - The application to withdraw.
   */
  async onWithdrawApplication(applicationId: string): Promise<void> {
    try {
      await firstValueFrom(this.applicationApi.withdrawApplication(applicationId));
      this.toastService.showSuccessKey(`${TRANSLATION_KEY}.toastMessages.withdrawSuccess`);
      await this.loadApplications();
    } catch (error) {
      if (error instanceof Error) {
        this.toastService.showErrorKey(`${TRANSLATION_KEY}.toastMessages.withdrawFailed`, { detail: error.message });
      }
    }
  }

  /** Confirms the delete dialog and dispatches the delete request. */
  async onConfirmDelete(): Promise<void> {
    const id = this.currentApplicationId();
    if (hasText(id)) {
      await this.onDeleteApplication(id);
    }
  }

  /** Confirms the withdraw dialog and dispatches the withdraw request. */
  async onConfirmWithdraw(): Promise<void> {
    const id = this.currentApplicationId();
    if (hasText(id)) {
      await this.onWithdrawApplication(id);
    }
  }

  private mapTranslationKeysToEnumValues(translationKeys: string[]): string[] {
    const keyMap = new Map(this.availableStatusOptions.map(o => [o.label, o.key]));
    return translationKeys.map(k => keyMap.get(k) ?? k);
  }

  private mapNamesToIds(names: string[], options: { id: string; name: string }[]): string[] {
    const map = new Map(options.map(o => [o.name, o.id]));
    return names.map(n => map.get(n) ?? n);
  }

  private async loadResearchGroupOptions(): Promise<void> {
    try {
      const page = await firstValueFrom(this.researchGroupApi.getResearchGroupsForAdmin(1000, 0));
      this.researchGroupOptions.set(
        (page.content ?? []).map(rg => ({ id: rg.id ?? '', name: rg.researchGroup ?? '' })).filter(o => o.id !== '' && o.name !== ''),
      );
    } catch {
      this.toastService.showErrorKey(`${TRANSLATION_KEY}.errors.loadFilters`);
    }
  }

  private async loadProfessorOptions(): Promise<void> {
    try {
      const list = await firstValueFrom(this.researchGroupApi.getAllProfessorsForAdmin());
      this.professorOptions.set(
        list
          .map(u => ({
            id: u.userId ?? '',
            name: [u.firstName, u.lastName].filter(p => hasText(p)).join(' '),
          }))
          .filter(o => o.id !== '' && o.name !== ''),
      );
    } catch {
      this.toastService.showErrorKey(`${TRANSLATION_KEY}.errors.loadFilters`);
    }
  }

  private async loadApplications(): Promise<void> {
    this.loading.set(true);
    try {
      const pageData = await firstValueFrom(
        this.applicationApi.getAllApplications(
          this.pageSize(),
          this.page(),
          emptyToUndef(this.selectedStatusFilters()),
          emptyToUndef(this.selectedResearchGroupIds()),
          emptyToUndef(this.selectedProfessorIds()),
          undefined,
          this.sortBy(),
          this.sortDirection(),
          this.searchQuery(),
        ),
      );
      this.applications.set(pageData.content ?? []);
      this.totalRecords.set(pageData.totalElements ?? 0);
    } catch {
      this.toastService.showErrorKey(`${TRANSLATION_KEY}.errors.loadJobs`);
    } finally {
      this.loading.set(false);
    }
  }
}
