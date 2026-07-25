import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DividerModule } from 'primeng/divider';
import { firstValueFrom } from 'rxjs';
import { ResearchGroupResourceApi } from 'app/generated/api/research-group-resource-api';
import { UserAdminResourceApi } from 'app/generated/api/user-admin-resource-api';
import { UserResourceApi } from 'app/generated/api/user-resource-api';
import { AdminUserDetailDTO } from 'app/generated/model/admin-user-detail-dto';
import { CreateUserDTO, CreateUserDTOPrimaryRoleEnum, CreateUserDTOPrimaryRoleEnumValues } from 'app/generated/model/create-user-dto';
import { ImportUserDTO } from 'app/generated/model/import-user-dto';
import { KeycloakUserDTO } from 'app/generated/model/keycloak-user-dto';
import { ResearchGroupAdminDTO } from 'app/generated/model/research-group-admin-dto';
import { UpdateUserDTO, UpdateUserDTOPrimaryRoleEnum } from 'app/generated/model/update-user-dto';
import { ToastService } from 'app/service/toast-service';
import { BackButtonComponent } from 'app/shared/components/atoms/back-button/back-button.component';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';
import { DatePickerComponent } from 'app/shared/components/atoms/datepicker/datepicker.component';
import { ProgressSpinnerComponent } from 'app/shared/components/atoms/progress-spinner/progress-spinner.component';
import { SelectComponent, SelectOption } from 'app/shared/components/atoms/select/select.component';
import { StringInputComponent } from 'app/shared/components/atoms/string-input/string-input.component';
import { SearchFilterSortBar } from 'app/shared/components/molecules/search-filter-sort-bar/search-filter-sort-bar';
import { selectGender } from 'app/shared/constants/genders';
import { TranslateDirective } from 'app/shared/language';
import { selectNationality } from 'app/shared/language/nationalities';
import LocalizedDatePipe from 'app/shared/pipes/localized-date.pipe';

// nosemgrep: javascript.security.hard-coded-password
const TRANSLATION_KEY = 'manageUsersPage';

type FormMode = 'create' | 'edit' | 'import';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const GROUP_BOUND_ROLES: ReadonlySet<CreateUserDTOPrimaryRoleEnum> = new Set<CreateUserDTOPrimaryRoleEnum>(['EMPLOYEE', 'PROFESSOR']);

interface ResearchGroupOption {
  id: string;
  name: string;
}

/**
 * Admin form for creating, importing, editing, and deleting a user.
 * The mode is derived from the route + query params:
 * - `/manage-users/create` becomes create
 * - `/manage-users/create?mode=import` becomes import
 * - `/manage-users/:userId` becomes edit
 */
@Component({
  selector: 'jhi-manage-user-form',
  imports: [
    BackButtonComponent,
    ButtonComponent,
    ConfirmDialog,
    DatePickerComponent,
    DividerModule,
    LocalizedDatePipe,
    ProgressSpinnerComponent,
    ReactiveFormsModule,
    SearchFilterSortBar,
    SelectComponent,
    StringInputComponent,
    TranslateDirective,
    TranslateModule,
  ],
  templateUrl: './manage-user-form.component.html',
})
export class ManageUserFormComponent {
  // ------- Signals: mode + state -------
  readonly mode = signal<FormMode>('create');
  readonly loadedUser = signal<AdminUserDetailDTO | undefined>(undefined);
  readonly isSubmitting = signal<boolean>(false);
  readonly showDeleteDialog = signal<boolean>(false);

  // ------- Select options -------
  readonly genderOptions: SelectOption[] = selectGender;
  readonly nationalityOptionsBase: SelectOption[] = selectNationality;
  readonly languageOptions: SelectOption[] = [
    { value: 'en', name: 'languages.en' },
    { value: 'de', name: 'languages.de' },
  ];
  readonly roleOptions: SelectOption[] = CreateUserDTOPrimaryRoleEnumValues.map(role => ({
    value: role,
    name: `${TRANSLATION_KEY}.roles.${role}`,
  }));

  // ------- Selected select-option signals -------
  readonly selectedGender = signal<SelectOption | undefined>(undefined);
  readonly selectedNationality = signal<SelectOption | undefined>(undefined);
  readonly selectedLanguage = signal<SelectOption | undefined>(undefined);
  readonly selectedRole = signal<SelectOption | undefined>(undefined);
  readonly selectedResearchGroup = signal<SelectOption | undefined>(undefined);
  readonly birthday = signal<string>('');

  // ------- Research group options -------
  readonly researchGroupOptions = signal<ResearchGroupOption[]>([]);
  readonly researchGroupSelectOptions = computed<SelectOption[]>(() =>
    this.researchGroupOptions().map(group => ({ value: group.id, name: group.name })),
  );

  /** True when the chosen role needs a research group attached. */
  readonly requiresResearchGroup = computed<boolean>(() => {
    const role = this.selectedRole()?.value as CreateUserDTOPrimaryRoleEnum | undefined;
    return role !== undefined && GROUP_BOUND_ROLES.has(role);
  });

  /** True when the role/group selection prevents the submit button from enabling. */
  readonly roleSelectionInvalid = computed<boolean>(() => this.requiresResearchGroup() && this.selectedResearchGroup() === undefined);

  // ------- Keycloak user picker (import mode) -------
  readonly MIN_IMPORT_SEARCH_LENGTH = 3;
  readonly IMPORT_USERS_PAGE_SIZE = 25;
  readonly importSearchQuery = signal<string>('');
  /** Candidates that can actually be imported, i.e. that carry a university id. */
  readonly importCandidates = signal<KeycloakUserDTO[]>([]);
  readonly importTotalCount = signal<number>(0);
  readonly selectedImportUser = signal<KeycloakUserDTO | undefined>(undefined);
  readonly isLoadingImportUsers = signal<boolean>(false);
  readonly showImportSelectionError = signal<boolean>(false);

  readonly isImportSearchQueryLongEnough = computed<boolean>(() => this.importSearchQuery().trim().length >= this.MIN_IMPORT_SEARCH_LENGTH);
  readonly hasMoreImportCandidates = computed<boolean>(() => this.importLoadedCount() < this.importTotalCount());
  readonly showImportSearchMinLengthHint = computed<boolean>(
    () => !this.isLoadingImportUsers() && this.importSearchQuery().trim().length > 0 && !this.isImportSearchQueryLongEnough(),
  );
  readonly showNoImportResults = computed<boolean>(
    () => !this.isLoadingImportUsers() && this.isImportSearchQueryLongEnough() && this.importCandidates().length === 0,
  );
  readonly showImportCandidatesList = computed<boolean>(() => !this.isLoadingImportUsers() && this.importCandidates().length > 0);

  /** True while import mode has no importable user selected yet. */
  readonly importSelectionInvalid = computed<boolean>(() => this.mode() === 'import' && this.selectedImportUser() === undefined);

  // ------- Date bounds -------
  readonly minBirthday = new Date(1900, 0, 1);
  readonly maxBirthday = new Date();
  readonly defaultBirthday = new Date(2000, 0, 1);

  // ------- Reactive form (public for template) -------
  readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    universityId: [''],
    phoneNumber: [''],
    website: [''],
    linkedinUrl: [''],
  });

  // ------- Computed view-model fields -------
  readonly title = computed(() => {
    switch (this.mode()) {
      case 'edit':
        return `${TRANSLATION_KEY}.form.editTitle`;
      case 'import':
        return `${TRANSLATION_KEY}.form.importTitle`;
      default:
        return `${TRANSLATION_KEY}.form.createTitle`;
    }
  });

  readonly submitLabel = computed(() => {
    switch (this.mode()) {
      case 'edit':
        return `${TRANSLATION_KEY}.form.buttons.save`;
      case 'import':
        return `${TRANSLATION_KEY}.form.buttons.importUser`;
      default:
        return `${TRANSLATION_KEY}.form.buttons.createUser`;
    }
  });

  /** Translation key for the page block; exposed for use in the template. */
  readonly translationKey = TRANSLATION_KEY;

  // ------- Injected services -------
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly userAdminApi = inject(UserAdminResourceApi);
  private readonly researchGroupApi = inject(ResearchGroupResourceApi);
  private readonly userApi = inject(UserResourceApi);

  // ------- Keycloak user picker internals -------
  // Delay before showing the loading spinner so fast queries don't flicker.
  private readonly IMPORT_LOADER_DELAY_MS = 250;
  private readonly importLoadedCount = signal<number>(0);
  private importCurrentPage = 0;
  private importLoaderTimeout: number | undefined = undefined;
  private latestImportSearchRequestId = 0;

  // Effect that sets mode from route params + loads user when in edit.
  private readonly modeEffect = effect(() => {
    const params = this.route.snapshot.paramMap;
    const queryParams = this.route.snapshot.queryParamMap;
    const userId = params.get('userId');
    const queryMode = queryParams.get('mode');

    let nextMode: FormMode = 'create';
    if (userId !== null && userId !== '') {
      nextMode = 'edit';
    } else if (queryMode === 'import') {
      nextMode = 'import';
    }
    this.mode.set(nextMode);
    this.applyValidatorsForMode(nextMode);

    if (nextMode === 'edit' && userId !== null && userId !== '') {
      void this.loadUser(userId);
    }
  });

  constructor() {
    void this.loadResearchGroups();
  }

  /**
   * Submit the form for the current mode. Routes to the matching API call.
   */
  async onSubmit(): Promise<void> {
    if (this.importSelectionInvalid()) {
      this.showImportSelectionError.set(true);
      return;
    }
    if (this.form.invalid || this.roleSelectionInvalid()) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    try {
      switch (this.mode()) {
        case 'create':
          await this.submitCreate();
          break;
        case 'import':
          await this.submitImport();
          break;
        case 'edit':
          await this.submitUpdate();
          break;
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /**
   * Open the delete confirmation dialog for the loaded user (edit mode only).
   */
  onRequestDelete(): void {
    if (this.mode() !== 'edit') {
      return;
    }
    this.showDeleteDialog.set(true);
  }

  /**
   * Confirm deletion handler bound to the confirm-dialog. Deletes the loaded
   * user from Keycloak and anonymises their database references.
   */
  async onConfirmDelete(): Promise<void> {
    const userId = this.loadedUser()?.userId;
    if (userId === undefined || userId === '') {
      return;
    }
    try {
      await firstValueFrom(this.userAdminApi.deleteUser(userId));
      this.toastService.showSuccess({
        summary: this.translate.instant(`${TRANSLATION_KEY}.toastMessages.deleteSuccess`),
      });
      void this.router.navigate(['/manage-users']);
    } catch (error) {
      this.toastService.showError({
        summary: this.translate.instant(`${TRANSLATION_KEY}.toastMessages.deleteFailed`, {
          detail: this.extractErrorDetail(error),
        }),
      });
    }
  }

  updateGender(option: SelectOption | undefined): void {
    this.selectedGender.set(option);
  }

  updateNationality(option: SelectOption | undefined): void {
    this.selectedNationality.set(option);
  }

  updateLanguage(option: SelectOption | undefined): void {
    this.selectedLanguage.set(option);
  }

  updateRole(option: SelectOption | undefined): void {
    this.selectedRole.set(option);
    // Drop the research group when the new role does not allow one.
    const role = option?.value as CreateUserDTOPrimaryRoleEnum | undefined;
    if (role === undefined || !GROUP_BOUND_ROLES.has(role)) {
      this.selectedResearchGroup.set(undefined);
    }
  }

  updateResearchGroup(option: SelectOption | undefined): void {
    this.selectedResearchGroup.set(option);
  }

  updateBirthday(value: string | undefined): void {
    this.birthday.set(value ?? '');
  }

  /**
   * Run a Keycloak user search for the import picker. Queries shorter than the
   * minimum length reset the candidate list without hitting the server.
   *
   * @param searchQuery the raw query typed into the search bar
   */
  async onImportUserSearch(searchQuery: string): Promise<void> {
    if (this.mode() !== 'import') {
      return;
    }

    const requestId = ++this.latestImportSearchRequestId;
    this.importSearchQuery.set(searchQuery);
    const trimmedQuery = searchQuery.trim();

    this.clearImportLoaderTimeout();

    if (trimmedQuery.length < this.MIN_IMPORT_SEARCH_LENGTH) {
      this.resetImportCandidates();
      this.isLoadingImportUsers.set(false);
      return;
    }

    await this.loadImportUserPage(trimmedQuery, 0, false, requestId);
  }

  /**
   * Append the next page of Keycloak users to the import picker.
   */
  async onLoadMoreImportUsers(): Promise<void> {
    if (this.mode() !== 'import' || this.isLoadingImportUsers() || !this.hasMoreImportCandidates()) {
      return;
    }

    const trimmedQuery = this.importSearchQuery().trim();
    if (trimmedQuery.length < this.MIN_IMPORT_SEARCH_LENGTH) {
      return;
    }

    const requestId = ++this.latestImportSearchRequestId;
    await this.loadImportUserPage(trimmedQuery, this.importCurrentPage + 1, true, requestId);
  }

  /**
   * Select a Keycloak user as the import target. Users without a university id
   * cannot be imported and are ignored.
   *
   * @param user the candidate picked from the result list
   */
  selectImportUser(user: KeycloakUserDTO): void {
    if (!this.isImportable(user)) {
      return;
    }
    this.selectedImportUser.set(user);
    this.showImportSelectionError.set(false);
  }

  /**
   * Drop the current import selection and re-run the last search.
   */
  clearSelectedImportUser(): void {
    this.selectedImportUser.set(undefined);
    void this.onImportUserSearch(this.importSearchQuery());
  }

  /**
   * Apply mode-specific validators. Reactive Forms only — controls always exist.
   *
   * @param mode the current form mode
   */
  private applyValidatorsForMode(mode: FormMode): void {
    const passwordControl = this.form.controls.password;
    const firstNameControl = this.form.controls.firstName;
    const lastNameControl = this.form.controls.lastName;
    const emailControl = this.form.controls.email;

    if (mode === 'create') {
      passwordControl.setValidators([Validators.required, Validators.pattern(PASSWORD_PATTERN)]);
      firstNameControl.setValidators([Validators.required]);
      lastNameControl.setValidators([Validators.required]);
      emailControl.setValidators([Validators.required, Validators.email]);
    } else if (mode === 'import') {
      passwordControl.clearValidators();
      firstNameControl.clearValidators();
      lastNameControl.clearValidators();
      emailControl.clearValidators();
    } else {
      // edit
      passwordControl.clearValidators();
      firstNameControl.setValidators([Validators.required]);
      lastNameControl.setValidators([Validators.required]);
      emailControl.setValidators([Validators.required, Validators.email]);
    }

    passwordControl.updateValueAndValidity({ emitEvent: false });
    firstNameControl.updateValueAndValidity({ emitEvent: false });
    lastNameControl.updateValueAndValidity({ emitEvent: false });
    emailControl.updateValueAndValidity({ emitEvent: false });
  }

  /**
   * Fetch one page of importable Keycloak users and apply it to the picker state.
   *
   * @param searchQuery the trimmed search query
   * @param page zero-based page index to fetch
   * @param append true to append to the current candidates, false to replace them
   * @param requestId monotonic id used to drop stale responses
   */
  private async loadImportUserPage(searchQuery: string, page: number, append: boolean, requestId: number): Promise<void> {
    this.importLoaderTimeout = window.setTimeout(() => {
      if (requestId === this.latestImportSearchRequestId) {
        this.isLoadingImportUsers.set(true);
      }
    }, this.IMPORT_LOADER_DELAY_MS);

    try {
      // No research group id: this admin flow has no target group.
      const response = await firstValueFrom(this.userApi.getAvailableUsersForResearchGroup(this.IMPORT_USERS_PAGE_SIZE, page, searchQuery));
      if (requestId !== this.latestImportSearchRequestId) {
        return;
      }

      const pageContent = response.content ?? [];
      // Only TUM users carry a university id; local users cannot be imported.
      const importable = pageContent.filter(user => this.isImportable(user));

      this.importCandidates.set(append ? this.importCandidates().concat(importable) : importable);
      this.importLoadedCount.set(append ? this.importLoadedCount() + pageContent.length : pageContent.length);
      this.importTotalCount.set(response.totalElements ?? this.importLoadedCount());
      this.importCurrentPage = page;
    } catch {
      if (requestId === this.latestImportSearchRequestId) {
        this.toastService.showErrorKey(`${TRANSLATION_KEY}.errors.loadKeycloakUsers`);
      }
    } finally {
      if (requestId === this.latestImportSearchRequestId) {
        this.clearImportLoaderTimeout();
        this.isLoadingImportUsers.set(false);
      }
    }
  }

  private isImportable(user: KeycloakUserDTO): boolean {
    const universityId = user.universityId;
    return universityId !== undefined && universityId.trim() !== '';
  }

  private resetImportCandidates(): void {
    this.importCandidates.set([]);
    this.importLoadedCount.set(0);
    this.importTotalCount.set(0);
    this.importCurrentPage = 0;
  }

  private clearImportLoaderTimeout(): void {
    if (this.importLoaderTimeout !== undefined) {
      clearTimeout(this.importLoaderTimeout);
      this.importLoaderTimeout = undefined;
    }
  }

  private async loadUser(userId: string): Promise<void> {
    try {
      const user = await firstValueFrom(this.userAdminApi.getUser(userId));
      this.loadedUser.set(user);
      this.form.patchValue({
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        email: user.email ?? '',
        universityId: user.universityId ?? '',
        phoneNumber: user.phoneNumber ?? '',
        website: user.website ?? '',
        linkedinUrl: user.linkedinUrl ?? '',
      });
      this.form.controls.email.disable({ emitEvent: false });
      this.selectedGender.set(this.findOption(this.genderOptions, user.gender));
      this.selectedNationality.set(this.findOption(this.nationalityOptionsBase, user.nationality));
      this.selectedLanguage.set(this.findOption(this.languageOptions, user.selectedLanguage));
      this.selectedRole.set(this.findOption(this.roleOptions, user.primaryRole));
      this.selectedResearchGroup.set(this.findOption(this.researchGroupSelectOptions(), user.researchGroupId));
      this.birthday.set(user.birthday ?? '');
    } catch {
      this.toastService.showErrorKey(`${TRANSLATION_KEY}.errors.loadUser`);
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
      // Reapply the selection now that the option list exists.
      const loaded = this.loadedUser();
      if (loaded?.researchGroupId !== undefined) {
        this.selectedResearchGroup.set(this.findOption(this.researchGroupSelectOptions(), loaded.researchGroupId));
      }
    } catch {
      this.toastService.showErrorKey(`${TRANSLATION_KEY}.errors.loadFilters`);
    }
  }

  private async submitCreate(): Promise<void> {
    const value = this.form.getRawValue();
    const dto: CreateUserDTO = {
      firstName: value.firstName,
      lastName: value.lastName,
      email: value.email,
      password: value.password,
      universityId: this.emptyToUndefined(value.universityId),
      phoneNumber: this.emptyToUndefined(value.phoneNumber),
      website: this.emptyToUndefined(value.website),
      linkedinUrl: this.emptyToUndefined(value.linkedinUrl),
      gender: this.selectOptionValue(this.selectedGender()),
      nationality: this.selectOptionValue(this.selectedNationality()),
      selectedLanguage: this.selectOptionValue(this.selectedLanguage()),
      birthday: this.emptyToUndefined(this.birthday()),
      primaryRole: this.selectedRole()?.value as CreateUserDTOPrimaryRoleEnum | undefined,
      researchGroupId: this.requiresResearchGroup() ? this.selectOptionValue(this.selectedResearchGroup()) : undefined,
    };

    try {
      const created = await firstValueFrom(this.userAdminApi.createUser(dto));
      this.toastService.showSuccess({
        summary: this.translate.instant(`${TRANSLATION_KEY}.toastMessages.createSuccess`),
      });
      void this.router.navigate(['/manage-users', created.userId]);
    } catch (error) {
      this.toastService.showError({
        summary: this.translate.instant(`${TRANSLATION_KEY}.toastMessages.createFailed`, {
          detail: this.extractErrorDetail(error),
        }),
      });
    }
  }

  private async submitImport(): Promise<void> {
    const universityId = this.selectedImportUser()?.universityId;
    if (universityId === undefined || universityId === '') {
      this.showImportSelectionError.set(true);
      return;
    }
    const dto: ImportUserDTO = { universityId };
    try {
      const imported = await firstValueFrom(this.userAdminApi.importUser(dto));
      this.toastService.showSuccess({
        summary: this.translate.instant(`${TRANSLATION_KEY}.toastMessages.importSuccess`),
      });
      void this.router.navigate(['/manage-users', imported.userId]);
    } catch (error) {
      this.toastService.showError({
        summary: this.translate.instant(`${TRANSLATION_KEY}.toastMessages.importFailed`, {
          detail: this.extractErrorDetail(error),
        }),
      });
    }
  }

  private async submitUpdate(): Promise<void> {
    const userId = this.loadedUser()?.userId;
    if (userId === undefined || userId === '') {
      return;
    }
    const value = this.form.getRawValue();
    const loadedRole = this.loadedUser()?.primaryRole;
    const selectedRole = this.selectedRole()?.value as UpdateUserDTOPrimaryRoleEnum | undefined;
    const loadedGroupId = this.loadedUser()?.researchGroupId;
    const selectedGroupId = this.selectOptionValue(this.selectedResearchGroup());
    const roleChanged = selectedRole !== loadedRole;
    const groupChanged = (selectedGroupId ?? undefined) !== (loadedGroupId ?? undefined);
    const sendRole = roleChanged || groupChanged;
    const dto: UpdateUserDTO = {
      firstName: value.firstName,
      lastName: value.lastName,
      universityId: this.emptyToUndefined(value.universityId),
      phoneNumber: this.emptyToUndefined(value.phoneNumber),
      website: this.emptyToUndefined(value.website),
      linkedinUrl: this.emptyToUndefined(value.linkedinUrl),
      gender: this.selectOptionValue(this.selectedGender()),
      nationality: this.selectOptionValue(this.selectedNationality()),
      selectedLanguage: this.selectOptionValue(this.selectedLanguage()),
      birthday: this.emptyToUndefined(this.birthday()),
      primaryRole: sendRole ? selectedRole : undefined,
      researchGroupId: sendRole && this.requiresResearchGroup() ? selectedGroupId : undefined,
    };

    try {
      const updated = await firstValueFrom(this.userAdminApi.updateUser(userId, dto));
      this.loadedUser.set(updated);
      this.toastService.showSuccess({
        summary: this.translate.instant(`${TRANSLATION_KEY}.toastMessages.updateSuccess`),
      });
    } catch (error) {
      this.toastService.showError({
        summary: this.translate.instant(`${TRANSLATION_KEY}.toastMessages.updateFailed`, {
          detail: this.extractErrorDetail(error),
        }),
      });
    }
  }

  private findOption(options: SelectOption[], value: string | undefined): SelectOption | undefined {
    if (value === undefined || value === '') return undefined;
    return options.find(option => option.value === value);
  }

  private selectOptionValue(option: SelectOption | undefined): string | undefined {
    if (option === undefined) return undefined;
    return typeof option.value === 'string' ? option.value : String(option.value);
  }

  private emptyToUndefined(value: string | undefined): string | undefined {
    return value !== undefined && value !== '' ? value : undefined;
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
