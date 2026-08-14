import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TableLazyLoadEvent } from 'primeng/table';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ManageUsersPageComponent } from 'app/usermanagement/manage-users/manage-users-page.component';
import { AdminUserOverviewDTO } from 'app/generated/model/admin-user-overview-dto';
import { FilterChange } from 'app/shared/components/atoms/filter-multiselect/filter-multiselect';

import { provideToastServiceMock, createToastServiceMock, ToastServiceMock } from 'util/toast-service.mock';
import { provideTranslateMock, createTranslateServiceMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideRouterMock, createRouterMock, RouterMock } from 'util/router.mock';
import { provideActivatedRouteMock, createActivatedRouteMock } from 'util/activated-route.mock';
import { provideAccountServiceMock, createAccountServiceMock, AccountServiceMock } from 'util/account.service.mock';
import {
  createUserAdminResourceApiMock,
  provideUserAdminResourceApiMock,
  UserAdminResourceApiMock,
} from 'util/user-admin-resource-api.service.mock';
import {
  createResearchGroupResourceApiMock,
  provideResearchGroupResourceApiMock,
  ResearchGroupResourceApiMock,
} from 'util/research-group-resource-api.service.mock';

describe('ManageUsersPageComponent', () => {
  let component: ManageUsersPageComponent;
  let fixture: ComponentFixture<ManageUsersPageComponent>;
  let mockUserAdminApi: UserAdminResourceApiMock;
  let mockResearchGroupApi: ResearchGroupResourceApiMock;
  let mockToastService: ToastServiceMock;
  let mockRouter: RouterMock;
  let mockAccountService: AccountServiceMock;

  const userAlice: AdminUserOverviewDTO = {
    userId: 'user-1',
    firstName: 'Alice',
    lastName: 'Anderson',
    email: 'alice@example.com',
    primaryRole: 'PROFESSOR',
    researchGroupName: 'AI Lab',
    researchGroupId: 'rg-1',
  };

  const userBob: AdminUserOverviewDTO = {
    userId: 'admin-id',
    firstName: 'Bob',
    lastName: 'Burton',
    email: 'bob@example.com',
    primaryRole: 'ADMIN',
  };

  const defaultPage = { content: [userAlice, userBob], totalElements: 2 };

  const defaultResearchGroupPage = {
    content: [
      { id: 'rg-1', researchGroup: 'AI Lab' },
      { id: 'rg-2', researchGroup: 'ML Lab' },
    ],
    totalElements: 2,
  };

  beforeEach(async () => {
    mockUserAdminApi = createUserAdminResourceApiMock();
    mockUserAdminApi.getAllUsers.mockReturnValue(of(defaultPage));
    mockUserAdminApi.deleteUser.mockReturnValue(of(undefined));

    mockResearchGroupApi = createResearchGroupResourceApiMock();
    mockResearchGroupApi.getResearchGroupsForAdmin.mockReturnValue(of(defaultResearchGroupPage));

    mockToastService = createToastServiceMock();
    mockRouter = createRouterMock();
    mockAccountService = createAccountServiceMock();
    mockAccountService.user.set({ id: 'admin-id', name: 'Bob Burton', email: 'bob@example.com', authorities: [] });

    await TestBed.configureTestingModule({
      imports: [ManageUsersPageComponent],
      providers: [
        provideUserAdminResourceApiMock(mockUserAdminApi),
        provideResearchGroupResourceApiMock(mockResearchGroupApi),
        provideToastServiceMock(mockToastService),
        provideTranslateMock(createTranslateServiceMock()),
        provideFontAwesomeTesting(),
        provideRouterMock(mockRouter),
        provideActivatedRouteMock(createActivatedRouteMock()),
        provideAccountServiceMock(mockAccountService),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageUsersPageComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should load research group options on init', async () => {
      await Promise.resolve();
      await Promise.resolve();

      expect(mockResearchGroupApi.getResearchGroupsForAdmin).toHaveBeenCalledWith(1000, 0);
      const options = component.researchGroupOptions();
      expect(options).toEqual([
        { id: 'rg-1', name: 'AI Lab' },
        { id: 'rg-2', name: 'ML Lab' },
      ]);
    });

    it('should fall back to error toast when research group load fails', async () => {
      mockResearchGroupApi.getResearchGroupsForAdmin.mockReturnValue(throwError(() => new Error('boom')));

      const failingFixture = TestBed.createComponent(ManageUsersPageComponent);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('manageUsersPage.errors.loadFilters');
      failingFixture.destroy();
    });

    it('should load users on lazy load', async () => {
      await component.loadPage({ first: 0, rows: 10 } as TableLazyLoadEvent);

      expect(mockUserAdminApi.getAllUsers).toHaveBeenCalledWith(10, 0, 'lastActivityAt', 'DESC', undefined, undefined, undefined);
      expect(component.users()).toEqual([userAlice, userBob]);
      expect(component.totalRecords()).toBe(2);
    });

    it('should compute page index from first and rows on lazy load', async () => {
      await component.loadPage({ first: 40, rows: 20 } as TableLazyLoadEvent);

      expect(component.pageSize()).toBe(20);
      expect(component.page()).toBe(2);
      expect(mockUserAdminApi.getAllUsers).toHaveBeenCalledWith(20, 2, 'lastActivityAt', 'DESC', undefined, undefined, undefined);
    });

    it('should show error toast when loading users fails', async () => {
      mockUserAdminApi.getAllUsers.mockReturnValueOnce(throwError(() => new Error('fail')));

      await component.loadPage({ first: 0, rows: 10 } as TableLazyLoadEvent);

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('manageUsersPage.errors.loadUsers');
    });
  });

  describe('Columns', () => {
    it('should expose User, Email, University ID, Role, Research Group, Last Activity, and Actions columns', () => {
      fixture.detectChanges();
      const columns = component.columns();
      const fields = columns.map(column => column.field);

      expect(fields).toEqual(['fullName', 'email', 'universityId', 'primaryRole', 'researchGroupName', 'lastActivityAt', 'actions']);
      expect(columns[0].header).toBe('manageUsersPage.tableColumn.user');
      expect(columns[1].header).toBe('manageUsersPage.tableColumn.email');
      expect(columns[2].header).toBe('manageUsersPage.tableColumn.universityId');
      expect(columns[3].header).toBe('manageUsersPage.tableColumn.role');
      expect(columns[4].header).toBe('manageUsersPage.tableColumn.researchGroup');
      expect(columns[5].header).toBe('manageUsersPage.tableColumn.lastActivity');
      expect(columns[6].header).toBe('');
    });
  });

  describe('Filters', () => {
    it('should set role filter and reload with the selected enum array', async () => {
      mockUserAdminApi.getAllUsers.mockClear();
      const change: FilterChange = {
        filterId: 'role',
        selectedValues: ['manageUsersPage.roles.PROFESSOR', 'manageUsersPage.roles.ADMIN'],
      };

      component.onFilterEmit(change);
      await Promise.resolve();

      expect(component.selectedRoleFilters()).toEqual(['PROFESSOR', 'ADMIN']);
      expect(component.page()).toBe(0);
      expect(mockUserAdminApi.getAllUsers).toHaveBeenCalledWith(
        10,
        0,
        'lastActivityAt',
        'DESC',
        ['PROFESSOR', 'ADMIN'],
        undefined,
        undefined,
      );
    });

    it('should map research-group names to ids on filter change', async () => {
      await Promise.resolve();
      await Promise.resolve();
      mockUserAdminApi.getAllUsers.mockClear();

      const change: FilterChange = {
        filterId: 'researchGroup',
        selectedValues: ['AI Lab', 'ML Lab'],
      };

      component.onFilterEmit(change);
      await Promise.resolve();

      expect(component.selectedResearchGroupFilters()).toEqual(['rg-1', 'rg-2']);
      expect(mockUserAdminApi.getAllUsers).toHaveBeenCalledWith(10, 0, 'lastActivityAt', 'DESC', undefined, ['rg-1', 'rg-2'], undefined);
    });
  });

  describe('Search', () => {
    it('should reload on meaningful query change', async () => {
      mockUserAdminApi.getAllUsers.mockClear();

      component.onSearchEmit('alice');
      await Promise.resolve();

      expect(component.searchQuery()).toBe('alice');
      expect(component.page()).toBe(0);
      expect(mockUserAdminApi.getAllUsers).toHaveBeenCalledWith(10, 0, 'lastActivityAt', 'DESC', undefined, undefined, 'alice');
    });

    it('should NOT reload when query is unchanged', async () => {
      component.searchQuery.set('same');
      mockUserAdminApi.getAllUsers.mockClear();

      component.onSearchEmit('same');
      await Promise.resolve();

      expect(mockUserAdminApi.getAllUsers).not.toHaveBeenCalled();
    });
  });

  describe('Actions', () => {
    it('should navigate to /manage-users/:userId on view', () => {
      component.onViewUser('user-1');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/manage-users', 'user-1']);
    });

    it('should not navigate when view is called with empty id', () => {
      component.onViewUser('');
      component.onViewUser(undefined);
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should navigate to /manage-users/create on Create button', () => {
      component.onCreateUser();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/manage-users/create']);
    });

    it('should navigate to /manage-users/create with mode=import on Import button', () => {
      component.onImport();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/manage-users/create'], { queryParams: { mode: 'import' } });
    });

    it('should request delete and open dialog for non-self row', async () => {
      await component.loadPage({ first: 0, rows: 10 } as TableLazyLoadEvent);
      const aliceRow = component.userRows().find(row => row.userId === 'user-1')!;

      component.onRequestDelete(aliceRow);

      expect(component.currentUserToDelete()).toBe(aliceRow);
      expect(component.showDeleteDialog()).toBe(true);
      expect(mockToastService.showErrorKey).not.toHaveBeenCalled();
    });

    it('should disable delete on the current admin own row by toasting and skipping the dialog', async () => {
      await component.loadPage({ first: 0, rows: 10 } as TableLazyLoadEvent);
      const bobRow = component.userRows().find(row => row.userId === 'admin-id')!;

      component.onRequestDelete(bobRow);

      expect(component.currentUserToDelete()).toBeUndefined();
      expect(component.showDeleteDialog()).toBe(false);
      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('manageUsersPage.errors.selfDelete');
    });

    it('should call deleteUser on confirmed delete', async () => {
      await component.loadPage({ first: 0, rows: 10 } as TableLazyLoadEvent);
      const aliceRow = component.userRows().find(row => row.userId === 'user-1')!;
      component.currentUserToDelete.set(aliceRow);

      await component.onConfirmDelete();

      expect(mockUserAdminApi.deleteUser).toHaveBeenCalledWith('user-1');
      expect(mockToastService.showSuccess).toHaveBeenCalledOnce();
      expect(component.currentUserToDelete()).toBeUndefined();
    });

    it('should not call deleteUser when no user is selected for deletion', async () => {
      component.currentUserToDelete.set(undefined);

      await component.onConfirmDelete();

      expect(mockUserAdminApi.deleteUser).not.toHaveBeenCalled();
    });

    it('should toast error when delete fails', async () => {
      await component.loadPage({ first: 0, rows: 10 } as TableLazyLoadEvent);
      const aliceRow = component.userRows().find(row => row.userId === 'user-1')!;
      mockUserAdminApi.deleteUser.mockReturnValueOnce(throwError(() => new Error('forbidden')));
      component.currentUserToDelete.set(aliceRow);

      await component.onConfirmDelete();

      expect(mockToastService.showError).toHaveBeenCalledOnce();
      expect(component.currentUserToDelete()).toBeUndefined();
    });
  });

  describe('Sort', () => {
    it('should reload with the new sort field and direction', async () => {
      mockUserAdminApi.getAllUsers.mockClear();

      component.onSortEmit({ field: 'lastName', direction: 'ASC' });
      await Promise.resolve();

      expect(component.sortBy()).toBe('lastName');
      expect(component.sortDirection()).toBe('ASC');
      expect(component.page()).toBe(0);
      expect(mockUserAdminApi.getAllUsers).toHaveBeenCalledWith(10, 0, 'lastName', 'ASC', undefined, undefined, undefined);
    });
  });

  describe('Row enrichment', () => {
    it('should compute fullName, roleLabelKey, and isSelf for each loaded row', async () => {
      await component.loadPage({ first: 0, rows: 10 } as TableLazyLoadEvent);
      const rows = component.userRows();

      const alice = rows.find(row => row.userId === 'user-1')!;
      expect(alice.fullName).toBe('Alice Anderson');
      expect(alice.roleLabelKey).toBe('manageUsersPage.roles.PROFESSOR');
      expect(alice.isSelf).toBe(false);

      const bob = rows.find(row => row.userId === 'admin-id')!;
      expect(bob.fullName).toBe('Bob Burton');
      expect(bob.roleLabelKey).toBe('manageUsersPage.roles.ADMIN');
      expect(bob.isSelf).toBe(true);
    });
  });
});
