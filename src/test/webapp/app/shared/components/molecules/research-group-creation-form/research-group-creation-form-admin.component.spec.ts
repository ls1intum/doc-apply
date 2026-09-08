import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { of, throwError } from 'rxjs';

import { ResearchGroupCreationFormComponent } from 'app/shared/components/molecules/research-group-creation-form/research-group-creation-form.component';
import { ResearchGroupResourceApi } from 'app/generated/api/research-group-resource-api';
import { ProfOnboardingResourceApi } from 'app/generated/api/prof-onboarding-resource-api';
import { SchoolResourceApi } from 'app/generated/api/school-resource-api';
import { DepartmentResourceApi } from 'app/generated/api/department-resource-api';
import { UserResourceApi } from 'app/generated/api/user-resource-api';
import { provideTranslateMock } from 'util/translate.mock';
import { ResearchGroupDTO } from 'app/generated/model/research-group-dto';
import { KeycloakUserDTO } from 'app/generated/model/keycloak-user-dto';
import { SchoolShortDTO } from 'app/generated/model/school-short-dto';
import { DepartmentDTO } from 'app/generated/model/department-dto';
import { UserShortDTO } from 'app/generated/model/user-short-dto';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { createToastServiceMock, provideToastServiceMock, ToastServiceMock } from 'util/toast-service.mock';
import { createDynamicDialogRefMock, DynamicDialogRefMock, provideDynamicDialogRefMock } from 'util/dynamicdialogref.mock';
import { createDynamicDialogConfigMock, provideDynamicDialogConfigMock } from 'util/dynamicdialogref.mock';
import { HttpErrorResponse } from '@angular/common/http';
import { provideHttpClientMock } from 'util/http-client.mock';

/**
 * Test suite for ResearchGroupCreationFormComponent - Admin Mode
 * Tests admin-specific functionality for creating research groups
 * Admins can create research groups directly (ACTIVE state)
 * Personal information fields are disabled in admin mode
 */
describe('ResearchGroupCreationFormComponent - Admin Mode', () => {
  let component: ResearchGroupCreationFormComponent;
  let fixture: ComponentFixture<ResearchGroupCreationFormComponent>;

  let mockDialogRef: DynamicDialogRefMock;
  let mockDialogConfig: Partial<DynamicDialogConfig>;
  let mockResearchGroupService: Partial<ResearchGroupResourceApi>;
  let mockProfOnboardingService: Partial<ProfOnboardingResourceApi>;
  let mockSchoolService: Partial<SchoolResourceApi>;
  let mockDepartmentService: Partial<DepartmentResourceApi>;
  let mockUserService: Partial<UserResourceApi>;
  let mockGetCurrentUser: ReturnType<typeof vi.fn>;
  let getAvailableUsersForResearchGroupMock: ReturnType<typeof vi.fn>;
  let mockToastService: ToastServiceMock;

  beforeEach(async () => {
    mockDialogRef = createDynamicDialogRefMock();
    mockDialogConfig = createDynamicDialogConfigMock({ mode: 'admin' });

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
    getAvailableUsersForResearchGroupMock = vi.fn(() => of({ content: [], totalElements: 0 }));
    mockUserService = {
      getCurrentUser: mockGetCurrentUser as unknown as UserResourceApi['getCurrentUser'],
      getAvailableUsersForResearchGroup:
        getAvailableUsersForResearchGroupMock as unknown as UserResourceApi['getAvailableUsersForResearchGroup'],
    } as unknown as UserResourceApi;

    await TestBed.configureTestingModule({
      imports: [ResearchGroupCreationFormComponent, ReactiveFormsModule],
      providers: [
        provideTranslateMock(),
        provideFontAwesomeTesting(),
        provideToastServiceMock(mockToastService),
        provideDynamicDialogRefMock(mockDialogRef),
        provideDynamicDialogConfigMock(mockDialogConfig),
        provideHttpClientMock(),
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
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  /**
   * Helper function to fill the form with valid data for admin mode
   * @param overrides - Optional field overrides for specific test scenarios
   */
  function fillValidForm(overrides: Record<string, unknown> = {}): void {
    component.form.patchValue(
      Object.assign(
        {
          tumID: 'ab12cde',
          researchGroupHead: 'Prof. Dr. Admin Test',
          researchGroupName: 'Admin Research Group',
          departmentId: 'dept-1',
        },
        overrides,
      ),
    );
  }

  describe('Admin Mode', () => {
    it('should not request current user prefill data in admin mode', () => {
      expect(mockGetCurrentUser).not.toHaveBeenCalled();
    });

    it('should disable personal information fields in admin mode', () => {
      expect(component.form.get('title')?.disabled).toBe(true);
      expect(component.form.get('firstName')?.disabled).toBe(true);
      expect(component.form.get('lastName')?.disabled).toBe(true);
      expect(component.form.get('additionalNotes')?.disabled).toBe(true);
    });

    it('should call createResearchGroupAsAdmin and show admin success toast in admin mode', async () => {
      fillValidForm();

      component.onConfirmSubmit();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockResearchGroupService.createResearchGroupAsAdmin).toHaveBeenCalledOnce();
      expect(mockResearchGroupService.createProfessorResearchGroupRequest).not.toHaveBeenCalled();
      expect(mockToastService.showSuccessKey).toHaveBeenCalledWith('researchGroup.adminView.success.create');
    });

    it('should close dialog with result after successful admin creation', async () => {
      const expectedResult = { researchGroupId: 'admin-test-id' } as Partial<ResearchGroupDTO> as ResearchGroupDTO;
      mockResearchGroupService.createResearchGroupAsAdmin = vi.fn(() =>
        of(expectedResult),
      ) as unknown as typeof mockResearchGroupService.createResearchGroupAsAdmin;

      fillValidForm();

      component.onConfirmSubmit();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockDialogRef.close).toHaveBeenCalledWith(expectedResult);
    });

    it.each<[number | undefined, string | undefined, string]>([
      [undefined, 'Creation failed', 'researchGroup.adminView.errors.create'],
      [409, 'Research group already exists', 'researchGroup.adminView.errors.duplicateName'],
      [404, 'User with universityId "invalid" not found', 'researchGroup.adminView.errors.userNotFound'],
      [
        400,
        "User with universityId 'aa00bka' is already a member of research group 'Existing Group'",
        'researchGroup.adminView.errors.userAlreadyMember',
      ],
    ])('should map error status %i with message %s to toast key %s', async (status, message, expectedKey) => {
      const error = new HttpErrorResponse(status !== undefined ? { status, error: { message } } : { error: message });
      mockResearchGroupService.createResearchGroupAsAdmin = vi.fn(() => throwError(() => error));

      fillValidForm();

      component.onConfirmSubmit();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith(expectedKey);
    });

    it('should not close dialog and not call confirmOnboarding when submission fails in admin mode', async () => {
      mockResearchGroupService.createResearchGroupAsAdmin = vi.fn(() =>
        throwError(() => new HttpErrorResponse({ error: 'Creation failed' })),
      );

      fillValidForm();

      component.onConfirmSubmit();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(mockProfOnboardingService.confirmOnboarding).not.toHaveBeenCalled();
    });

    it.each(['invalid form', 'already submitting'])('should not submit in admin mode when %s', desc => {
      if (desc === 'invalid form') {
        fillValidForm({ tumID: '' });
      } else {
        component.isSubmitting.set(true);
        fillValidForm();
      }

      component.onConfirmSubmit();

      expect(mockResearchGroupService.createResearchGroupAsAdmin).not.toHaveBeenCalled();
    });

    it('should load admin professor candidates when search query is long enough', async () => {
      const candidates: KeycloakUserDTO[] = [
        {
          id: '1d8e3025-cf70-4f7a-b510-e9fbe7f4f123',
          firstName: 'Alice',
          lastName: 'Professor',
          email: 'alice.prof@tum.de',
          universityId: 'ab12cde',
          username: 'alice.prof',
        },
      ];
      getAvailableUsersForResearchGroupMock.mockReturnValue(of({ content: candidates, totalElements: 1 }));

      await component.onAdminProfessorSearch('alice');

      expect(getAvailableUsersForResearchGroupMock).toHaveBeenCalledWith(25, 0, 'alice', undefined, true);
      expect(component.adminProfessorCandidates()).toEqual(candidates);
      expect(component.isLoadingAdminUsers()).toBe(false);
    });

    it('should not call user service when admin search query is too short', async () => {
      await component.onAdminProfessorSearch('al');

      expect(getAvailableUsersForResearchGroupMock).not.toHaveBeenCalled();
      expect(component.adminProfessorCandidates()).toEqual([]);
    });

    it('should show toast when admin professor search fails', async () => {
      getAvailableUsersForResearchGroupMock.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

      await component.onAdminProfessorSearch('alice');

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('researchGroup.members.toastMessages.loadUsersFailed');
      expect(component.isLoadingAdminUsers()).toBe(false);
    });

    it('should select and clear an admin professor, copying and resetting tumID', () => {
      const selectedProfessor: KeycloakUserDTO = {
        id: '2c4f7b39-102f-4b9a-a1ba-33f3388d7744',
        firstName: 'Bob',
        lastName: 'Professor',
        email: 'bob.prof@tum.de',
        universityId: 'xy34zab',
        username: 'bob.prof',
      };

      component.selectAdminProfessor(selectedProfessor);
      expect(component.selectedAdminProfessor()).toEqual(selectedProfessor);
      expect(component.form.get('tumID')?.value).toBe('xy34zab');

      component.clearSelectedAdminProfessor();
      expect(component.selectedAdminProfessor()).toBeUndefined();
      expect(component.form.get('tumID')?.value).toBe('');
      expect(component.adminProfessorCandidates()).toEqual([]);
    });

    it('should submit selected admin professor universityId in payload', async () => {
      const selectedProfessor: KeycloakUserDTO = {
        id: 'a2d43009-9c94-4b61-bf00-c89f02f4f1a2',
        firstName: 'Dana',
        lastName: 'Professor',
        email: 'dana.prof@tum.de',
        universityId: 'mn78opq',
        username: 'dana.prof',
      };

      fillValidForm({ tumID: '' });
      component.selectAdminProfessor(selectedProfessor);

      component.onConfirmSubmit();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockResearchGroupService.createResearchGroupAsAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          universityId: 'mn78opq',
        }),
      );
    });
  });

  describe('onSchoolChange', () => {
    it('should clear department when changing to a school it does not belong to', () => {
      component.selectedDepartmentId.set('dept-1');
      component.form.patchValue({ departmentId: 'dept-1' });

      component.onSchoolChange({ value: 'school-2', name: 'Test School 2' });

      expect(component.selectedSchoolId()).toBe('school-2');
      expect(component.selectedDepartmentId()).toBeUndefined();
      expect(component.form.get('departmentId')?.value).toBe('');
    });

    it('should keep department when changing to its own school', () => {
      component.selectedDepartmentId.set('dept-1');
      component.form.patchValue({ departmentId: 'dept-1' });

      component.onSchoolChange({ value: 'school-1', name: 'Test School 1' });

      expect(component.selectedSchoolId()).toBe('school-1');
      expect(component.selectedDepartmentId()).toBe('dept-1');
    });
  });

  describe('onDepartmentChange', () => {
    it('should auto-update school filter when selecting a department from a different school', () => {
      component.selectedSchoolId.set('school-1');

      component.onDepartmentChange({ value: 'dept-2', name: 'Test Department 2' });

      expect(component.selectedDepartmentId()).toBe('dept-2');
      expect(component.selectedSchoolId()).toBe('school-2');
    });

    it('should set department without changing school when department has no school', () => {
      component.departments.set([
        { departmentId: 'dept-no-school', name: 'Department Without School' } as Partial<DepartmentDTO> as DepartmentDTO,
      ]);

      component.onDepartmentChange({ value: 'dept-no-school', name: 'Department Without School' });

      expect(component.selectedDepartmentId()).toBe('dept-no-school');
    });
  });

  describe('onCancel', () => {
    it('should close dialog when cancel is clicked in admin mode', () => {
      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledOnce();
    });
  });
});
