import { Component, computed, inject, signal } from '@angular/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { FormsModule } from '@angular/forms';
import { PaginatorModule } from 'primeng/paginator';
import { SearchFilterSortBar } from 'app/shared/components/molecules/search-filter-sort-bar/search-filter-sort-bar';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { KeycloakUserDTO } from 'app/generated/model/keycloak-user-dto';
import { ResearchGroupResourceApi } from 'app/generated/api/research-group-resource-api';
import { UserResourceApi } from 'app/generated/api/user-resource-api';
import { lastValueFrom } from 'rxjs';
import { ToastService } from 'app/service/toast-service';
import { HttpErrorResponse } from '@angular/common/http';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CheckboxComponent } from 'app/shared/components/atoms/checkbox/checkbox.component';
import { InfoBoxComponent } from 'app/shared/components/atoms/info-box/info-box.component';
import { UserAvatarComponent } from 'app/shared/components/atoms/user-avatar/user-avatar.component';
import { SelectComponent, SelectOption } from 'app/shared/components/atoms/select/select.component';
import { AddMembersToResearchGroupDTORoleEnum } from 'app/generated/model/add-members-to-research-group-dto';
import { formatFullName } from 'app/shared/util/name.util';

import TranslateDirective from '../../../shared/language/translate.directive';

const I18N_BASE = 'researchGroup.members';
type UserListItem = KeycloakUserDTO & { displayName: string };

@Component({
  selector: 'jhi-research-group-add-members.component',
  imports: [
    SearchFilterSortBar,
    ButtonComponent,
    FormsModule,
    PaginatorModule,
    ProgressSpinnerModule,
    CheckboxComponent,
    InfoBoxComponent,
    UserAvatarComponent,
    SelectComponent,
    TranslateDirective,
  ],
  templateUrl: './research-group-add-members.component.html',
})
export class ResearchGroupAddMembersComponent {
  totalRecords = signal<number>(0);
  page = signal<number>(0);
  pageSize = signal<number>(5);
  loading = signal<boolean>(false);

  researchGroupId = computed(() => this.config.data?.researchGroupId as string | undefined);
  searchQuery = signal<string>('');

  users = signal<UserListItem[]>([]);
  selectedUserCount = computed(() => this.selectedUsers().size);

  selectedRole = signal<AddMembersToResearchGroupDTORoleEnum>(AddMembersToResearchGroupDTORoleEnum.Employee);
  readonly roleOptions: SelectOption[] = [
    { value: AddMembersToResearchGroupDTORoleEnum.Employee, name: 'manageUsersPage.roles.EMPLOYEE' },
    { value: AddMembersToResearchGroupDTORoleEnum.Professor, name: 'manageUsersPage.roles.PROFESSOR' },
  ];
  selectedRoleOption = computed<SelectOption | undefined>(() => this.roleOptions.find(option => option.value === this.selectedRole()));

  userApi = inject(UserResourceApi);
  researchGroupApi = inject(ResearchGroupResourceApi);
  toastService = inject(ToastService);

  public readonly MIN_SEARCH_LENGTH = 3;

  private readonly dialogRef = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig);

  // Delay before showing the loading spinner to avoid flickering on fast queries
  private readonly LOADER_DELAY_MS = 250;
  private loaderTimeout: number | undefined;

  private latestRequestId = 0;
  private selectedUsers = signal<Map<string, KeycloakUserDTO>>(new Map());

  constructor() {
    void this.loadAvailableUsers();
  }

  /**
   * Loads the available users for the research group based on the provided search query.
   * This method handles debouncing, manages a loading spinner, and updates the user list
   * and total record count based on the response from the user service.
   *
   * @param searchQuery - An optional string representing the search query to filter users.
   *                      If not provided, the current search query is used.
   *
   * @returns A promise that resolves when the operation is complete.
   *
   * Behavior:
   * - If the search query is empty and there are existing users, the user list and total
   *   record count are cleared.
   * - If the search query is empty and there are no users, the method exits early.
   * - If the search query is shorter than the minimum search length, the method exits early.
   * - A loading spinner is displayed after a delay while the user data is being fetched.
   * - Ensures that the loading spinner is hidden and any pending timers are cleared.
   */
  async loadAvailableUsers(searchQuery?: string): Promise<void> {
    const rawQuery = searchQuery ?? this.searchQuery();
    const query = rawQuery.trim();

    if (query === '' && this.users().length > 0) {
      this.users.set([]);
      this.totalRecords.set(0);
      return;
    }

    if (query === '' && this.users().length === 0) {
      return;
    }

    if (query !== '' && query.length < this.MIN_SEARCH_LENGTH) {
      return;
    }

    if (this.loaderTimeout !== undefined) {
      clearTimeout(this.loaderTimeout);
      this.loaderTimeout = undefined;
    }
    this.loaderTimeout = window.setTimeout(() => this.loading.set(true), this.LOADER_DELAY_MS);

    // ensure we only apply the latest response
    const requestId = ++this.latestRequestId;

    try {
      const response = await lastValueFrom(
        this.userApi.getAvailableUsersForResearchGroup(this.pageSize(), this.page(), query, this.researchGroupId()),
      );
      // If another newer request has been started, ignore the response of this (stale) one
      if (requestId !== this.latestRequestId) {
        return;
      }
      this.totalRecords.set(response.totalElements ?? 0);
      this.users.set(this.toUserListItems(response.content ?? []));
    } catch {
      // Only show an error toast for the most recent request; stale errors shouldn't alarm the user
      if (requestId === this.latestRequestId) {
        this.toastService.showErrorKey(`${I18N_BASE}.toastMessages.loadUsersFailed`);
      }
    } finally {
      // only touch loading/timeout if this is the latest request
      if (requestId === this.latestRequestId) {
        clearTimeout(this.loaderTimeout);
        this.loaderTimeout = undefined;
        this.loading.set(false);
      }
    }
  }

  onSearch(searchQuery: string): void {
    if (searchQuery !== this.searchQuery()) {
      this.page.set(0);
      this.searchQuery.set(searchQuery);
      void this.loadAvailableUsers(searchQuery);
    }
  }

  onPageChange(event: { first?: number; rows?: number }): void {
    const first = event.first;
    const rows = event.rows;
    const pageNumber = first != null && rows != null && rows !== 0 ? first / rows : 0;
    this.page.set(pageNumber);
    if (rows != null) {
      this.pageSize.set(rows);
    }
    const query = this.searchQuery();
    void this.loadAvailableUsers(query.length > 0 ? query : undefined);
  }

  toggleUserSelection(user: KeycloakUserDTO): void {
    if (user.id == null || user.id === '') {
      this.toastService.showErrorKey(`${I18N_BASE}.toastMessages.invalidUser`);
      return;
    }
    const currentMap = new Map(this.selectedUsers());
    const id = user.id;
    if (currentMap.has(id)) {
      currentMap.delete(id);
    } else {
      currentMap.set(id, user);
    }
    this.selectedUsers.set(currentMap);
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  /**
   * Updates the selected role used when posting the add-members request.
   *
   * @param option - the option emitted by the role picker; ignored when not a known role value
   */
  onRoleChange(option: SelectOption): void {
    const value = option.value;
    if (value === AddMembersToResearchGroupDTORoleEnum.Professor || value === AddMembersToResearchGroupDTORoleEnum.Employee) {
      this.selectedRole.set(value);
    }
  }

  async onAddMembers(): Promise<void> {
    if (this.selectedUsers().size === 0) {
      return;
    }

    try {
      const researchGroupId = this.researchGroupId();

      const data = {
        keycloakUsers: Array.from(this.selectedUsers().values()),
        researchGroupId,
        role: this.selectedRole(),
      };
      await lastValueFrom(this.researchGroupApi.addMembersToResearchGroup(data));
      this.toastService.showSuccessKey(`${I18N_BASE}.toastMessages.addMembersSuccess`);
      this.dialogRef.close(true);
    } catch (err) {
      if (err instanceof HttpErrorResponse) {
        const rawMessage: unknown = err.error?.message;
        const errorMessage = typeof rawMessage === 'string' ? rawMessage : '';
        if (err.status === 400 && errorMessage.toLowerCase().includes('already a member')) {
          this.toastService.showErrorKey(`${I18N_BASE}.toastMessages.addMembersFailedAlreadyMember`);
        } else if (err.status === 400 && errorMessage.toLowerCase().includes('not have a valid universityid')) {
          this.toastService.showErrorKey(`${I18N_BASE}.toastMessages.addMembersFailedInvalidUniversityId`);
        } else {
          this.toastService.showErrorKey(`${I18N_BASE}.toastMessages.addMembersFailed`);
        }
      } else {
        this.toastService.showErrorKey(`${I18N_BASE}.toastMessages.addMembersFailed`);
      }
      this.dialogRef.close(false);
    }
  }

  isUserSelected(user: KeycloakUserDTO): boolean {
    if (user.id == null || user.id === '') {
      return false;
    }

    return this.selectedUsers().has(user.id);
  }

  private toUserListItems(users: KeycloakUserDTO[]): UserListItem[] {
    return users.map(user => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      universityId: user.universityId,
      displayName: formatFullName(user.firstName, user.lastName),
    }));
  }
}
