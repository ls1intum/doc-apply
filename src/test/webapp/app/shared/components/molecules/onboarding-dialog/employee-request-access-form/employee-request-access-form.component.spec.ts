import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { EmployeeRequestAccessFormComponent } from 'app/shared/components/molecules/onboarding-dialog/employee-request-access-form/employee-request-access-form.component';
import { ResearchGroupResourceApi } from 'app/generated/api/research-group-resource-api';
import { ProfOnboardingResourceApi } from 'app/generated/api/prof-onboarding-resource-api';
import { createToastServiceMock, provideToastServiceMock, ToastServiceMock } from 'util/toast-service.mock';
import { createDialogServiceMock, DialogServiceMock, provideDialogServiceMock } from 'util/dialog.service.mock';
import { createDialogRefMock, DialogRefMock, provideDialogRefMock } from 'util/dialog-ref.mock';
import { provideTranslateMock } from 'util/translate.mock';
import {
  createOnboardingOrchestratorServiceMock,
  OnboardingOrchestratorServiceMock,
  provideOnboardingOrchestratorServiceMock,
} from 'util/onboarding-orchestrator.service.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { OnboardingDialog } from 'app/shared/components/molecules/onboarding-dialog/onboarding-dialog';

describe('EmployeeRequestAccessFormComponent', () => {
  let component: EmployeeRequestAccessFormComponent;
  let fixture: ComponentFixture<EmployeeRequestAccessFormComponent>;

  let mockDialogRef: DialogRefMock;
  let mockDialogService: DialogServiceMock;
  let mockResearchGroupService: Partial<ResearchGroupResourceApi>;
  let mockProfOnboardingService: Partial<ProfOnboardingResourceApi>;
  let mockToastService: ToastServiceMock;
  let onboardingOrchestrator: OnboardingOrchestratorServiceMock;

  beforeEach(async () => {
    onboardingOrchestrator = createOnboardingOrchestratorServiceMock();
    mockDialogRef = createDialogRefMock();

    mockDialogService = createDialogServiceMock();

    mockToastService = createToastServiceMock();

    mockResearchGroupService = {
      createEmployeeResearchGroupRequest: vi.fn(() => of({ researchGroupId: 'test-id' } as unknown as void)),
    };

    mockProfOnboardingService = {
      confirmOnboarding: vi.fn(() => of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [EmployeeRequestAccessFormComponent, ReactiveFormsModule],
      providers: [
        provideTranslateMock(),
        provideFontAwesomeTesting(),
        provideToastServiceMock(mockToastService),
        provideDialogServiceMock(mockDialogService),
        provideDialogRefMock(mockDialogRef),
        provideOnboardingOrchestratorServiceMock(onboardingOrchestrator),
        { provide: ResearchGroupResourceApi, useValue: mockResearchGroupService },
        { provide: ProfOnboardingResourceApi, useValue: mockProfOnboardingService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EmployeeRequestAccessFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Form Validation', () => {
    it('should enforce required and minimum length 3 on professorName', () => {
      const control = component.employeeForm.get('professorName');
      control?.setValue('');
      expect(control?.hasError('required')).toBe(true);
      control?.setValue('ab');
      expect(control?.hasError('minlength')).toBe(true);
      control?.setValue('abc');
      expect(component.employeeForm.valid).toBe(true);
    });
  });

  describe('onSubmit', () => {
    it('should not submit when form is invalid', () => {
      component.employeeForm.patchValue({ professorName: '' });

      component.onSubmit();

      expect(mockResearchGroupService.createEmployeeResearchGroupRequest).not.toHaveBeenCalled();
    });

    it('should not submit when already submitting', () => {
      component.employeeForm.patchValue({ professorName: 'Prof. Smith' });
      component.isSubmitting.set(true);

      component.onSubmit();

      expect(mockResearchGroupService.createEmployeeResearchGroupRequest).not.toHaveBeenCalled();
    });

    it('should call research group service with trimmed name, confirm onboarding, show success toast and close dialog after success', async () => {
      component.employeeForm.patchValue({ professorName: '  Prof. Smith  ' });

      component.onSubmit();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockResearchGroupService.createEmployeeResearchGroupRequest).toHaveBeenCalledWith({ professorName: 'Prof. Smith' });
      expect(mockProfOnboardingService.confirmOnboarding).toHaveBeenCalledOnce();
      expect(onboardingOrchestrator.markAccessRequestPending).toHaveBeenCalledOnce();
      expect(mockToastService.showSuccessKey).toHaveBeenCalledWith('onboarding.employeeRequest.success');
      expect(mockDialogRef.close).toHaveBeenCalledOnce();
      expect(component.isSubmitting()).toBe(false);
    });

    it('should set isSubmitting to true during pending submission', () => {
      component.employeeForm.patchValue({ professorName: 'Prof. Smith' });

      component.onSubmit();

      expect(component.isSubmitting()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it.each([
      ['an unexpected error', new Error('Request failed'), 'onboarding.employeeRequest.error'],
      [
        'a pending request',
        new HttpErrorResponse({ status: 400, error: { errorCode: 'OPERATION_NOT_ALLOWED' } }),
        'onboarding.pendingRequest',
      ],
    ])('should show the matching error toast, not close dialog and not confirm onboarding on %s', async (_case, error, expectedKey) => {
      mockResearchGroupService.createEmployeeResearchGroupRequest = vi.fn(() => throwError(() => error));
      component.employeeForm.patchValue({ professorName: 'Prof. Smith' });

      component.onSubmit();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith(expectedKey);
      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(mockProfOnboardingService.confirmOnboarding).not.toHaveBeenCalled();
      expect(component.isSubmitting()).toBe(false);
    });
  });

  describe('onCancel', () => {
    it('should close dialog when cancel is clicked', () => {
      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledOnce();
    });
  });

  describe('onBack', () => {
    it('should close current dialog and reopen main onboarding dialog', () => {
      component.onBack();

      expect(mockDialogRef.close).toHaveBeenCalledOnce();
      expect(mockDialogService.open).toHaveBeenCalledWith(
        OnboardingDialog,
        expect.objectContaining({ styleClass: 'w-225', maxWidthClass: 'max-w-[95vw]', header: 'onboarding.title' }),
      );
    });
  });
});
