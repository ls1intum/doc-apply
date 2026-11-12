import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach } from 'vitest';
import { ResearchGroupSchoolsComponent } from 'app/usermanagement/research-group/research-group-schools/research-group-schools.component';
import { SchoolShortDTO } from 'app/generated/model/school-short-dto';
import { provideTranslateMock } from 'util/translate.mock';
import { provideToastServiceMock, createToastServiceMock } from 'util/toast-service.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { createDialogServiceMock, provideDialogServiceMock } from 'util/dialog.service.mock';
import { createSchoolResourceApiMock, provideSchoolResourceApiMock } from 'util/school-resource-api.service.mock';
import { SchoolEditDialogComponent } from 'app/usermanagement/research-group/research-group-schools/school-edit-dialog/school-edit-dialog.component';

describe('ResearchGroupSchoolsComponent', () => {
  let component: ResearchGroupSchoolsComponent;
  let fixture: ComponentFixture<ResearchGroupSchoolsComponent>;
  let mockSchoolApi: ReturnType<typeof createSchoolResourceApiMock>;
  let mockToastService: ReturnType<typeof createToastServiceMock>;
  let mockDialogService: ReturnType<typeof createDialogServiceMock>;

  const mockSchools: SchoolShortDTO[] = [
    { schoolId: 's1', name: 'School 1', abbreviation: 'S1' },
    { schoolId: 's2', name: 'School 2', abbreviation: 'S2' },
  ];

  beforeEach(async () => {
    mockSchoolApi = createSchoolResourceApiMock();
    mockSchoolApi.getSchoolsForAdmin.mockReturnValue(of({ content: mockSchools, totalElements: mockSchools.length }));
    mockSchoolApi.deleteSchool.mockReturnValue(of({}));

    mockToastService = createToastServiceMock();
    mockDialogService = createDialogServiceMock();

    await TestBed.configureTestingModule({
      imports: [ResearchGroupSchoolsComponent],
      providers: [
        provideSchoolResourceApiMock(mockSchoolApi),
        provideDialogServiceMock(mockDialogService),
        provideToastServiceMock(mockToastService),
        provideTranslateMock(),
        provideFontAwesomeTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResearchGroupSchoolsComponent);
    component = fixture.componentInstance;
  });

  describe('initial load', () => {
    it('loads schools and maps them correctly', async () => {
      await component.loadSchools();
      fixture.detectChanges();

      const tableData = component.tableData();
      expect(tableData.length).toBe(2);
      expect(tableData[0].name).toBe('School 1');
      expect(tableData[0].abbreviation).toBe('S1');
    });

    it('should handle load schools error', async () => {
      mockSchoolApi.getSchoolsForAdmin.mockReturnValue(throwError(() => new Error('Error')));
      await expect(component.loadSchools()).resolves.toBeUndefined();
      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('researchGroup.schools.toastMessages.loadFailed');
    });
  });

  describe('pagination', () => {
    it('should update pagination on table emit', () => {
      component.loadOnTableEmit({ first: 10, rows: 5 });
      expect(component.pageNumber()).toBe(2);
      expect(component.pageSize()).toBe(5);
    });
  });

  describe('search & sort', () => {
    it('calls API with search query', async () => {
      mockSchoolApi.getSchoolsForAdmin.mockClear();
      component.onSearchEmit('School');
      await Promise.resolve();

      expect(mockSchoolApi.getSchoolsForAdmin).toHaveBeenCalledWith(10, 0, 'School', 'name', 'DESC');
    });

    it('calls API on sort change', async () => {
      mockSchoolApi.getSchoolsForAdmin.mockClear();
      component.loadOnSortEmit({ field: 'abbreviation', direction: 'DESC' });
      await Promise.resolve();

      expect(mockSchoolApi.getSchoolsForAdmin).toHaveBeenCalledWith(10, 0, '', 'abbreviation', 'DESC');
    });
  });

  describe('dialog interactions', () => {
    it('should open create dialog and reload on success', async () => {
      const mockDialogRef = { closed: of(true) };
      mockDialogService.open.mockReturnValue(mockDialogRef);

      mockSchoolApi.getSchoolsForAdmin.mockClear();
      await component.onCreateSchool();

      expect(mockDialogService.open).toHaveBeenCalledWith(
        SchoolEditDialogComponent,
        expect.objectContaining({
          header: expect.any(String),
        }),
      );
      expect(mockSchoolApi.getSchoolsForAdmin).toHaveBeenCalledOnce();
    });

    it('should not reload if create dialog cancelled', async () => {
      const mockDialogRef = { closed: of(false) };
      mockDialogService.open.mockReturnValue(mockDialogRef);

      mockSchoolApi.getSchoolsForAdmin.mockClear();
      await component.onCreateSchool();

      expect(mockSchoolApi.getSchoolsForAdmin).toHaveBeenCalledTimes(0);
    });

    it('should open edit dialog and reload on success', async () => {
      await component.loadSchools();
      const mockDialogRef = { closed: of(true) };
      mockDialogService.open.mockReturnValue(mockDialogRef);

      mockSchoolApi.getSchoolsForAdmin.mockClear();
      await component.onEditSchool('s1');

      expect(mockDialogService.open).toHaveBeenCalledWith(
        SchoolEditDialogComponent,
        expect.objectContaining({
          data: { school: mockSchools[0] },
        }),
      );
      expect(mockSchoolApi.getSchoolsForAdmin).toHaveBeenCalledOnce();
    });

    it('should not open edit dialog if id is missing or school not found', async () => {
      await component.onEditSchool(undefined);
      await component.onEditSchool('missing');
      expect(mockDialogService.open).not.toHaveBeenCalled();
    });
  });

  describe('actions', () => {
    it('should delete school and reload', async () => {
      mockSchoolApi.deleteSchool.mockReturnValue(of({}));

      mockSchoolApi.getSchoolsForAdmin.mockClear();
      await component.onDeleteSchool('s1');

      expect(mockSchoolApi.deleteSchool).toHaveBeenCalledWith('s1');
      expect(mockToastService.showSuccessKey).toHaveBeenCalledWith('researchGroup.schools.toastMessages.deleteSuccess');
      expect(mockSchoolApi.getSchoolsForAdmin).toHaveBeenCalledOnce();
    });

    it('should handle delete error', async () => {
      mockSchoolApi.deleteSchool.mockReturnValue(throwError(() => new Error('Error')));

      await component.onDeleteSchool('s1');

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('researchGroup.schools.toastMessages.deleteFailed');
    });
  });
});
