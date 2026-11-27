import { Component, Signal, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { DialogRef, DialogService } from 'app/shared/dialog/dialog.service';
import { firstValueFrom } from 'rxjs';
import { StringInputComponent } from 'app/shared/components/atoms/string-input/string-input.component';
import { ButtonComponent } from 'app/shared/components//atoms/button/button.component';
import TranslateDirective from 'app/shared/language/translate.directive';
import { ToastService } from 'app/service/toast-service';
import { ResearchGroupResourceApi } from 'app/generated/api/research-group-resource-api';
import { ProfOnboardingResourceApi } from 'app/generated/api/prof-onboarding-resource-api';
import { onboardingDialogOptions } from 'app/shared/constants/onboarding-dialog.constants';
import { formSignal } from 'app/shared/util/form-signal.util';
import { describeMissingFields, findMissingFields } from 'app/shared/util/missing-fields.util';
import { injectTranslator } from 'app/shared/util/translate-signal.util';
import { OPERATION_NOT_ALLOWED_ERROR_CODE, getApiErrorCode } from 'app/shared/util/api-error.util';
import { OnboardingOrchestratorService } from 'app/service/onboarding-orchestrator.service';

import { OnboardingDialog } from '../onboarding-dialog';

@Component({
  selector: 'jhi-employee-request-access-form',
  imports: [ReactiveFormsModule, StringInputComponent, ButtonComponent, TranslateDirective],
  templateUrl: './employee-request-access-form.component.html',
})
export class EmployeeRequestAccessFormComponent {
  // Form
  employeeForm: FormGroup;
  readonly employeeFormInvalid: Signal<boolean>;
  readonly submitDisabledReason = computed(() => describeMissingFields(this.missingFields(), this.translator));

  // Loading state
  isSubmitting = signal(false);

  // Template references

  // Services
  private readonly fb = inject(FormBuilder);
  private readonly ref = inject(DialogRef, { optional: true });
  private readonly dialogService = inject(DialogService);
  private readonly translate = inject(TranslateService);
  private readonly researchGroupApi = inject(ResearchGroupResourceApi);
  private readonly profOnboardingApi = inject(ProfOnboardingResourceApi);
  private readonly toastService = inject(ToastService);
  private readonly onboardingOrchestrator = inject(OnboardingOrchestratorService);
  private readonly translator = injectTranslator();
  private readonly missingFields: Signal<string[]>;

  constructor() {
    this.employeeForm = this.createEmployeeForm();
    this.employeeFormInvalid = formSignal(this.employeeForm, form => form.invalid);
    this.missingFields = formSignal(this.employeeForm, form =>
      findMissingFields(form, { professorName: 'onboarding.employeeRequest.professorName.label' }),
    );
  }

  onSubmit(): void {
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
    this.dialogService.open(OnboardingDialog, onboardingDialogOptions(this.translate.instant('onboarding.title')));
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
      this.onboardingOrchestrator.markAccessRequestPending();

      await firstValueFrom(this.profOnboardingApi.confirmOnboarding());

      this.toastService.showSuccessKey('onboarding.employeeRequest.success');
      this.ref?.close();
    } catch (error) {
      const alreadyRequested = getApiErrorCode(error) === OPERATION_NOT_ALLOWED_ERROR_CODE;
      this.toastService.showErrorKey(alreadyRequested ? 'onboarding.pendingRequest' : 'onboarding.employeeRequest.error');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
