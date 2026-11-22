import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DepartmentEditDialogComponent } from 'app/usermanagement/research-group/research-group-departments/department-edit-dialog/department-edit-dialog.component';
import { provideTranslateMock } from 'util/translate.mock';
import { createToastServiceMock, provideToastServiceMock } from 'util/toast-service.mock';
import { createDialogDataMock, createDialogRefMock, provideDialogDataMock, provideDialogRefMock } from 'util/dialog-ref.mock';
import { createDepartmentResourceApiMock, provideDepartmentResourceApiMock } from 'util/department-resource-api.service.mock';
import { createSchoolResourceApiMock, provideSchoolResourceApiMock } from 'util/school-resource-api.service.mock';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { SchoolShortDTO } from 'app/generated/model/school-short-dto';
import { describe, it, expect, beforeEach } from 'vitest';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';

describe('DepartmentEditDialogComponent', () => {
  let component: DepartmentEditDialogComponent;
  let fixture: ComponentFixture<DepartmentEditDialogComponent>;
  let mockDepartmentApi: ReturnType<typeof createDepartmentResourceApiMock>;
  let mockSchoolApi: ReturnType<typeof createSchoolResourceApiMock>;
  let mockToastService: ReturnType<typeof createToastServiceMock>;
  let mockDialogRef: ReturnType<typeof createDialogRefMock>;
  let mockDialogConfig: ReturnType<typeof createDialogDataMock>;

  const mockSchools: SchoolShortDTO[] = [
    { schoolId: 's1', name: 'School 1' },
    { schoolId: 's2', name: 'School 2' },
  ];

  beforeEach(async () => {
    mockDepartmentApi = createDepartmentResourceApiMock();
    mockSchoolApi = createSchoolResourceApiMock();
    mockSchoolApi.getAllSchools.mockReturnValue(of(mockSchools));
    mockToastService = createToastServiceMock();
    mockDialogRef = createDialogRefMock();
    mockDialogConfig = createDialogDataMock();

    await TestBed.configureTestingModule({
      imports: [DepartmentEditDialogComponent],
      providers: [
        provideDepartmentResourceApiMock(mockDepartmentApi),
        provideSchoolResourceApiMock(mockSchoolApi),
        provideDialogRefMock(mockDialogRef),
        provideDialogDataMock(mockDialogConfig),
        provideToastServiceMock(mockToastService),
        provideTranslateMock(),
        provideFontAwesomeTesting(),
      ],
    }).compileComponents();

    const library = TestBed.inject(FaIconLibrary);
    library.addIconPacks(fas);
  });

  const createComponent = () => {
    fixture = TestBed.createComponent(DepartmentEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  describe('Initialization', () => {
    it('should handle load schools error', async () => {
      mockSchoolApi.getAllSchools.mockReturnValue(throwError(() => new Error('Error')));
      createComponent();
      await fixture.whenStable();
      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('researchGroup.departments.createDialog.errors.loadSchoolsFailed');
    });

    it('should initialize in edit mode with department values', () => {
      mockDialogConfig.data = {
        department: {
          departmentId: 'd1',
          name: 'Dept 1',
          school: { schoolId: 's1', name: 'School 1' },
        },
      };
      createComponent();
      expect(component.isEditMode()).toBe(true);
      expect(component.departmentId()).toBe('d1');
      expect(component.form.get('name')?.value).toBe('Dept 1');
      expect(component.form.get('schoolId')?.value).toBe('s1');
    });
  });

  describe('Form Interaction', () => {
    it('should update form on school change', () => {
      createComponent();
      component.onSchoolChange({ name: 'School 2', value: 's2' });
      expect(component.form.get('schoolId')?.value).toBe('s2');
    });
  });

  describe('Submission', () => {
    it('should not submit if form is invalid', async () => {
      createComponent();
      await component.onSubmit();
      expect(mockDepartmentApi.createDepartment).not.toHaveBeenCalled();
    });

    it('should create department successfully', async () => {
      createComponent();
      component.form.patchValue({ name: 'New Dept', schoolId: 's1' });
      mockDepartmentApi.createDepartment.mockReturnValue(of({}));

      await component.onSubmit();

      expect(mockDepartmentApi.createDepartment).toHaveBeenCalledWith({ name: 'New Dept', schoolId: 's1' });
      expect(mockToastService.showSuccessKey).toHaveBeenCalledWith('researchGroup.departments.createDialog.success.created');
      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });

    it('should update department successfully', async () => {
      mockDialogConfig.data = {
        department: { departmentId: 'd1', name: 'Old', school: { schoolId: 's1' } },
      };
      createComponent();
      component.form.patchValue({ name: 'Updated Dept' });
      mockDepartmentApi.updateDepartment.mockReturnValue(of({}));

      await component.onSubmit();

      expect(mockDepartmentApi.updateDepartment).toHaveBeenCalledWith('d1', { name: 'Updated Dept', schoolId: 's1' });
      expect(mockToastService.showSuccessKey).toHaveBeenCalledWith('researchGroup.departments.createDialog.success.updated');
      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });

    it('should handle duplicate name error', async () => {
      createComponent();
      component.form.patchValue({ name: 'New Dept', schoolId: 's1' });
      const error = new HttpErrorResponse({ status: 409 });
      mockDepartmentApi.createDepartment.mockReturnValue(throwError(() => error));

      await component.onSubmit();

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('researchGroup.departments.createDialog.errors.duplicateName');
    });

    it('should handle other errors during creation', async () => {
      createComponent();
      component.form.patchValue({ name: 'New Dept', schoolId: 's1' });
      const error = new HttpErrorResponse({ status: 500 });
      mockDepartmentApi.createDepartment.mockReturnValue(throwError(() => error));

      await component.onSubmit();

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('researchGroup.departments.createDialog.errors.createFailed');
    });
  });

  it('should close dialog on cancel', () => {
    createComponent();
    component.onCancel();
    expect(mockDialogRef.close).toHaveBeenCalledWith(false);
  });
});
