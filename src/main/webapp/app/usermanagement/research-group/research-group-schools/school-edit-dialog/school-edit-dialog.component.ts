import { hasText } from 'app/shared/util/text.util';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { SchoolResourceApi } from 'app/generated/api/school-resource-api';
import { ToastService } from 'app/service/toast-service';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { StringInputComponent } from 'app/shared/components/atoms/string-input/string-input.component';
import { TranslateDirective } from 'app/shared/language';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { SchoolShortDTO } from 'app/generated/model/school-short-dto';

@Component({
  selector: 'jhi-school-edit-dialog',
  imports: [ReactiveFormsModule, TranslateModule, TranslateDirective, ButtonComponent, StringInputComponent],
  templateUrl: './school-edit-dialog.component.html',
})
export class SchoolEditDialogComponent {
  isSubmitting = signal(false);

  schoolId = signal<string | undefined>(undefined);
  isEditMode = computed(() => hasText(this.schoolId()));

  form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    abbreviation: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly translationKey = 'researchGroup.schools.createDialog';

  private readonly config = inject(DynamicDialogConfig);
  private readonly ref = inject(DynamicDialogRef);
  private readonly schoolApi = inject(SchoolResourceApi);
  private readonly toastService = inject(ToastService);

  constructor() {
    const data = this.config.data as { school?: SchoolShortDTO } | undefined;
    if (data?.school !== undefined) {
      this.schoolId.set(data.school.schoolId);
      this.form.patchValue({
        name: data.school.name,
        abbreviation: data.school.abbreviation,
      });
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      return;
    }

    this.isSubmitting.set(true);
    const formValue = this.form.getRawValue();
    const dto = {
      name: formValue.name,
      abbreviation: formValue.abbreviation,
    };

    try {
      const schoolId = this.schoolId();
      if (this.isEditMode() && hasText(schoolId)) {
        await firstValueFrom(this.schoolApi.updateSchool(schoolId, dto));
        this.toastService.showSuccessKey(`${this.translationKey}.success.updated`);
      } else {
        await firstValueFrom(this.schoolApi.createSchool(dto));
        this.toastService.showSuccessKey(`${this.translationKey}.success.created`);
      }
      this.ref.close(true);
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 409) {
          this.toastService.showErrorKey(`${this.translationKey}.errors.duplicateNameOrAbbreviation`);
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
