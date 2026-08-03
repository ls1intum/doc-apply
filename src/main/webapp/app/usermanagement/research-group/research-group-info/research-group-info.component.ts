import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { StringInputComponent } from 'app/shared/components/atoms/string-input/string-input.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EditorComponent } from 'app/shared/components/atoms/editor/editor.component';
import { AccountService } from 'app/core/auth/account.service';
import { ResearchGroupDTO } from 'app/generated/model/research-group-dto';
import { ToastService } from 'app/service/toast-service';
import { firstValueFrom } from 'rxjs';
import { TranslateDirective } from 'app/shared/language';
import { ResearchGroupResourceApi } from 'app/generated/api/research-group-resource-api';
import { DepartmentResourceApi } from 'app/generated/api/department-resource-api';
import { DividerModule } from 'primeng/divider';
import { InfoBoxComponent } from 'app/shared/components/atoms/info-box/info-box.component';
import { SavingBadgeComponent } from 'app/shared/components/atoms/saving-badge/saving-badge.component';
import { StickyFooterShellComponent } from 'app/shared/components/molecules/sticky-footer-shell/sticky-footer-shell.component';
import { AutoSaveController } from 'app/shared/util/auto-save-controller';
import { SavingState } from 'app/shared/constants/saving-states';

@Component({
  selector: 'jhi-research-group-info',
  imports: [
    StringInputComponent,
    EditorComponent,
    TranslateModule,
    TranslateDirective,
    ReactiveFormsModule,
    DividerModule,
    InfoBoxComponent,
    SavingBadgeComponent,
    StickyFooterShellComponent,
  ],
  templateUrl: './research-group-info.component.html',
})
export class ResearchGroupInfoComponent {
  // Effect to (re-)initialize when user data becomes available or the active
  // research group changes. A header switcher click updates
  // activeResearchGroupId, which flips researchGroupId here and re-fires init.
  initEffect = effect(() => {
    const currentUser = this.currentUser();
    const rgId = this.researchGroupId();
    if (!currentUser) {
      return;
    }
    if (this.initTracked && rgId === this.lastInitializedRgId) {
      return;
    }
    this.initTracked = true;
    this.lastInitializedRgId = rgId;
    this.hasInitialized.set(false);
    void this.init();
  });

  // State signals
  hasInitialized = signal<boolean>(false);
  departmentName = signal<string | null>(null);
  schoolName = signal<string | null>(null);

  // Computed properties
  researchGroupId = computed(() => this.accountService.activeResearchGroupId());
  savingState = computed<SavingState>(() => this.autoSave.state());

  // Reactive forms
  form = new FormGroup({
    name: new FormControl('', [Validators.required]),
    abbreviation: new FormControl(''),
    head: new FormControl('', [Validators.required]),
    website: new FormControl(''),
    email: new FormControl('', [Validators.email, Validators.pattern(/.+\..{2,}$/)]),
    city: new FormControl(''),
    postalCode: new FormControl(''),
    address: new FormControl(''),
    description: new FormControl(''),
  });

  readonly autoSave = new AutoSaveController({ save: () => this.performAutoSave() });

  private initTracked = false;
  private lastInitializedRgId: string | undefined;
  private latestInitRequestId = 0;

  // Services
  private accountService = inject(AccountService);
  private researchGroupApi = inject(ResearchGroupResourceApi);
  private departmentApi = inject(DepartmentResourceApi);
  private toastService = inject(ToastService);
  private translate = inject(TranslateService);

  private readonly translationKey = 'researchGroup.groupInfo';

  private currentUser = this.accountService.loadedUser;

  // 1) Whenever the form mutates after the initial load, debounce-save it.
  // 2) Mutations triggered by `populateFormData` are gated by `hasInitialized`,
  //    so loading the data does not trigger a write back to the server.
  private readonly autoSaveOnFormChange = this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
    if (this.hasInitialized() && this.form.valid) {
      this.autoSave.notifyChanged();
    }
  });

  /**
   * Persists the current form values to the API. Invoked by the
   * {@link AutoSaveController} once the debounce timer fires.
   *
   * @returns true on success, false if no research group is bound or the
   *   request fails
   */
  private async performAutoSave(): Promise<boolean> {
    const researchGroupId = this.researchGroupId();
    if (researchGroupId == null || researchGroupId.trim() === '') {
      return false;
    }

    try {
      const formValue = this.form.value;
      const updateData: ResearchGroupDTO = {
        name: formValue.name ?? '',
        abbreviation: formValue.abbreviation ?? '',
        head: formValue.head ?? '',
        email: formValue.email ?? '',
        website: formValue.website ?? '',
        description: formValue.description ?? '',
        street: formValue.address ?? '',
        postalCode: formValue.postalCode ?? '',
        city: formValue.city ?? '',
      };

      await firstValueFrom(this.researchGroupApi.updateResearchGroup(researchGroupId, updateData));
      return true;
    } catch {
      this.toastService.showError({
        detail: this.translate.instant(`${this.translationKey}.toasts.saveFailed`),
      });
      return false;
    }
  }

  /**
   * Initializes the form data by fetching the research group data from the API.
   * Uses a request-id counter so a fast group switch can't let an older fetch
   * overwrite the form with stale data.
   */
  private async init(): Promise<void> {
    const requestId = ++this.latestInitRequestId;
    try {
      const researchGroupId = this.researchGroupId();

      if (researchGroupId == null || researchGroupId.trim() === '') {
        // No research group ID available, leave form empty
        return;
      }

      const researchGroup = await firstValueFrom(this.researchGroupApi.getResearchGroup(researchGroupId));
      if (requestId !== this.latestInitRequestId) {
        return;
      }
      this.populateFormData(researchGroup);

      // Fetch department info if departmentId exists
      if (researchGroup.departmentId != null) {
        await this.loadDepartmentInfo(researchGroup.departmentId);
      }
    } catch {
      if (requestId !== this.latestInitRequestId) {
        return;
      }
      this.toastService.showError({
        summary: this.translate.instant(`${this.translationKey}.toasts.loadFailed`),
        detail: this.translate.instant(`${this.translationKey}.toasts.loadFailed`),
      });
    } finally {
      if (requestId === this.latestInitRequestId) {
        this.hasInitialized.set(true);
      }
    }
  }

  /**
   * Loads department and school information from the API.
   */
  private async loadDepartmentInfo(departmentId: string): Promise<void> {
    try {
      const department = await firstValueFrom(this.departmentApi.getDepartmentById(departmentId));
      this.departmentName.set(department.name ?? null);
      this.schoolName.set(department.school?.name ?? null);
    } catch {
      // Silently fail - the organization info is optional display-only data
      this.departmentName.set(null);
      this.schoolName.set(null);
    }
  }

  /**
   * Populates the form data with the given research group data.
   */
  private populateFormData(data?: ResearchGroupDTO): void {
    this.form.patchValue({
      name: data?.name,
      abbreviation: data?.abbreviation,
      head: data?.head,
      email: data?.email,
      website: data?.website,
      city: data?.city,
      postalCode: data?.postalCode,
      address: data?.street,
      description: data?.description,
    });
    this.form.updateValueAndValidity();
  }
}
