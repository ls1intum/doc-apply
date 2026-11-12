import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { of, throwError } from 'rxjs';

import { ResearchGroupCreationFormComponent } from 'app/shared/components/molecules/research-group-creation-form/research-group-creation-form.component';
import { ResearchGroupResourceApi } from 'app/generated/api/research-group-resource-api';
import { ProfOnboardingResourceApi } from 'app/generated/api/prof-onboarding-resource-api';
import { SchoolResourceApi } from 'app/generated/api/school-resource-api';
import { DepartmentResourceApi } from 'app/generated/api/department-resource-api';
import { UserResourceApi } from 'app/generated/api/user-resource-api';
import { ResearchGroupDTO } from 'app/generated/model/research-group-dto';
import { SchoolShortDTO } from 'app/generated/model/school-short-dto';
import { DepartmentDTO } from 'app/generated/model/department-dto';
import { UserShortDTO } from 'app/generated/model/user-short-dto';
import { provideTranslateMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { createToastServiceMock, provideToastServiceMock, ToastServiceMock } from 'util/toast-service.mock';
import {
  createDialogRefMock,
  DialogRefMock,
  provideDialogRefMock,
  DialogDataMock,
  createComponentWithDialogData,
} from 'util/dialog-ref.mock';
import { createDialogDataMock, provideDialogDataMock } from 'util/dialog-ref.mock';
import { HttpErrorResponse } from '@angular/common/http';
import { provideHttpClientMock } from 'util/http-client.mock';

/**
 * Test suite for ResearchGroupCreationFormComponent - Professor Mode
 * Tests professor-specific functionality for creating research group requests
 * Professors create research group requests (DRAFT state) that require admin approval
 */
describe('ResearchGroupCreationFormComponent - Professor Mode', () => {
  let component: ResearchGroupCreationFormComponent;
  let fixture: ComponentFixture<ResearchGroupCreationFormComponent>;

  let mockDialogRef: DialogRefMock;
  let mockDialogConfig: DialogDataMock;
  let mockResearchGroupService: Partial<ResearchGroupResourceApi>;
  let mockProfOnboardingService: Partial<ProfOnboardingResourceApi>;
  let mockSchoolService: Partial<SchoolResourceApi>;
  let mockDepartmentService: Partial<DepartmentResourceApi>;
  let mockUserService: Partial<UserResourceApi>;
  let mockGetCurrentUser: ReturnType<typeof vi.fn>;
  let mockToastService: ToastServiceMock;

  beforeEach(async () => {
    mockDialogRef = createDialogRefMock();
    mockDialogConfig = createDialogDataMock({ mode: 'professor' });

    mockToastService = createToastServiceMock();

    mockResearchGroupService = {
      createProfessorResearchGroupRequest: vi.fn(() => of({ researchGroupId: 'test-id' } as Partial<ResearchGroupDTO> as ResearchGroupDTO)),
      createResearchGroupAsAdmin: vi.fn(() => of({ researchGroupId: 'admin-test-id' } as Partial<ResearchGroupDTO> as ResearchGroupDTO)),
    } as unknown as ResearchGroupResourceApi;

    mockProfOnboardingService = {
      confirmOnboarding: vi.fn(() => of(undefined)),
    } as unknown as ProfOnboardingResourceApi;

    mockSchoolService = {
      getAllSchools: vi.fn(() =>
        of([
          { schoolId: 'school-1', name: 'Test School 1' } as Partial<SchoolShortDTO> as SchoolShortDTO,
          { schoolId: 'school-2', name: 'Test School 2' } as Partial<SchoolShortDTO> as SchoolShortDTO,
        ]),
      ),
    } as unknown as SchoolResourceApi;

    mockDepartmentService = {
      getDepartments: vi.fn(() =>
        of([
          {
            departmentId: 'dept-1',
            name: 'Test Department 1',
            school: { schoolId: 'school-1' },
          } as Partial<DepartmentDTO> as DepartmentDTO,
          {
            departmentId: 'dept-2',
            name: 'Test Department 2',
            school: { schoolId: 'school-2' },
          } as Partial<DepartmentDTO> as DepartmentDTO,
        ]),
      ),
    } as unknown as DepartmentResourceApi;

    mockGetCurrentUser = vi.fn(() => of({} as UserShortDTO));
    mockUserService = {
      getCurrentUser: mockGetCurrentUser as unknown as UserResourceApi['getCurrentUser'],
    } as unknown as UserResourceApi;

    await TestBed.configureTestingModule({
      imports: [ResearchGroupCreationFormComponent, ReactiveFormsModule],
      providers: [
        provideTranslateMock(),
        provideFontAwesomeTesting(),
        provideHttpClientMock(),
        provideToastServiceMock(mockToastService),
        provideDialogRefMock(mockDialogRef),
        provideDialogDataMock(mockDialogConfig),
        { provide: ResearchGroupResourceApi, useValue: mockResearchGroupService },
        { provide: ProfOnboardingResourceApi, useValue: mockProfOnboardingService },
        { provide: SchoolResourceApi, useValue: mockSchoolService },
        { provide: DepartmentResourceApi, useValue: mockDepartmentService },
        { provide: UserResourceApi, useValue: mockUserService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResearchGroupCreationFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper function to fill the form with valid data
   * @param overrides - Optional field overrides for specific test scenarios
   */
  function fillValidForm(overrides: Record<string, unknown> = {}): void {
    component.form.patchValue(
      Object.assign(
        {
          title: 'Prof.',
          firstName: 'Max',
          lastName: 'Mustermann',
          tumID: 'ab12cde',
          researchGroupHead: 'Prof. Dr. Max Mustermann',
          researchGroupName: 'AI Research Group',
          departmentId: 'dept-1',
        },
        overrides,
      ),
    );
  }

  describe('Form Initialization', () => {
    it('should request current user data for professor prefill', () => {
      expect(mockGetCurrentUser).toHaveBeenCalledOnce();
    });

    it('should prefill professor fields from current user data, but not overwrite already-entered values', async () => {
      mockGetCurrentUser.mockReturnValue(
        of({
          firstName: 'Anna',
          lastName: 'Muster',
          email: 'anna.muster@tum.de',
          universityId: 'ab12cde',
        } as UserShortDTO),
      );

      await component['prefillProfessorData']();

      expect(component.form.get('firstName')?.value).toBe('Anna');
      expect(component.form.get('researchGroupHead')?.value).toBe('Anna Muster');
      expect(component.form.get('researchGroupContactEmail')?.value).toBe('anna.muster@tum.de');

      component.form.patchValue({ firstName: 'ManualFirst', researchGroupContactEmail: 'manual@tum.de' });
      mockGetCurrentUser.mockReturnValue(of({ firstName: 'OtherFirst', email: 'other@tum.de', universityId: 'ab12cde' } as UserShortDTO));

      await component['prefillProfessorData']();

      expect(component.form.get('firstName')?.value).toBe('ManualFirst');
      expect(component.form.get('researchGroupContactEmail')?.value).toBe('manual@tum.de');
    });
  });

  describe('Form Validation', () => {
    it.each<[string, string, boolean]>([
      ['researchGroupContactEmail', 'invalid-email', false],
      ['researchGroupContactEmail', 'valid@email.com', true],
      ['tumID', 'invalid', false],
      ['tumID', 'ab12cde', true],
    ])('should validate %s with value %s as %s', (field, value, expectedValid) => {
      const control = component.form.get(field);
      control?.setValue(value);
      expect(control?.valid).toBe(expectedValid);
    });

    it('should enforce max length on description field', () => {
      const descriptionControl = component.form.get('researchGroupDescription');

      descriptionControl?.setValue('a'.repeat(1001));
      expect(descriptionControl?.hasError('maxlength')).toBe(true);

      descriptionControl?.setValue('a'.repeat(1000));
      expect(descriptionControl?.valid).toBe(true);
    });
  });

  describe('onSubmit', () => {
    it('should toggle confirm dialog only when form is valid', () => {
      component.onSubmit();
      expect(component.showConfirmDialog()).toBe(false);

      fillValidForm();
      component.onSubmit();
      expect(component.showConfirmDialog()).toBe(true);
    });
  });

  describe('onConfirmSubmit', () => {
    beforeEach(() => {
      fillValidForm();
    });

    it.each(['invalid form', 'already submitting'] as const)('should not submit when %s', desc => {
      if (desc === 'invalid form') {
        component.form.patchValue({ title: '' });
      } else {
        component.isSubmitting.set(true);
      }

      component.onConfirmSubmit();

      expect(mockResearchGroupService.createProfessorResearchGroupRequest).not.toHaveBeenCalled();
    });

    it('should call research group service with trimmed and abbreviated data', async () => {
      fillValidForm({
        title: '  Prof.  ',
        firstName: '  Max  ',
        lastName: '  Mustermann  ',
        tumID: '  ab12cde  ',
        researchGroupHead: '  Prof. Dr. Max Mustermann  ',
        researchGroupName: '  AI Research Group  ',
        researchGroupAbbreviation: 'AIRG',
      });

      component.onConfirmSubmit();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockResearchGroupService.createProfessorResearchGroupRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Prof.',
          firstName: 'Max',
          lastName: 'Mustermann',
          universityId: 'ab12cde',
          researchGroupHead: 'Prof. Dr. Max Mustermann',
          researchGroupName: 'AI Research Group',
          abbreviation: 'AIRG',
        }),
      );
    });

    it('should normalize non-string values in optional fields to empty strings', async () => {
      fillValidForm({
        researchGroupWebsite: 12345,
        researchGroupAbbreviation: { some: 'object' },
      });

      component.onConfirmSubmit();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockResearchGroupService.createProfessorResearchGroupRequest).toHaveBeenCalledWith(
        expect.objectContaining({ website: '', abbreviation: '' }),
      );
    });

    it('should call confirmOnboarding, show success toast, close dialog and reset isSubmitting after successful submission', async () => {
      component.onConfirmSubmit();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockProfOnboardingService.confirmOnboarding).toHaveBeenCalledOnce();
      expect(mockToastService.showSuccessKey).toHaveBeenCalledWith('onboarding.professorRequest.success');
      expect(mockDialogRef.close).toHaveBeenCalledWith({ researchGroupId: 'test-id' });
      expect(component.isSubmitting()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      fillValidForm();
    });

    it('should show error toast, not close dialog, not call confirmOnboarding, and reset isSubmitting on failure', async () => {
      mockResearchGroupService.createProfessorResearchGroupRequest = vi.fn(() =>
        throwError(() => new HttpErrorResponse({ error: 'API Error' })),
      );

      component.onConfirmSubmit();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('onboarding.professorRequest.error');
      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(mockProfOnboardingService.confirmOnboarding).not.toHaveBeenCalled();
      expect(component.isSubmitting()).toBe(false);
    });

    it.each([
      [409, 'Research group already exists', 'onboarding.professorRequest.errorDuplicateName'],
      [500, 'Research group already exists in database', 'onboarding.professorRequest.errorDuplicateName'],
      [404, 'User with universityId "ab12abc" not found', 'onboarding.professorRequest.errorUserNotFound'],
      [500, undefined, 'onboarding.professorRequest.error'],
    ])('should map status %i with message %s to toast key %s', async (status, message, expectedKey) => {
      const error = new HttpErrorResponse({ status, error: message ? { message } : undefined });
      mockResearchGroupService.createProfessorResearchGroupRequest = vi.fn(() => throwError(() => error));

      component.onConfirmSubmit();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith(expectedKey);
    });
  });

  describe('onCancel', () => {
    it('should close dialog when cancel is clicked', () => {
      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledOnce();
    });
  });

  describe('Edge Cases', () => {
    it.each([
      {
        desc: 'null',
        overrides: { researchGroupAbbreviation: null, researchGroupWebsite: null },
        expected: { abbreviation: '', website: '' },
      },
      {
        desc: 'undefined',
        overrides: { researchGroupAbbreviation: undefined, researchGroupContactEmail: undefined },
        expected: { abbreviation: '', contactEmail: '' },
      },
      {
        desc: 'whitespace-only',
        overrides: {
          researchGroupAbbreviation: '   ',
          researchGroupWebsite: '  ',
          researchGroupCity: '    ',
          researchGroupDescription: '\t\n',
        },
        expected: { abbreviation: '', website: '', city: '', description: '' },
      },
    ])('should normalize $desc values in optional fields to empty strings', async ({ overrides, expected }) => {
      fillValidForm(overrides);

      component.onConfirmSubmit();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockResearchGroupService.createProfessorResearchGroupRequest).toHaveBeenCalledWith(expect.objectContaining(expected));
    });
  });

  describe('Professor Mode', () => {
    it('should call createProfessorResearchGroupRequest and not the admin endpoint', async () => {
      fillValidForm();

      component.onConfirmSubmit();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockResearchGroupService.createProfessorResearchGroupRequest).toHaveBeenCalledOnce();
      expect(mockResearchGroupService.createResearchGroupAsAdmin).not.toHaveBeenCalled();
    });

    it('should use mode from dialog config data', () => {
      const newComponent = createComponentWithDialogData(ResearchGroupCreationFormComponent, { mode: 'admin' }).instance;

      expect(newComponent.mode()).toBe('admin');
    });
  });
});
