import { Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TableLazyLoadEvent } from 'primeng/table';
import { firstValueFrom } from 'rxjs';
import { AccountService } from 'app/core/auth/account.service';
import { UserAdminResourceApi } from 'app/generated/api/user-admin-resource-api';
import { ResearchGroupResourceApi } from 'app/generated/api/research-group-resource-api';
import {
  AdminUserOverviewDTO,
  AdminUserOverviewDTOPrimaryRoleEnum,
  AdminUserOverviewDTOPrimaryRoleEnumValues,
} from 'app/generated/model/admin-user-overview-dto';
import { ResearchGroupAdminDTO } from 'app/generated/model/research-group-admin-dto';
import { ToastService } from 'app/service/toast-service';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';
import { Filter, FilterChange } from 'app/shared/components/atoms/filter-multiselect/filter-multiselect';
import { Sort, SortDirection, SortOption } from 'app/shared/components/atoms/sorting/sorting';
import { UserAvatarComponent } from 'app/shared/components/atoms/user-avatar/user-avatar.component';
import { SearchFilterSortBar } from 'app/shared/components/molecules/search-filter-sort-bar/search-filter-sort-bar';
import { DynamicTableColumn, DynamicTableComponent } from 'app/shared/components/organisms/dynamic-table/dynamic-table.component';
import { TranslateDirective } from 'app/shared/language';
import LocalizedDatePipe from 'app/shared/pipes/localized-date.pipe';

// nosemgrep: javascript.security.hard-coded-password
const TRANSLATION_KEY = 'manageUsersPage';

interface ResearchGroupOption {
  id: string;
  name: string;
}

interface UserRow {
  userId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
  universityId?: string;
  primaryRole?: AdminUserOverviewDTOPrimaryRoleEnum;
  researchGroupId?: string;
  researchGroupName?: string;
  lastActivityAt?: string;
  fullName: string;
  roleLabelKey: string;
  isSelf: boolean;
}

/**
 * Admin-only page that lists all users (with role + research-group filters,
 * search, sort and pagination) and lets admins create, import, view, or
 * delete users.
 */
@Component({
  selector: 'jhi-manage-users-page',
  imports: [
    ButtonComponent,
    ConfirmDialog,
    DynamicTableComponent,
    LocalizedDatePipe,
    SearchFilterSortBar,
    TranslateDirective,
    TranslateModule,
    UserAvatarComponent,
  ],
  templateUrl: './manage-users-page.component.html',
})
export class ManageUsersPageComponent {
  // ------- Signals: data + paging -------
  users = signal<AdminUserOverviewDTO[]>([]);
  totalRecords = signal<number>(0);
  page = signal<number>(0);
  pageSize = signal<number>(10);
  loading = signal<boolean>(true);
  searchQuery = signal<string>('');

  sortBy = signal<string>('lastActivityAt');
  sortDirection = signal<SortDirection>('DESC');

  // ------- Filter state -------
  readonly availableRoleOptions: readonly AdminUserOverviewDTOPrimaryRoleEnum[] = AdminUserOverviewDTOPrimaryRoleEnumValues;

  /** Translation key per role enum, used by the filter-multiselect (translated). */
  readonly roleLabelMap: Record<AdminUserOverviewDTOPrimaryRoleEnum, string> = {
    APPLICANT: `${TRANSLATION_KEY}.roles.APPLICANT`,
    PROFESSOR: `${TRANSLATION_KEY}.roles.PROFESSOR`,
    ADMIN: `${TRANSLATION_KEY}.roles.ADMIN`,
    EMPLOYEE: `${TRANSLATION_KEY}.roles.EMPLOYEE`,
  };

  readonly availableRoleLabels: string[] = this.availableRoleOptions.map(role => this.roleLabelMap[role]);

  selectedRoleFilters = signal<AdminUserOverviewDTOPrimaryRoleEnum[]>([]);
  selectedResearchGroupFilters = signal<string[]>([]);

  researchGroupOptions = signal<ResearchGroupOption[]>([]);
  readonly researchGroupNameOptions = computed<string[]>(() => this.researchGroupOptions().map(option => option.name));

  // ------- Templates -------
  readonly userTemplate = viewChild.required<TemplateRef<unknown>>('userTemplate');
  readonly roleTemplate = viewChild.required<TemplateRef<unknown>>('roleTemplate');
  readonly lastActivityTemplate = viewChild.required<TemplateRef<unknown>>('lastActivityTemplate');
  readonly actionTemplate = viewChild.required<TemplateRef<unknown>>('actionTemplate');

  // ------- Delete dialog state -------
  showDeleteDialog = signal<boolean>(false);
  currentUserToDelete = signal<UserRow | undefined>(undefined);

  // ------- Computed configs -------
  readonly columns = computed<DynamicTableColumn[]>(() => {
    const userTpl = this.userTemplate();
    const roleTpl = this.roleTemplate();
    const lastActivityTpl = this.lastActivityTemplate();
    const actionTpl = this.actionTemplate();

    return [
      { field: 'fullName', header: `${TRANSLATION_KEY}.tableColumn.user`, width: '20rem', template: userTpl },
      { field: 'email', header: `${TRANSLATION_KEY}.tableColumn.email`, width: '18rem' },
      { field: 'universityId', header: `${TRANSLATION_KEY}.tableColumn.universityId`, width: '10rem' },
      { field: 'primaryRole', header: `${TRANSLATION_KEY}.tableColumn.role`, width: '8rem', template: roleTpl },
      { field: 'researchGroupName', header: `${TRANSLATION_KEY}.tableColumn.researchGroup`, width: '14rem' },
      { field: 'lastActivityAt', header: `${TRANSLATION_KEY}.tableColumn.lastActivity`, width: '10rem', template: lastActivityTpl },
      { field: 'actions', header: '', width: '6rem', template: actionTpl },
    ];
  });

  readonly filters = computed<Filter[]>(() => [
    {
      filterId: 'role',
      filterLabel: `${TRANSLATION_KEY}.filters.roleLabel`,
      filterSearchPlaceholder: `${TRANSLATION_KEY}.searchFilterSortBar.filterOptions.roleSearchPlaceholder`,
      filterOptions: this.availableRoleLabels,
      shouldTranslateOptions: true,
    },
    {
      filterId: 'researchGroup',
      filterLabel: `${TRANSLATION_KEY}.filters.researchGroupLabel`,
      filterSearchPlaceholder: `${TRANSLATION_KEY}.searchFilterSortBar.filterOptions.researchGroupSearchPlaceholder`,
      filterOptions: this.researchGroupNameOptions(),
      shouldTranslateOptions: false,
    },
  ]);

  readonly sortableFields: SortOption[] = [
    { displayName: `${TRANSLATION_KEY}.tableColumn.lastActivity`, fieldName: 'lastActivityAt', type: 'NUMBER' },
    { displayName: `${TRANSLATION_KEY}.tableColumn.user`, fieldName: 'lastName', type: 'TEXT' },
    { displayName: `${TRANSLATION_KEY}.tableColumn.email`, fieldName: 'email', type: 'TEXT' },
  ];

  readonly currentUserId = computed<string>(() => this.accountService.loadedUser()?.id ?? '');

  readonly userRows = computed<UserRow[]>(() => {
    const currentId = this.currentUserId();
    return this.users().map(user => ({
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      avatar: user.avatar,
      universityId: user.universityId,
      primaryRole: user.primaryRole,
      researchGroupId: user.researchGroupId,
      researchGroupName: user.researchGroupName,
      lastActivityAt: user.lastActivityAt,
      fullName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      roleLabelKey: user.primaryRole ? this.roleLabelMap[user.primaryRole] : '',
      isSelf: user.userId === currentId,
    }));
  });

  /** Translation key for the page block; exposed for use in the template. */
  readonly translationKey = TRANSLATION_KEY;

  // ------- Injected services -------
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly accountService = inject(AccountService);
  private readonly userAdminApi = inject(UserAdminResourceApi);
  private readonly researchGroupApi = inject(ResearchGroupResourceApi);

  constructor() {
    void this.loadResearchGroups();
  }

  async loadPage(event: TableLazyLoadEvent): Promise<void> {
    const rows = event.rows ?? this.pageSize();
    const first = event.first ?? 0;
    this.pageSize.set(rows);
    this.page.set(Math.floor(first / rows));
    await this.loadUsers();
  }

  onSearchEmit(searchQuery: string): void {
    if (searchQuery !== this.searchQuery()) {
      this.searchQuery.set(searchQuery);
      this.page.set(0);
      void this.loadUsers();
    }
  }

  onFilterEmit(filterChange: FilterChange): void {
    if (filterChange.filterId === 'role') {
      const selectedRoles = this.mapRoleLabelsToEnums(filterChange.selectedValues);
      this.selectedRoleFilters.set(selectedRoles);
    } else if (filterChange.filterId === 'researchGroup') {
      const selectedIds = this.mapResearchGroupNamesToIds(filterChange.selectedValues);
      this.selectedResearchGroupFilters.set(selectedIds);
    }
    this.page.set(0);
    void this.loadUsers();
  }

  onSortEmit(event: Sort): void {
    this.sortBy.set(event.field);
    this.sortDirection.set(event.direction);
    this.page.set(0);
    void this.loadUsers();
  }

  onCreateUser(): void {
    void this.router.navigate(['/manage-users/create']);
  }

  onImport(): void {
    void this.router.navigate(['/manage-users/create'], { queryParams: { mode: 'import' } });
  }

  onViewUser(userId: string | undefined): void {
    if (userId !== undefined && userId !== '') {
      void this.router.navigate(['/manage-users', userId]);
    }
  }

  onRequestDelete(row: UserRow): void {
    if (row.userId === this.currentUserId()) {
      this.toastService.showErrorKey(`${TRANSLATION_KEY}.errors.selfDelete`);
      return;
    }
    this.currentUserToDelete.set(row);
    this.showDeleteDialog.set(true);
  }

  async onConfirmDelete(): Promise<void> {
    const target = this.currentUserToDelete();
    const userId = target?.userId;
    if (target === undefined || userId === undefined || userId === '') {
      return;
    }
    try {
      await firstValueFrom(this.userAdminApi.deleteUser(userId));
      this.toastService.showSuccess({
        summary: this.translate.instant(`${TRANSLATION_KEY}.toastMessages.deleteSuccess`),
      });
      await this.loadUsers();
    } catch (error) {
      this.toastService.showError({
        summary: this.translate.instant(`${TRANSLATION_KEY}.toastMessages.deleteFailed`, {
          detail: this.extractErrorDetail(error),
        }),
      });
    } finally {
      this.currentUserToDelete.set(undefined);
    }
  }

  private async loadUsers(): Promise<void> {
    this.loading.set(true);
    try {
      const roles = this.selectedRoleFilters();
      const researchGroupIds = this.selectedResearchGroupFilters();
      const page = await firstValueFrom(
        this.userAdminApi.getAllUsers(
          this.pageSize(),
          this.page(),
          this.sortBy(),
          this.sortDirection(),
          roles.length > 0 ? roles : undefined,
          researchGroupIds.length > 0 ? researchGroupIds : undefined,
          this.searchQuery() || undefined,
        ),
      );
      this.users.set(page.content ?? []);
      this.totalRecords.set(page.totalElements ?? 0);
    } catch {
      this.toastService.showErrorKey(`${TRANSLATION_KEY}.errors.loadUsers`);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadResearchGroups(): Promise<void> {
    try {
      const page = await firstValueFrom(this.researchGroupApi.getResearchGroupsForAdmin(1000, 0));
      const options: ResearchGroupOption[] = (page.content ?? [])
        .filter(
          (group: ResearchGroupAdminDTO): group is ResearchGroupAdminDTO & { id: string; researchGroup: string } =>
            Boolean(group.id) && Boolean(group.researchGroup),
        )
        .map(group => ({ id: group.id, name: group.researchGroup }))
        .sort((a, b) => a.name.localeCompare(b.name));
      this.researchGroupOptions.set(options);
    } catch {
      this.toastService.showErrorKey(`${TRANSLATION_KEY}.errors.loadFilters`);
    }
  }

  private mapRoleLabelsToEnums(labels: string[]): AdminUserOverviewDTOPrimaryRoleEnum[] {
    const labelToRole = new Map<string, AdminUserOverviewDTOPrimaryRoleEnum>();
    for (const role of this.availableRoleOptions) {
      labelToRole.set(this.roleLabelMap[role], role);
    }
    return labels.map(label => labelToRole.get(label)).filter((role): role is AdminUserOverviewDTOPrimaryRoleEnum => role !== undefined);
  }

  private mapResearchGroupNamesToIds(names: string[]): string[] {
    const nameToId = new Map(this.researchGroupOptions().map(option => [option.name, option.id]));
    return names.map(name => nameToId.get(name)).filter((id): id is string => id !== undefined);
  }

  private extractErrorDetail(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return '';
  }
}
