import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingDialog } from 'app/shared/components/molecules/onboarding-dialog/onboarding-dialog';
import { ProfOnboardingResourceApi } from 'app/generated/api/prof-onboarding-resource-api';
import { ResearchGroupCreationFormComponent } from 'app/shared/components/molecules/research-group-creation-form/research-group-creation-form.component';
import { onboardingDialogOptions } from 'app/shared/constants/onboarding-dialog.constants';
import { provideTranslateMock } from 'util/translate.mock';
import { EmployeeRequestAccessFormComponent } from 'app/shared/components/molecules/onboarding-dialog/employee-request-access-form/employee-request-access-form.component';
import { of } from 'rxjs/internal/observable/of';
import { createDialogServiceMock, DialogServiceMock, provideDialogServiceMock } from 'util/dialog.service.mock';
import { createDialogRefMock, DialogRefMock, provideDialogRefMock } from 'util/dialog-ref.mock';

describe('OnboardingDialog', () => {
  let component: OnboardingDialog;
  let fixture: ComponentFixture<OnboardingDialog>;

  let mockDialogService: DialogServiceMock;
  let mockDialogRef: DialogRefMock;
  let mockProfOnboardingService: Partial<ProfOnboardingResourceApi>;

  beforeEach(async () => {
    mockDialogService = createDialogServiceMock();

    mockDialogRef = createDialogRefMock();

    mockProfOnboardingService = {
      confirmOnboarding: vi.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [OnboardingDialog],
      providers: [
        provideTranslateMock(),
        provideDialogServiceMock(mockDialogService),
        provideDialogRefMock(mockDialogRef),
        { provide: ProfOnboardingResourceApi, useValue: mockProfOnboardingService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OnboardingDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('markOnboarded', () => {
    it('should close the dialog and open the professor form when openForm is true', () => {
      component.markOnboarded(true);

      expect(mockDialogRef.close).toHaveBeenCalledOnce();
      expect(mockDialogService.open).toHaveBeenCalledWith(
        ResearchGroupCreationFormComponent,
        onboardingDialogOptions('onboarding.professorRequest.dialogTitle'),
      );
      expect(mockProfOnboardingService.confirmOnboarding).not.toHaveBeenCalled();
    });

    it('should close dialog and confirm onboarding when openForm is false', () => {
      component.markOnboarded(false);

      expect(mockDialogRef.close).toHaveBeenCalledOnce();
      expect(mockProfOnboardingService.confirmOnboarding).toHaveBeenCalledOnce();
      expect(mockDialogService.open).not.toHaveBeenCalled();
    });

    it('should default to opening form when no parameter is provided', () => {
      component.markOnboarded();
      expect(mockDialogService.open).toHaveBeenCalledOnce();
    });
  });

  describe('openEmployeeForm', () => {
    it('should close dialog and open employee form', () => {
      component.openEmployeeForm();

      expect(mockDialogRef.close).toHaveBeenCalledOnce();
      expect(mockDialogService.open).toHaveBeenCalledWith(
        EmployeeRequestAccessFormComponent,
        onboardingDialogOptions('onboarding.employeeRequest.dialogTitle'),
      );
    });
  });
});
