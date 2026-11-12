import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { EmployeeRequestAccessFormComponent } from 'app/shared/components/molecules/onboarding-dialog/employee-request-access-form/employee-request-access-form.component';
import { ResearchGroupResourceApi } from 'app/generated/api/research-group-resource-api';
import { ProfOnboardingResourceApi } from 'app/generated/api/prof-onboarding-resource-api';
import { createToastServiceMock, provideToastServiceMock, ToastServiceMock } from 'util/toast-service.mock';
import { createDialogServiceMock, DialogServiceMock, provideDialogServiceMock } from 'util/dialog.service.mock';
import { createDialogRefMock, DialogRefMock, provideDialogRefMock } from 'util/dialog-ref.mock';
import { provideTranslateMock } from 'util/translate.mock';
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

  beforeEach(async () => {
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
    it('should not trigger confirm dialog when form is invalid', () => {
      component.employeeForm.patchValue({ professorName: '' });

      component.onSubmit();

      expect(component.showConfirmDialog()).toBe(false);
    });

    it('should trigger confirm dialog when form is valid', () => {
      component.employeeForm.patchValue({ professorName: 'Prof. Smith' });

      component.onSubmit();

      expect(component.showConfirmDialog()).toBe(true);
    });
  });

  describe('onConfirmSubmit', () => {
    it('should not submit when form is invalid', () => {
      component.employeeForm.patchValue({ professorName: '' });

      component.onConfirmSubmit();

      expect(mockResearchGroupService.createEmployeeResearchGroupRequest).not.toHaveBeenCalled();
    });

    it('should not submit when already submitting', () => {
      component.employeeForm.patchValue({ professorName: 'Prof. Smith' });
      component.isSubmitting.set(true);

      component.onConfirmSubmit();

      expect(mockResearchGroupService.createEmployeeResearchGroupRequest).not.toHaveBeenCalled();
    });

    it('should call research group service with trimmed name, confirm onboarding, show success toast and close dialog after success', async () => {
      component.employeeForm.patchValue({ professorName: '  Prof. Smith  ' });

      component.onConfirmSubmit();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockResearchGroupService.createEmployeeResearchGroupRequest).toHaveBeenCalledWith({ professorName: 'Prof. Smith' });
      expect(mockProfOnboardingService.confirmOnboarding).toHaveBeenCalledOnce();
      expect(mockToastService.showSuccessKey).toHaveBeenCalledWith('onboarding.employeeRequest.success');
      expect(mockDialogRef.close).toHaveBeenCalledOnce();
      expect(component.isSubmitting()).toBe(false);
    });

    it('should set isSubmitting to true during pending submission', () => {
      component.employeeForm.patchValue({ professorName: 'Prof. Smith' });

      component.onConfirmSubmit();

      expect(component.isSubmitting()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should show error toast, not close dialog, not call confirmOnboarding and reset isSubmitting on failure', async () => {
      mockResearchGroupService.createEmployeeResearchGroupRequest = vi.fn(() => throwError(() => new Error('Request failed')));
      component.employeeForm.patchValue({ professorName: 'Prof. Smith' });

      component.onConfirmSubmit();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('onboarding.employeeRequest.error');
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
        expect.objectContaining({ width: '56.25rem', header: 'onboarding.title' }),
      );
    });
  });
});
