import { hasText } from 'app/shared/util/text.util';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { DepartmentResourceApi } from 'app/generated/api/department-resource-api';
import { SchoolResourceApi } from 'app/generated/api/school-resource-api';
import { DepartmentDTO } from 'app/generated/model/department-dto';
import { SchoolShortDTO } from 'app/generated/model/school-short-dto';
import { ToastService } from 'app/service/toast-service';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { StringInputComponent } from 'app/shared/components/atoms/string-input/string-input.component';
import { SelectComponent, SelectOption } from 'app/shared/components/atoms/select/select.component';
import { TranslateDirective } from 'app/shared/language';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'jhi-department-edit-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateDirective, ButtonComponent, StringInputComponent, SelectComponent],
  templateUrl: './department-edit-dialog.component.html',
})
export class DepartmentEditDialogComponent {
  isSubmitting = signal(false);
  schools = signal<SchoolShortDTO[]>([]);

  // Edit mode
  departmentId = signal<string | undefined>(undefined);
  isEditMode = computed(() => hasText(this.departmentId()));

  schoolOptions = computed<SelectOption[]>(() =>
    this.schools().map(school => ({
      name: school.name ?? '',
      value: school.schoolId ?? '',
    })),
  );

  selectedSchoolId = signal<string | undefined>(undefined);

  selectedSchoolOption = computed(() => {
    const schoolId = this.selectedSchoolId();
    if (!hasText(schoolId)) return undefined;
    return this.schoolOptions().find(opt => opt.value === schoolId);
  });

  form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    schoolId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly translationKey = 'researchGroup.departments.createDialog';

  private readonly config = inject(DynamicDialogConfig);
  private readonly ref = inject(DynamicDialogRef);
  private readonly departmentApi = inject(DepartmentResourceApi);
  private readonly schoolApi = inject(SchoolResourceApi);
  private readonly toastService = inject(ToastService);

  constructor() {
    const data = this.config.data as { department?: DepartmentDTO } | undefined;
    if (data?.department !== undefined) {
      this.departmentId.set(data.department.departmentId);
      this.form.patchValue({
        name: data.department.name,
        schoolId: data.department.school?.schoolId,
      });
      this.selectedSchoolId.set(data.department.school?.schoolId);
    }

    void this.loadSchools();
  }

  async loadSchools(): Promise<void> {
    try {
      const schools = await firstValueFrom(this.schoolApi.getAllSchools());
      this.schools.set(schools);
    } catch {
      this.toastService.showErrorKey(`${this.translationKey}.errors.loadSchoolsFailed`);
    }
  }

  onSchoolChange(option: SelectOption): void {
    this.selectedSchoolId.set(option.value as string);
    this.form.patchValue({ schoolId: option.value as string });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      return;
    }

    this.isSubmitting.set(true);
    const formValue = this.form.getRawValue();
    const dto = {
      name: formValue.name,
      schoolId: formValue.schoolId,
    };

    try {
      const departmentId = this.departmentId();
      if (this.isEditMode() && hasText(departmentId)) {
        await firstValueFrom(this.departmentApi.updateDepartment(departmentId, dto));
        this.toastService.showSuccessKey(`${this.translationKey}.success.updated`);
      } else {
        await firstValueFrom(this.departmentApi.createDepartment(dto));
        this.toastService.showSuccessKey(`${this.translationKey}.success.created`);
      }
      this.ref.close(true);
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 409) {
          this.toastService.showErrorKey(`${this.translationKey}.errors.duplicateName`);
        } else {
          this.toastService.showErrorKey(`${this.translationKey}.errors.createFailed`);
        }
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  onCancel(): void {
    this.ref.close(false);
  }
}
