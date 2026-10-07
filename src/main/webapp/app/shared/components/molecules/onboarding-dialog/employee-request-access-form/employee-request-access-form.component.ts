import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { firstValueFrom } from 'rxjs';
import { StringInputComponent } from 'app/shared/components/atoms/string-input/string-input.component';
import { ButtonComponent } from 'app/shared/components//atoms/button/button.component';
import { ConfirmDialog } from 'app/shared/components//atoms/confirm-dialog/confirm-dialog';
import TranslateDirective from 'app/shared/language/translate.directive';
import { ToastService } from 'app/service/toast-service';
import { ResearchGroupResourceApi } from 'app/generated/api/research-group-resource-api';
import { ProfOnboardingResourceApi } from 'app/generated/api/prof-onboarding-resource-api';
import { ONBOARDING_FORM_DIALOG_CONFIG } from 'app/shared/constants/onboarding-dialog.constants';

import { OnboardingDialog } from '../onboarding-dialog';

@Component({
  selector: 'jhi-employee-request-access-form',
  imports: [ReactiveFormsModule, StringInputComponent, ButtonComponent, TranslateDirective, ConfirmDialog],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './employee-request-access-form.component.html',
})
export class EmployeeRequestAccessFormComponent {
  // Form
  employeeForm: FormGroup;

  // Loading state
  isSubmitting = signal(false);

  // Template references
  showConfirmDialog = signal(false);

  // Services
  private readonly fb = inject(FormBuilder);
  private readonly ref = inject(DynamicDialogRef, { optional: true });
  private readonly dialogService = inject(DialogService);
  private readonly translate = inject(TranslateService);
  private readonly researchGroupApi = inject(ResearchGroupResourceApi);
  private readonly profOnboardingApi = inject(ProfOnboardingResourceApi);
  private readonly toastService = inject(ToastService);

  constructor() {
    this.employeeForm = this.createEmployeeForm();
  }

  onSubmit(): void {
    if (this.employeeForm.valid) {
      this.showConfirmDialog.set(true);
    }
  }

  onConfirmSubmit(): void {
    if (this.employeeForm.valid && !this.isSubmitting()) {
      void this.submitEmployeeRequest();
    }
  }

  onCancel(): void {
    this.ref?.close();
  }

  onBack(): void {
    this.ref?.close();

    // Reopen the main onboarding dialog
    this.dialogService.open(OnboardingDialog, {
      ...ONBOARDING_FORM_DIALOG_CONFIG,
      header: this.translate.instant('onboarding.title'),
    });
  }

  private createEmployeeForm(): FormGroup {
    return this.fb.group({
      professorName: ['', [Validators.required, Validators.minLength(3)]],
    });
  }

  private async submitEmployeeRequest(): Promise<void> {
    this.isSubmitting.set(true);
    const professorName = this.employeeForm.get('professorName')?.value.trim();

    try {
      const requestData = { professorName };
      await firstValueFrom(this.researchGroupApi.createEmployeeResearchGroupRequest(requestData));

      await firstValueFrom(this.profOnboardingApi.confirmOnboarding());

      this.toastService.showSuccessKey('onboarding.employeeRequest.success');
      this.ref?.close();
    } catch {
      this.toastService.showErrorKey('onboarding.employeeRequest.error');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
