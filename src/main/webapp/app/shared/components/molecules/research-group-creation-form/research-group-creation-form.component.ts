import { hasText } from 'app/shared/util/text.util';
import { nextOptionIndex } from 'app/shared/util/listbox.util';
import { injectTranslator } from 'app/shared/util/translate-signal.util';
import { Component, ElementRef, computed, inject, signal, viewChildren } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ResearchGroupResourceApi } from 'app/generated/api/research-group-resource-api';
import { ResearchGroupRequestDTO } from 'app/generated/model/research-group-request-dto';
import { KeycloakUserDTO } from 'app/generated/model/keycloak-user-dto';
import { ProfOnboardingResourceApi } from 'app/generated/api/prof-onboarding-resource-api';
import { SchoolResourceApi } from 'app/generated/api/school-resource-api';
import { DepartmentResourceApi } from 'app/generated/api/department-resource-api';
import { UserResourceApi } from 'app/generated/api/user-resource-api';
import { SchoolShortDTO } from 'app/generated/model/school-short-dto';
import { DepartmentDTO } from 'app/generated/model/department-dto';
import { firstValueFrom } from 'rxjs';
import { EditorComponent } from 'app/shared/components/atoms/editor/editor.component';
import { HttpErrorResponse } from '@angular/common/http';
import { SearchFilterSortBar } from 'app/shared/components/molecules/search-filter-sort-bar/search-filter-sort-bar';

import { ProgressSpinnerComponent } from '../../atoms/progress-spinner/progress-spinner.component';
import { StringInputComponent } from '../../atoms/string-input/string-input.component';
import { ButtonComponent } from '../../atoms/button/button.component';
import { ConfirmDialog } from '../../atoms/confirm-dialog/confirm-dialog';
import { InfoBoxComponent } from '../../atoms/info-box/info-box.component';
import { SelectComponent, SelectOption } from '../../atoms/select/select.component';
import { ToastService } from '../../../../service/toast-service';
import { tumIdValidator } from '../../../validators/custom-validators';
import TranslateDirective from '../../../language/translate.directive';
import { formatFullName } from '../../../util/name.util';

type FormMode = 'professor' | 'admin';

interface SelectedAdminProfessor {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  universityId?: string;
  username?: string;
}

@Component({
  selector: 'jhi-professor-request-access-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    StringInputComponent,
    ButtonComponent,
    SelectComponent,
    TranslateDirective,
    ConfirmDialog,
    EditorComponent,
    FontAwesomeModule,
    InfoBoxComponent,
    SearchFilterSortBar,
    ProgressSpinnerComponent,
  ],
  templateUrl: './research-group-creation-form.component.html',
})
export class ResearchGroupCreationFormComponent {
  // Input to determine if this is admin mode or professor mode
  mode = computed<FormMode>(() => this.config?.data?.mode ?? 'professor');
  isProfessorMode = computed(() => this.mode() === 'professor');
  isAdminMode = computed(() => this.mode() === 'admin');

  // Form
  form: FormGroup;

  // Loading state
  isSubmitting = signal(false);
  isLoadingAdminUsers = signal(false);

  // Admin professor selection
  readonly MIN_ADMIN_SEARCH_LENGTH = 3;
  readonly ADMIN_USERS_PAGE_SIZE = 25;
  adminProfessorSearchQuery = signal('');
  adminProfessorCandidates = signal<KeycloakUserDTO[]>([]);
  /** The candidate that carries the list's single tab stop. */
  focusedCandidateIndex = signal<number>(0);
  readonly candidateOptions = viewChildren<ElementRef<HTMLElement>>('candidateOption');
  readonly candidateListLabel = computed(() => this.translator.translate('researchGroup.adminView.professorSelect.listLabel'));
  adminProfessorTotalCount = signal(0);
  adminProfessorCurrentPage = signal(0);
  hasMoreAdminProfessorCandidates = computed(() => this.adminProfessorCandidates().length < this.adminProfessorTotalCount());
  selectedAdminProfessor = signal<SelectedAdminProfessor | undefined>(undefined);
  isSearchQueryLongEnough = computed(() => this.adminProfessorSearchQuery().trim().length >= this.MIN_ADMIN_SEARCH_LENGTH);
  showSearchMinLengthHint = computed(
    () => !this.isLoadingAdminUsers() && this.adminProfessorSearchQuery().trim().length > 0 && !this.isSearchQueryLongEnough(),
  );
  showNoSearchResults = computed(
    () => !this.isLoadingAdminUsers() && this.isSearchQueryLongEnough() && this.adminProfessorCandidates().length === 0,
  );
  showCandidatesList = computed(() => !this.isLoadingAdminUsers() && this.adminProfessorCandidates().length > 0);
  /**
   * Which candidate is reachable by tab, clamped so that a shorter set of search results than before
   * still leaves the list reachable.
   */
  tabbableCandidateIndex = computed(() => {
    const lastIndex = this.adminProfessorCandidates().length - 1;
    return lastIndex < 0 ? 0 : Math.min(Math.max(this.focusedCandidateIndex(), 0), lastIndex);
  });

  // School and Department data
  schools = signal<SchoolShortDTO[]>([]);
  departments = signal<DepartmentDTO[]>([]);
  selectedSchoolId = signal<string | undefined>(undefined);
  selectedDepartmentId = signal<string | undefined>(undefined);

  // Computed select options
  schoolOptions = computed<SelectOption[]>(() =>
    this.schools().map(school => ({
      name: school.name ?? '',
      value: school.schoolId ?? '',
    })),
  );

  departmentOptions = computed<SelectOption[]>(() =>
    this.departments().map(dept => ({
      name: dept.name ?? '',
      value: dept.departmentId ?? '',
    })),
  );

  // Filtered departments based on selected school
  filteredDepartmentOptions = computed<SelectOption[]>(() => {
    const schoolId = this.selectedSchoolId();
    if (!hasText(schoolId)) {
      return this.departmentOptions();
    }
    return this.departments()
      .filter(dept => dept.school?.schoolId === schoolId)
      .map(dept => ({
        name: dept.name ?? '',
        value: dept.departmentId ?? '',
      }));
  });

  // Selected options for binding
  selectedSchoolOption = computed<SelectOption | undefined>(() => {
    const schoolId = this.selectedSchoolId();
    if (!hasText(schoolId)) return undefined;
    return this.schoolOptions().find(opt => opt.value === schoolId);
  });

  selectedDepartmentOption = computed<SelectOption | undefined>(() => {
    const deptId = this.selectedDepartmentId();
    if (!hasText(deptId)) return undefined;
    return this.departmentOptions().find(opt => opt.value === deptId);
  });

  // Template references
  showConfirmDialog = signal(false);

  // Services
  private readonly translator = injectTranslator();
  private readonly fb = inject(FormBuilder);
  private readonly config = inject(DynamicDialogConfig, { optional: true });
  private readonly ref = inject(DynamicDialogRef, { optional: true });
  private readonly researchGroupApi = inject(ResearchGroupResourceApi);
  private readonly profOnboardingApi = inject(ProfOnboardingResourceApi);
  private readonly schoolApi = inject(SchoolResourceApi);
  private readonly departmentApi = inject(DepartmentResourceApi);
  private readonly userApi = inject(UserResourceApi);
  private readonly toastService = inject(ToastService);
  private readonly ADMIN_LOADER_DELAY_MS = 250;
  private adminLoaderTimeout: number | undefined = undefined;
  private latestAdminSearchRequestId = 0;

  constructor() {
    this.form = this.createForm();
    void this.prefillProfessorData();
    void this.loadSchoolsAndDepartments();
  }

  async loadSchoolsAndDepartments(): Promise<void> {
    try {
      const [schools, departments] = await Promise.all([
        firstValueFrom(this.schoolApi.getAllSchools()),
        firstValueFrom(this.departmentApi.getDepartments()),
      ]);
      this.schools.set(schools);
      this.departments.set(departments);
    } catch {
      this.toastService.showErrorKey('onboarding.professorRequest.loadDataFailed');
    }
  }

  onSchoolChange(option: SelectOption): void {
    const schoolId = option.value as string;
    this.selectedSchoolId.set(schoolId);

    // Clear department if it doesn't belong to the selected school
    const currentDeptId = this.selectedDepartmentId();
    if (hasText(currentDeptId)) {
      const dept = this.departments().find(d => d.departmentId === currentDeptId);
      if (dept?.school?.schoolId !== schoolId) {
        this.selectedDepartmentId.set(undefined);
        this.form.patchValue({ departmentId: '' });
      }
    }
  }

  onDepartmentChange(option: SelectOption): void {
    const deptId = option.value as string;
    this.selectedDepartmentId.set(deptId);
    this.form.patchValue({ departmentId: deptId });

    // Auto-update the school filter based on the selected department
    const dept = this.departments().find(d => d.departmentId === deptId);
    const schoolId = dept?.school?.schoolId;
    if (hasText(schoolId)) {
      this.selectedSchoolId.set(schoolId);
    }
  }

  onSubmit(): void {
    if (this.form.valid) {
      this.showConfirmDialog.set(true);
    }
  }

  onConfirmSubmit(): void {
    if (this.form.valid && !this.isSubmitting()) {
      void this.submitRequest();
    }
  }

  onCancel(): void {
    this.ref?.close();
  }

  async onAdminProfessorSearch(searchQuery: string): Promise<void> {
    if (this.mode() !== 'admin') {
      return;
    }

    const requestId = ++this.latestAdminSearchRequestId;

    this.adminProfessorSearchQuery.set(searchQuery);
    const trimmedQuery = searchQuery.trim();

    if (this.adminLoaderTimeout !== undefined) {
      clearTimeout(this.adminLoaderTimeout);
      this.adminLoaderTimeout = undefined;
    }

    if (trimmedQuery.length < this.MIN_ADMIN_SEARCH_LENGTH) {
      this.adminProfessorCandidates.set([]);
      this.adminProfessorTotalCount.set(0);
      this.adminProfessorCurrentPage.set(0);
      this.isLoadingAdminUsers.set(false);
      return;
    }

    await this.loadAdminProfessorPage(trimmedQuery, 0, false, requestId);
  }

  async onLoadMoreAdminProfessors(): Promise<void> {
    if (this.mode() !== 'admin' || this.isLoadingAdminUsers() || !this.hasMoreAdminProfessorCandidates()) {
      return;
    }

    const trimmedQuery = this.adminProfessorSearchQuery().trim();
    if (trimmedQuery.length < this.MIN_ADMIN_SEARCH_LENGTH) {
      return;
    }

    const requestId = ++this.latestAdminSearchRequestId;
    const nextPage = this.adminProfessorCurrentPage() + 1;
    await this.loadAdminProfessorPage(trimmedQuery, nextPage, true, requestId);
  }

  selectAdminProfessor(user: KeycloakUserDTO): void {
    this.selectedAdminProfessor.set(user);
    this.form.patchValue({ tumID: user.universityId ?? '' });
    this.form.get('tumID')?.markAsTouched();
  }

  /**
   * Moves between candidates with the arrow keys, so the list costs one tab stop rather than one per professor.
   *
   * @param event the key press on a candidate
   * @param index the candidate the key was pressed on
   */
  onCandidateKeydown(event: KeyboardEvent, index: number): void {
    const target = nextOptionIndex(event.key, index, this.adminProfessorCandidates().length);
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    this.focusedCandidateIndex.set(target);
    this.candidateOptions()[target]?.nativeElement.focus();
  }

  clearSelectedAdminProfessor(): void {
    this.selectedAdminProfessor.set(undefined);
    this.form.patchValue({ tumID: '' });
    void this.onAdminProfessorSearch(this.adminProfessorSearchQuery());
  }

  private async loadAdminProfessorPage(searchQuery: string, page: number, append: boolean, requestId: number): Promise<void> {
    this.adminLoaderTimeout = window.setTimeout(() => {
      if (requestId === this.latestAdminSearchRequestId) {
        this.isLoadingAdminUsers.set(true);
      }
    }, this.ADMIN_LOADER_DELAY_MS);

    try {
      const response = await firstValueFrom(this.userApi.getAvailableUsersForResearchGroup(this.ADMIN_USERS_PAGE_SIZE, page, searchQuery));
      if (requestId !== this.latestAdminSearchRequestId) {
        return;
      }

      const pageContent = response.content ?? [];
      const nextCandidates = append ? this.adminProfessorCandidates().concat(pageContent) : pageContent;

      this.adminProfessorCandidates.set(nextCandidates);
      this.adminProfessorTotalCount.set(response.totalElements ?? nextCandidates.length);
      this.adminProfessorCurrentPage.set(page);
    } catch {
      if (requestId === this.latestAdminSearchRequestId) {
        this.toastService.showErrorKey('researchGroup.members.toastMessages.loadUsersFailed');
      }
    } finally {
      if (requestId === this.latestAdminSearchRequestId) {
        clearTimeout(this.adminLoaderTimeout);
        this.adminLoaderTimeout = undefined;
        this.isLoadingAdminUsers.set(false);
      }
    }
  }

  private createForm(): FormGroup {
    const isAdminMode = this.mode() === 'admin';

    return this.fb.group({
      title: [{ value: '', disabled: isAdminMode }, isAdminMode ? [] : [Validators.required]],
      firstName: [{ value: '', disabled: isAdminMode }, isAdminMode ? [] : [Validators.required]],
      lastName: [{ value: '', disabled: isAdminMode }, isAdminMode ? [] : [Validators.required]],
      tumID: ['', [Validators.required, tumIdValidator]],
      researchGroupHead: ['', [Validators.required]],
      researchGroupName: ['', [Validators.required]],
      researchGroupAbbreviation: [''],
      departmentId: ['', [Validators.required]],
      researchGroupContactEmail: ['', [Validators.email, Validators.pattern(/.+\..{2,}$/)]],
      researchGroupWebsite: [''],
      researchGroupDescription: ['', [Validators.maxLength(1000)]],
      researchGroupStreetAndNumber: [''],
      researchGroupPostalCode: [''],
      researchGroupCity: [''],
      additionalNotes: [{ value: '', disabled: isAdminMode }],
    });
  }

  private async submitRequest(): Promise<void> {
    this.isSubmitting.set(true);
    const requestData = this.createResearchGroupRequestDTO();

    try {
      const isAdminMode = this.mode() === 'admin';
      let result;

      if (isAdminMode) {
        // Admin creates research group directly as ACTIVE
        result = await firstValueFrom(this.researchGroupApi.createResearchGroupAsAdmin(requestData));
        this.toastService.showSuccessKey('researchGroup.adminView.success.create');
      } else {
        // Professor creates research group as DRAFT (requires approval)
        result = await firstValueFrom(this.researchGroupApi.createProfessorResearchGroupRequest(requestData));
        // Mark onboarding as confirmed after successful research group request submission
        await firstValueFrom(this.profOnboardingApi.confirmOnboarding());
        this.toastService.showSuccessKey('onboarding.professorRequest.success');
      }

      this.ref?.close(result);
    } catch (error) {
      // Type-safe error handling
      if (error instanceof HttpErrorResponse) {
        const errorMessage: string = ((error.error as { message?: unknown } | undefined)?.message as string | undefined) ?? '';

        // Check if the error is about a duplicate research group name
        if (errorMessage.includes('already exists') || error.status === 409) {
          const errorKey =
            this.mode() === 'admin' ? 'researchGroup.adminView.errors.duplicateName' : 'onboarding.professorRequest.errorDuplicateName';
          this.toastService.showErrorKey(errorKey);
        }
        // Check if the error is about a user not found (invalid TUM-ID)
        else if (error.status === 404 && errorMessage.includes('not found')) {
          const errorKey =
            this.mode() === 'admin' ? 'researchGroup.adminView.errors.userNotFound' : 'onboarding.professorRequest.errorUserNotFound';
          this.toastService.showErrorKey(errorKey);
        }
        // Check if the error is about professor already being assigned to another research group
        else if (error.status === 400 && errorMessage.toLowerCase().includes('already a member of research group')) {
          const errorKey =
            this.mode() === 'admin' ? 'researchGroup.adminView.errors.userAlreadyMember' : 'onboarding.professorRequest.error';
          this.toastService.showErrorKey(errorKey);
        } else {
          const errorKey = this.mode() === 'admin' ? 'researchGroup.adminView.errors.create' : 'onboarding.professorRequest.error';
          this.toastService.showErrorKey(errorKey);
        }
      } else {
        const errorKey = this.mode() === 'admin' ? 'researchGroup.adminView.errors.create' : 'onboarding.professorRequest.error';
        this.toastService.showErrorKey(errorKey);
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private createResearchGroupRequestDTO(): ResearchGroupRequestDTO {
    const v = this.form.getRawValue();

    const s = (val: unknown): string => {
      if (val === undefined || val === null || val === '') return '';
      if (typeof val !== 'string') return '';
      const str = val.trim();
      return str.length === 0 ? '' : str;
    };

    return {
      title: s(v.title),
      firstName: s(v.firstName),
      lastName: s(v.lastName),
      universityId: s(v.tumID),
      researchGroupHead: s(v.researchGroupHead),
      researchGroupName: s(v.researchGroupName),
      abbreviation: s(v.researchGroupAbbreviation),
      departmentId: s(v.departmentId),
      contactEmail: s(v.researchGroupContactEmail),
      website: s(v.researchGroupWebsite),
      description: s(v.researchGroupDescription),
      street: s(v.researchGroupStreetAndNumber),
      postalCode: s(v.researchGroupPostalCode),
      city: s(v.researchGroupCity),
    };
  }

  private async prefillProfessorData(): Promise<void> {
    if (this.mode() !== 'professor') {
      return;
    }

    try {
      const currentUser = await firstValueFrom(this.userApi.getCurrentUser());
      const firstName = this.normalizePrefillValue(currentUser.firstName);
      const lastName = this.normalizePrefillValue(currentUser.lastName);
      const email = this.normalizePrefillValue(currentUser.email);
      const universityId = this.normalizePrefillValue(currentUser.universityId);
      const fullName = formatFullName(firstName, lastName);

      this.setControlValueIfEmpty('firstName', firstName);
      this.setControlValueIfEmpty('lastName', lastName);
      this.setControlValueIfEmpty('tumID', universityId);
      this.setControlValueIfEmpty('researchGroupHead', fullName);
      this.setControlValueIfEmpty('researchGroupContactEmail', email);
    } catch {
      // If fetching user data fails, we simply don't prefill the form. No need to show an error message.
    }
  }

  private normalizePrefillValue(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private setControlValueIfEmpty(controlName: string, valueToSet: string): void {
    if (valueToSet === '') {
      return;
    }

    const control = this.form.get(controlName);
    if (!control) {
      return;
    }

    const currentValue = control.value;
    if (typeof currentValue === 'string' && currentValue.trim() !== '') {
      return;
    }

    control.setValue(valueToSet, { emitEvent: false });
  }
}
