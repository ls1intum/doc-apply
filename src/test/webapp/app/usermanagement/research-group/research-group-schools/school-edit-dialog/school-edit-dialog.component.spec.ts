import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SchoolEditDialogComponent } from 'app/usermanagement/research-group/research-group-schools/school-edit-dialog/school-edit-dialog.component';
import { provideTranslateMock } from 'util/translate.mock';
import { createToastServiceMock, provideToastServiceMock } from 'util/toast-service.mock';
import { createDialogDataMock, createDialogRefMock, provideDialogDataMock, provideDialogRefMock } from 'util/dialog-ref.mock';
import { createSchoolResourceApiMock, provideSchoolResourceApiMock } from 'util/school-resource-api.service.mock';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { describe, it, expect, beforeEach } from 'vitest';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';

describe('SchoolEditDialogComponent', () => {
  let component: SchoolEditDialogComponent;
  let fixture: ComponentFixture<SchoolEditDialogComponent>;
  let mockSchoolApi: ReturnType<typeof createSchoolResourceApiMock>;
  let mockToastService: ReturnType<typeof createToastServiceMock>;
  let mockDialogRef: ReturnType<typeof createDialogRefMock>;
  let mockDialogConfig: ReturnType<typeof createDialogDataMock>;

  beforeEach(async () => {
    mockSchoolApi = createSchoolResourceApiMock();
    mockToastService = createToastServiceMock();
    mockDialogRef = createDialogRefMock();
    mockDialogConfig = createDialogDataMock();

    await TestBed.configureTestingModule({
      imports: [SchoolEditDialogComponent],
      providers: [
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
    fixture = TestBed.createComponent(SchoolEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('should initialize in edit mode with school values', () => {
    mockDialogConfig.data = {
      school: { schoolId: 's1', name: 'School 1', abbreviation: 'S1' },
    };
    createComponent();
    expect(component.isEditMode()).toBe(true);
    expect(component.schoolId()).toBe('s1');
    expect(component.form.get('name')?.value).toBe('School 1');
    expect(component.form.get('abbreviation')?.value).toBe('S1');
  });

  describe('Submission', () => {
    it('should not submit if form is invalid', async () => {
      createComponent();
      await component.onSubmit();
      expect(mockSchoolApi.createSchool).not.toHaveBeenCalled();
    });

    it('should create school successfully', async () => {
      createComponent();
      component.form.patchValue({ name: 'New School', abbreviation: 'NS' });
      mockSchoolApi.createSchool.mockReturnValue(of({}));

      await component.onSubmit();

      expect(mockSchoolApi.createSchool).toHaveBeenCalledWith({ name: 'New School', abbreviation: 'NS' });
      expect(mockToastService.showSuccessKey).toHaveBeenCalledWith('researchGroup.schools.createDialog.success.created');
      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });

    it('should update school successfully', async () => {
      mockDialogConfig.data = {
        school: { schoolId: 's1', name: 'Old', abbreviation: 'OLD' },
      };
      createComponent();
      component.form.patchValue({ name: 'Updated School', abbreviation: 'UPD' });
      mockSchoolApi.updateSchool.mockReturnValue(of({}));

      await component.onSubmit();

      expect(mockSchoolApi.updateSchool).toHaveBeenCalledWith('s1', { name: 'Updated School', abbreviation: 'UPD' });
      expect(mockToastService.showSuccessKey).toHaveBeenCalledWith('researchGroup.schools.createDialog.success.updated');
      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });

    it('should handle duplicate name or abbreviation error', async () => {
      createComponent();
      component.form.patchValue({ name: 'New School', abbreviation: 'NS' });
      const error = new HttpErrorResponse({ status: 409 });
      mockSchoolApi.createSchool.mockReturnValue(throwError(() => error));

      await component.onSubmit();

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('researchGroup.schools.createDialog.errors.duplicateNameOrAbbreviation');
    });

    it('should handle other errors during save', async () => {
      createComponent();
      component.form.patchValue({ name: 'New School', abbreviation: 'NS' });
      const error = new HttpErrorResponse({ status: 500 });
      mockSchoolApi.createSchool.mockReturnValue(throwError(() => error));

      await component.onSubmit();

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('researchGroup.schools.createDialog.errors.createFailed');
    });
  });

  it('should close dialog on cancel', () => {
    createComponent();
    component.onCancel();
    expect(mockDialogRef.close).toHaveBeenCalledWith(false);
  });
});
