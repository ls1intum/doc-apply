import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResearchGroupDepartmentsComponent } from 'app/usermanagement/research-group/research-group-departments/research-group-departments.component';
import { DepartmentDTO } from 'app/generated/model/department-dto';
import { provideTranslateMock } from 'util/translate.mock';
import { provideToastServiceMock, createToastServiceMock } from 'util/toast-service.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { createDialogServiceMock, provideDialogServiceMock } from 'util/dialog.service.mock';
import { createDepartmentResourceApiMock, provideDepartmentResourceApiMock } from 'util/department-resource-api.service.mock';
import { createSchoolResourceApiMock, provideSchoolResourceApiMock } from 'util/school-resource-api.service.mock';
import { DepartmentEditDialogComponent } from 'app/usermanagement/research-group/research-group-departments/department-edit-dialog/department-edit-dialog.component';
import { createRouterMock, provideRouterMock } from 'util/router.mock';

describe('ResearchGroupDepartmentsComponent', () => {
  let component: ResearchGroupDepartmentsComponent;
  let fixture: ComponentFixture<ResearchGroupDepartmentsComponent>;
  let mockDepartmentApi: ReturnType<typeof createDepartmentResourceApiMock>;
  let mockToastService: ReturnType<typeof createToastServiceMock>;
  let mockDialogService: ReturnType<typeof createDialogServiceMock>;
  let mockSchoolApi: ReturnType<typeof createSchoolResourceApiMock>;
  let mockRouter: ReturnType<typeof createRouterMock>;

  const mockDepartments: DepartmentDTO[] = [
    {
      departmentId: '1',
      name: 'Dept 1',
      school: { name: 'School 1', abbreviation: 'S1' },
    },
    {
      departmentId: '2',
      name: 'Dept 2',
      school: { name: 'School 2', abbreviation: 'S2' },
    },
  ];

  beforeEach(async () => {
    mockDepartmentApi = createDepartmentResourceApiMock();
    mockDepartmentApi.getDepartmentsForAdmin.mockReturnValue(of({ content: mockDepartments, totalElements: mockDepartments.length }));
    mockDepartmentApi.deleteDepartment.mockReturnValue(of({}));

    mockSchoolApi = createSchoolResourceApiMock();
    mockSchoolApi.getAllSchools.mockReturnValue(of([{ schoolId: 's1', name: 'School 1', abbreviation: 'S1' }]));

    mockToastService = createToastServiceMock();
    mockDialogService = createDialogServiceMock();
    mockRouter = createRouterMock();

    await TestBed.configureTestingModule({
      imports: [ResearchGroupDepartmentsComponent],
      providers: [
        provideDepartmentResourceApiMock(mockDepartmentApi),
        provideSchoolResourceApiMock(mockSchoolApi),
        provideDialogServiceMock(mockDialogService),
        provideToastServiceMock(mockToastService),
        provideTranslateMock(),
        provideFontAwesomeTesting(),
        provideRouterMock(mockRouter),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResearchGroupDepartmentsComponent);
    component = fixture.componentInstance;
  });

  describe('initial load', () => {
    it('loads departments and maps them correctly', async () => {
      // Trigger load
      await component.loadDepartments();
      fixture.detectChanges();

      const tableData = component.tableData();
      expect(tableData.length).toBe(2);
      expect(tableData[0].name).toBe('Dept 1');
      expect(tableData[0].schoolName).toBe('School 1');
      expect(tableData[0].schoolAbbreviation).toBe('S1');
    });

    it('should handle load departments error', async () => {
      mockDepartmentApi.getDepartmentsForAdmin.mockReturnValue(throwError(() => new Error('Error')));
      await expect(component.loadDepartments()).resolves.toBeUndefined();
      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('researchGroup.departments.toastMessages.loadFailed');
    });

    it('should default undefined page response fields to empty and zero', async () => {
      mockDepartmentApi.getDepartmentsForAdmin.mockReturnValue(of({}));

      await component.loadDepartments();

      expect(component.departments()).toEqual([]);
      expect(component.total()).toBe(0);
    });
  });

  describe('pagination', () => {
    it('should update pagination on table emit', () => {
      component.loadOnTableEmit({ first: 10, rows: 5 });
      expect(component.pageNumber()).toBe(2);
      expect(component.pageSize()).toBe(5);
    });
  });

  describe('search & filter & sort', () => {
    it('calls API with search query', async () => {
      mockDepartmentApi.getDepartmentsForAdmin.mockClear();
      await component.onSearchEmit('Dept');
      await Promise.resolve();

      expect(mockDepartmentApi.getDepartmentsForAdmin).toHaveBeenCalledWith(10, 0, [], 'Dept', 'name', 'DESC');
    });

    it('calls API with filter values', async () => {
      mockDepartmentApi.getDepartmentsForAdmin.mockClear();
      await component.onFilterEmit({ filterId: 'school', selectedValues: ['School 1'] });
      await Promise.resolve();

      expect(mockDepartmentApi.getDepartmentsForAdmin).toHaveBeenCalledWith(10, 0, ['School 1'], '', 'name', 'DESC');
    });

    it('does not reload when filter id is not school', async () => {
      mockDepartmentApi.getDepartmentsForAdmin.mockClear();

      await component.onFilterEmit({ filterId: 'other', selectedValues: ['X'] });
      await Promise.resolve();

      expect(mockDepartmentApi.getDepartmentsForAdmin).not.toHaveBeenCalled();
      expect(component.selectedSchoolFilters()).toEqual([]);
    });

    it('calls API on sort change', async () => {
      mockDepartmentApi.getDepartmentsForAdmin.mockClear();
      await component.loadOnSortEmit({ field: 'school.name', direction: 'DESC' });
      await Promise.resolve();

      expect(mockDepartmentApi.getDepartmentsForAdmin).toHaveBeenCalledWith(10, 0, [], '', 'school.name', 'DESC');
    });
  });

  describe('dialog interactions', () => {
    it('should open create dialog and reload on success', async () => {
      const mockDialogRef = { closed: of(true) };
      mockDialogService.open.mockReturnValue(mockDialogRef);

      // clear previous calls triggered by constructor
      mockDepartmentApi.getDepartmentsForAdmin.mockClear();

      await component.onCreateDepartment();

      expect(mockDialogService.open).toHaveBeenCalledWith(
        DepartmentEditDialogComponent,
        expect.objectContaining({
          header: expect.any(String),
        }),
      );
      // Should reload departments once after dialog closed with true
      expect(mockDepartmentApi.getDepartmentsForAdmin).toHaveBeenCalledOnce();
    });

    it('should not reload if create dialog cancelled', async () => {
      const mockDialogRef = { closed: of(false) };
      mockDialogService.open.mockReturnValue(mockDialogRef);

      // clear previous calls triggered by constructor
      mockDepartmentApi.getDepartmentsForAdmin.mockClear();

      await component.onCreateDepartment();

      expect(mockDepartmentApi.getDepartmentsForAdmin).toHaveBeenCalledTimes(0);
    });

    it('should open edit dialog and reload on success', async () => {
      await component.loadDepartments(); // Ensure departments are loaded
      const mockDialogRef = { closed: of(true) };
      mockDialogService.open.mockReturnValue(mockDialogRef);

      // clear previous calls triggered by constructor and initial load
      mockDepartmentApi.getDepartmentsForAdmin.mockClear();

      await component.onEditDepartment('1');

      expect(mockDialogService.open).toHaveBeenCalledWith(
        DepartmentEditDialogComponent,
        expect.objectContaining({
          data: { department: mockDepartments[0] },
        }),
      );
      expect(mockDepartmentApi.getDepartmentsForAdmin).toHaveBeenCalledOnce();
    });

    it('should not open edit dialog if id is missing or department not found', () => {
      component.onEditDepartment(undefined);
      component.onEditDepartment('999');
      expect(mockDialogService.open).not.toHaveBeenCalled();
    });
  });

  describe('actions', () => {
    it('should build menu items and execute commands', () => {
      const deleteDialog = { confirm: vi.fn() };
      const mockMenu = { toggle: vi.fn() } as unknown as Parameters<typeof component.onMenuToggle>[1];

      component.onMenuToggle(new Event('click'), mockMenu, { departmentId: '1' }, deleteDialog);
      const items = component.menuItems();
      expect(items.length).toBe(2);

      items[0].command?.();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/research-group/departments/images'], {
        queryParams: { departmentId: '1' },
      });

      items[1].command?.();
      expect(deleteDialog.confirm).toHaveBeenCalledOnce();
    });

    it('should delete department and reload', () => {
      mockDepartmentApi.deleteDepartment.mockReturnValue(of({}));

      // clear previous load calls
      mockDepartmentApi.getDepartmentsForAdmin.mockClear();

      component.onDeleteDepartment('1');

      expect(mockDepartmentApi.deleteDepartment).toHaveBeenCalledWith('1');
      expect(mockToastService.showSuccessKey).toHaveBeenCalledWith('researchGroup.departments.toastMessages.deleteSuccess');
      expect(mockDepartmentApi.getDepartmentsForAdmin).toHaveBeenCalledOnce();
    });

    it('should handle delete error', () => {
      mockDepartmentApi.deleteDepartment.mockReturnValue(throwError(() => new Error('Error')));

      component.onDeleteDepartment('1');

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('researchGroup.departments.toastMessages.deleteFailed');
    });
  });
});
