import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ResearchGroupResourceApi } from 'app/generated/api/research-group-resource-api';
import { DepartmentResourceApi } from 'app/generated/api/department-resource-api';
import { ResearchGroupDTO } from 'app/generated/model/research-group-dto';
import { DepartmentDTO } from 'app/generated/model/department-dto';
import { ToastService } from 'app/service/toast-service';
import { BackButtonComponent } from 'app/shared/components/atoms/back-button/back-button.component';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { EditorComponent } from 'app/shared/components/atoms/editor/editor.component';
import { InfoBoxComponent } from 'app/shared/components/atoms/info-box/info-box.component';
import { StringInputComponent } from 'app/shared/components/atoms/string-input/string-input.component';
import { SelectComponent, SelectOption } from 'app/shared/components/atoms/select/select.component';
import { DividerComponent } from 'app/shared/components/atoms/divider/divider.component';
import { firstValueFrom } from 'rxjs';
import { TranslateDirective } from 'app/shared/language';

@Component({
  selector: 'jhi-research-group-detail-view.component',
  imports: [
    TranslateModule,
    TranslateDirective,
    StringInputComponent,
    SelectComponent,
    BackButtonComponent,
    ButtonComponent,
    ReactiveFormsModule,
    DividerComponent,
    EditorComponent,
    InfoBoxComponent,
  ],
  templateUrl: './research-group-detail-view.component.html',
})
export class ResearchGroupDetailViewComponent implements OnInit {
  form = new FormGroup({
    abbreviation: new FormControl(''),
    name: new FormControl('', [Validators.required]),
    departmentId: new FormControl('', [Validators.required]),
    head: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.email, Validators.pattern(/.+\..{2,}$/)]),
    website: new FormControl(''),
    description: new FormControl(''),
    city: new FormControl(''),
    postalCode: new FormControl(''),
    street: new FormControl(''),
  });

  researchGroupId = computed(() => this.routeParamMap().get('researchGroupId') ?? undefined);

  isSaving = signal<boolean>(false);
  isLoading = signal<boolean>(true);

  // Department data
  departments = signal<DepartmentDTO[]>([]);
  selectedDepartmentId = signal<string | undefined>(undefined);

  departmentOptions = computed<SelectOption[]>(() =>
    this.departments().map(dept => ({
      name: dept.name ?? '',
      value: dept.departmentId ?? '',
    })),
  );

  selectedDepartmentOption = computed<SelectOption | undefined>(() => {
    const deptId = this.selectedDepartmentId();
    if (deptId == null || deptId === '') return undefined;
    return this.departmentOptions().find(opt => opt.value === deptId);
  });

  readonly researchGroupApi = inject(ResearchGroupResourceApi);
  private readonly departmentApi = inject(DepartmentResourceApi);
  private toastService = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly routeParamMap = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  ngOnInit(): void {
    void this.loadDepartments();
    void this.init();
  }

  async loadDepartments(): Promise<void> {
    try {
      const departments = await firstValueFrom(this.departmentApi.getDepartments());
      this.departments.set(departments);
    } catch {
      this.toastService.showErrorKey('researchGroup.detailView.errors.loadDepartments');
    }
  }

  onDepartmentChange(option: SelectOption): void {
    const deptId = option.value as string;
    this.selectedDepartmentId.set(deptId);
    this.form.patchValue({ departmentId: deptId });
  }

  async onSave(): Promise<void> {
    if (!this.form.valid) {
      return;
    }

    const researchGroupId = this.researchGroupId();
    if (researchGroupId == null || researchGroupId.trim() === '') {
      this.toastService.showErrorKey('researchGroup.detailView.errors.noId');
      return;
    }

    try {
      this.isSaving.set(true);

      const formValue = this.form.value;
      const updateData: ResearchGroupDTO = {
        name: formValue.name ?? '',
        abbreviation: formValue.abbreviation ?? '',
        head: formValue.head ?? '',
        email: formValue.email ?? '',
        website: formValue.website ?? '',
        description: formValue.description ?? '',
        street: formValue.street ?? '',
        postalCode: formValue.postalCode ?? '',
        city: formValue.city ?? '',
        departmentId: formValue.departmentId ?? undefined,
      };

      await firstValueFrom(this.researchGroupApi.updateResearchGroup(researchGroupId, updateData));

      this.toastService.showSuccessKey('researchGroup.detailView.success.updated');
    } catch {
      this.toastService.showErrorKey('researchGroup.detailView.errors.save');
    } finally {
      this.isSaving.set(false);
    }
  }

  private async init(): Promise<void> {
    const researchGroupId = this.researchGroupId();
    if (researchGroupId == null || researchGroupId.trim() === '') {
      // No research group ID available, leave form empty
      this.isLoading.set(false);
      return;
    }

    try {
      const researchGroup = await firstValueFrom(this.researchGroupApi.getResearchGroup(researchGroupId));
      this.populateFormData(researchGroup);
    } catch {
      this.toastService.showErrorKey('researchGroup.detailView.errors.view');
    } finally {
      this.isLoading.set(false);
    }
  }

  private populateFormData(data?: ResearchGroupDTO): void {
    this.form.patchValue({
      abbreviation: data?.abbreviation ?? '',
      name: data?.name ?? '',
      head: data?.head ?? '',
      email: data?.email ?? '',
      website: data?.website ?? '',
      description: data?.description ?? '',
      city: data?.city ?? '',
      postalCode: data?.postalCode ?? '',
      street: data?.street ?? '',
      departmentId: data?.departmentId ?? '',
    });

    // Set selected department for the dropdown (selectedDepartmentOption is computed automatically)
    if (data?.departmentId != null) {
      this.selectedDepartmentId.set(data.departmentId);
    }

    this.form.updateValueAndValidity();
  }
}
