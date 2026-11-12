import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DialogRef } from 'app/shared/dialog/dialog.service';

import { ResearchGroupAdminView } from 'app/usermanagement/research-group/research-group-admin-view/research-group-admin-view.component';
import { ResearchGroupResourceApi } from 'app/generated/api/research-group-resource-api';
import { ResearchGroupAdminDTO, ResearchGroupAdminDTOStatusEnum } from 'app/generated/model/research-group-admin-dto';
import { PageResponseDTOResearchGroupAdminDTO } from 'app/generated/model/page-response-dto-research-group-admin-dto';
import { createTranslateServiceMock, provideTranslateMock, TranslateServiceMock } from 'util/translate.mock';
import { provideToastServiceMock, createToastServiceMock, ToastServiceMock } from 'util/toast-service.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { FilterChange } from 'app/shared/components/atoms/filter-multiselect/filter-multiselect';
import { Sort } from 'app/shared/components/atoms/sorting/sorting';
import { createDialogServiceMock, DialogServiceMock, provideDialogServiceMock } from 'util/dialog.service.mock';
import { Router } from '@angular/router';
import { TablePageEvent } from 'app/shared/components/organisms/dynamic-table/dynamic-table.component';

describe('ResearchGroupAdminView', () => {
  let component: ResearchGroupAdminView;
  let fixture: ComponentFixture<ResearchGroupAdminView>;
  let mockResearchGroupService: {
    getResearchGroupsForAdmin: ReturnType<typeof vi.fn>;
    activateResearchGroup: ReturnType<typeof vi.fn>;
    denyResearchGroup: ReturnType<typeof vi.fn>;
    withdrawResearchGroup: ReturnType<typeof vi.fn>;
  };
  let mockToastService: ToastServiceMock;
  let mockDialogService: DialogServiceMock;
  let mockTranslateService: TranslateServiceMock;

  const mockResearchGroup1: ResearchGroupAdminDTO = {
    id: 'rg-1',
    professorName: 'Prof. Dr. Smith',
    status: ResearchGroupAdminDTOStatusEnum.Draft,
    researchGroup: 'AI Research Lab',
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  const mockResearchGroup2: ResearchGroupAdminDTO = {
    id: 'rg-2',
    professorName: 'Prof. Dr. Jones',
    status: ResearchGroupAdminDTOStatusEnum.Active,
    researchGroup: 'ML Research Lab',
    createdAt: '2024-01-02T00:00:00.000Z',
  };

  const mockResearchGroup3: ResearchGroupAdminDTO = {
    id: 'rg-3',
    professorName: 'Prof. Dr. Brown',
    status: ResearchGroupAdminDTOStatusEnum.Denied,
    researchGroup: 'Data Science Lab',
    createdAt: '2024-01-03T00:00:00.000Z',
  };

  const mockPageResponse: PageResponseDTOResearchGroupAdminDTO = {
    content: [mockResearchGroup1, mockResearchGroup2, mockResearchGroup3],
    totalElements: 3,
  };

  beforeEach(async () => {
    mockResearchGroupService = {
      getResearchGroupsForAdmin: vi.fn(),
      activateResearchGroup: vi.fn(),
      denyResearchGroup: vi.fn(),
      withdrawResearchGroup: vi.fn(),
    };

    mockToastService = createToastServiceMock();
    mockDialogService = createDialogServiceMock();
    mockTranslateService = createTranslateServiceMock();

    await TestBed.configureTestingModule({
      imports: [ResearchGroupAdminView],
      providers: [
        { provide: ResearchGroupResourceApi, useValue: mockResearchGroupService },
        provideDialogServiceMock(mockDialogService),
        provideTranslateMock(mockTranslateService),
        provideToastServiceMock(mockToastService),
        provideFontAwesomeTesting(),
        { provide: Router, useValue: { navigate: vi.fn(), events: of() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResearchGroupAdminView);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading Research Groups', () => {
    it('should load research groups on table emit', async () => {
      mockResearchGroupService.getResearchGroupsForAdmin.mockReturnValue(of(mockPageResponse));

      const event: TablePageEvent = { first: 20, rows: 10 };
      component.loadOnTableEmit(event);
      await Promise.resolve();

      expect(component.page()).toBe(2);
      expect(component.pageSize()).toBe(10);
      expect(component.researchGroups()).toEqual(mockPageResponse.content);
      expect(component.totalRecords()).toBe(3);
      expect(mockResearchGroupService.getResearchGroupsForAdmin).toHaveBeenCalledWith(10, 2, [], '', 'state', 'DESC');
    });

    it('should handle empty response', async () => {
      mockResearchGroupService.getResearchGroupsForAdmin.mockReturnValue(of({} as PageResponseDTOResearchGroupAdminDTO));

      component.loadOnTableEmit({ first: 0, rows: 10 });
      await Promise.resolve();

      expect(component.researchGroups()).toEqual([]);
      expect(component.totalRecords()).toBe(0);
    });

    it('should show error toast on load failure', async () => {
      mockResearchGroupService.getResearchGroupsForAdmin.mockReturnValue(throwError(() => new Error('API Error')));

      component.loadOnTableEmit({ first: 0, rows: 10 });
      await Promise.resolve();

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('researchGroup.adminView.errors.loadResearchGroups');
    });
  });

  describe('Search, Filter, and Sort Handlers', () => {
    it('should reset page and reload on search', async () => {
      component.page.set(2);
      mockResearchGroupService.getResearchGroupsForAdmin.mockReturnValue(of(mockPageResponse));

      component.onSearchEmit('test query');
      await Promise.resolve();

      expect(component.page()).toBe(0);
      expect(component.searchQuery()).toBe('test query');
      expect(mockResearchGroupService.getResearchGroupsForAdmin).toHaveBeenCalledWith(10, 0, [], 'test query', 'state', 'DESC');
    });

    it('should not reload when search query is the same', async () => {
      component.searchQuery.set('same query');

      component.onSearchEmit('same query');
      await Promise.resolve();

      expect(mockResearchGroupService.getResearchGroupsForAdmin).not.toHaveBeenCalled();
    });

    it('should map status filter selectedValues to enum values', async () => {
      mockResearchGroupService.getResearchGroupsForAdmin.mockReturnValue(of(mockPageResponse));

      const filterChange: FilterChange = {
        filterId: 'status',
        selectedValues: ['researchGroup.adminView.groupState.draft', 'researchGroup.adminView.groupState.active'],
      };

      component.onFilterEmit(filterChange);
      await Promise.resolve();

      expect(component.selectedStatusFilters()).toEqual(['DRAFT', 'ACTIVE']);
      expect(mockResearchGroupService.getResearchGroupsForAdmin).toHaveBeenCalledWith(10, 0, ['DRAFT', 'ACTIVE'], '', 'state', 'DESC');
    });

    it('should ignore unknown filter IDs', async () => {
      component.onFilterEmit({ filterId: 'unknown', selectedValues: ['value1'] });
      await Promise.resolve();

      expect(mockResearchGroupService.getResearchGroupsForAdmin).not.toHaveBeenCalled();
    });

    it('should pass through unknown translation keys in filter mapping', async () => {
      mockResearchGroupService.getResearchGroupsForAdmin.mockReturnValue(of(mockPageResponse));

      component.onFilterEmit({ filterId: 'status', selectedValues: ['unknown.key'] });
      await Promise.resolve();

      expect(component.selectedStatusFilters()).toEqual(['unknown.key'] as unknown as ('DRAFT' | 'ACTIVE' | 'DENIED')[]);
    });

    it('should handle sort change', async () => {
      mockResearchGroupService.getResearchGroupsForAdmin.mockReturnValue(of(mockPageResponse));

      const sortEvent: Sort = { field: 'createdAt', direction: 'ASC' };
      component.loadOnSortEmit(sortEvent);
      await Promise.resolve();

      expect(component.sortBy()).toBe('createdAt');
      expect(component.sortDirection()).toBe('ASC');
      expect(mockResearchGroupService.getResearchGroupsForAdmin).toHaveBeenCalledWith(10, 0, [], '', 'createdAt', 'ASC');
    });
  });

  describe('Dialogs and navigation', () => {
    it('should navigate to detail page', () => {
      const router = TestBed.inject(Router);
      component.onViewResearchGroup('rg-123');

      expect(router.navigate).toHaveBeenCalledWith(['/research-group/detail', 'rg-123']);
    });

    it('should open create dialog and reload on success', async () => {
      const mockDialogRef = {
        closed: { subscribe: vi.fn((cb: (result: boolean) => void) => cb(true)) },
      } as unknown as DialogRef;
      mockDialogService.open.mockReturnValue(mockDialogRef);
      mockResearchGroupService.getResearchGroupsForAdmin.mockReturnValue(of(mockPageResponse));

      component.onCreateResearchGroup();
      await Promise.resolve();

      expect(mockDialogService.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          header: 'researchGroup.adminView.createDialog.title',
          data: { mode: 'admin' },
        }),
      );
      expect(mockResearchGroupService.getResearchGroupsForAdmin).toHaveBeenCalledOnce();
    });

    it('should not reload when create dialog is cancelled', async () => {
      const mockDialogRef = {
        closed: { subscribe: vi.fn((cb: (result: boolean) => void) => cb(false)) },
      } as unknown as DialogRef;
      mockDialogService.open.mockReturnValue(mockDialogRef);

      component.onCreateResearchGroup();
      await Promise.resolve();

      expect(mockResearchGroupService.getResearchGroupsForAdmin).not.toHaveBeenCalled();
    });

    it('should navigate to manage images page', () => {
      const router = TestBed.inject(Router);
      component.onManageImages('rg-123');

      expect(router.navigate).toHaveBeenCalledWith(['/research-group/admin-view/images'], {
        queryParams: { researchGroupId: 'rg-123', researchGroupName: '' },
      });
    });

    it('should navigate to members page', async () => {
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate');

      component.onManageMembers('rg-1');
      await Promise.resolve();

      expect(navigateSpy).toHaveBeenCalledWith(['/research-group', 'rg-1', 'members']);
    });
  });

  describe('Research Group Actions', () => {
    it.each([
      {
        action: 'onApproveResearchGroup' as const,
        apiMethod: 'activateResearchGroup' as const,
        successKey: 'researchGroup.adminView.success.approve',
      },
      {
        action: 'onDenyResearchGroup' as const,
        apiMethod: 'denyResearchGroup' as const,
        successKey: 'researchGroup.adminView.success.deny',
      },
      {
        action: 'onWithdrawResearchGroup' as const,
        apiMethod: 'withdrawResearchGroup' as const,
        successKey: 'researchGroup.adminView.success.withdraw',
      },
    ])('$action: should succeed and reload', async ({ action, apiMethod, successKey }) => {
      mockResearchGroupService[apiMethod].mockReturnValue(of(void 0));
      mockResearchGroupService.getResearchGroupsForAdmin.mockReturnValue(of(mockPageResponse));

      await component[action]('rg-1');

      expect(mockResearchGroupService[apiMethod]).toHaveBeenCalledWith('rg-1');
      expect(mockToastService.showSuccessKey).toHaveBeenCalledWith(successKey);
      expect(mockResearchGroupService.getResearchGroupsForAdmin).toHaveBeenCalledOnce();
    });

    it.each([
      {
        action: 'onApproveResearchGroup' as const,
        apiMethod: 'activateResearchGroup' as const,
        errorKey: 'researchGroup.adminView.errors.approve',
      },
      { action: 'onDenyResearchGroup' as const, apiMethod: 'denyResearchGroup' as const, errorKey: 'researchGroup.adminView.errors.deny' },
      {
        action: 'onWithdrawResearchGroup' as const,
        apiMethod: 'withdrawResearchGroup' as const,
        errorKey: 'researchGroup.adminView.errors.withdraw',
      },
    ])('$action: should show error and not reload on failure', async ({ action, apiMethod, errorKey }) => {
      mockResearchGroupService[apiMethod].mockReturnValue(throwError(() => new Error('API Error')));

      await component[action]('rg-1');

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith(errorKey);
      expect(mockResearchGroupService.getResearchGroupsForAdmin).not.toHaveBeenCalled();
    });
  });

  describe('Action menu and confirm dialogs', () => {
    it('builds menu items per status and triggers confirm dialogs', async () => {
      component.researchGroups.set([mockResearchGroup1, mockResearchGroup2, mockResearchGroup3]);
      fixture.detectChanges();

      const manageMembersSpy = vi.spyOn(component, 'onManageMembers');
      const manageImagesSpy = vi.spyOn(component, 'onManageImages');

      const menuMap = component.actionMenuItems();

      const draftItems = menuMap.get('rg-1') ?? [];
      const activeItems = menuMap.get('rg-2') ?? [];
      const deniedItems = menuMap.get('rg-3') ?? [];

      expect(draftItems.map(item => item.label)).toEqual([
        'researchGroup.members.manageMembers',
        'researchGroup.imageLibrary.manageButton',
        'button.confirm',
        'button.deny',
      ]);
      expect(activeItems.map(item => item.label)).toEqual([
        'researchGroup.members.manageMembers',
        'researchGroup.imageLibrary.manageButton',
        'button.withdraw',
      ]);
      expect(deniedItems.map(item => item.label)).toEqual(['researchGroup.imageLibrary.manageButton', 'button.confirm']);

      draftItems.find(item => item.label === 'researchGroup.members.manageMembers')?.command?.();
      expect(manageMembersSpy).toHaveBeenCalledWith('rg-1');

      draftItems.find(item => item.label === 'researchGroup.imageLibrary.manageButton')?.command?.();
      expect(manageImagesSpy).toHaveBeenCalledWith('rg-1', 'AI Research Lab');

      draftItems.find(item => item.label === 'button.confirm')?.command?.();
      expect(component.currentResearchGroupId()).toBe('rg-1');
      expect(component.showApproveDialog()).toBe(true);
      component.showApproveDialog.set(false);

      draftItems.find(item => item.label === 'button.deny')?.command?.();
      expect(component.showDenyDialog()).toBe(true);

      activeItems.find(item => item.label === 'button.withdraw')?.command?.();
      expect(component.showWithdrawDialog()).toBe(true);
    });

    it('executes confirm handlers when currentResearchGroupId is set', () => {
      const approveSpy = vi.spyOn(component, 'onApproveResearchGroup').mockResolvedValue(undefined);
      const denySpy = vi.spyOn(component, 'onDenyResearchGroup').mockResolvedValue(undefined);
      const withdrawSpy = vi.spyOn(component, 'onWithdrawResearchGroup').mockResolvedValue(undefined);

      component.currentResearchGroupId.set('rg-1');
      component.onConfirmApprove();
      expect(approveSpy).toHaveBeenCalledWith('rg-1');

      component.currentResearchGroupId.set('rg-2');
      component.onConfirmDeny();
      expect(denySpy).toHaveBeenCalledWith('rg-2');

      component.currentResearchGroupId.set('rg-3');
      component.onConfirmWithdraw();
      expect(withdrawSpy).toHaveBeenCalledWith('rg-3');
    });

    it('does not execute confirm handlers when currentResearchGroupId is missing', () => {
      const approveSpy = vi.spyOn(component, 'onApproveResearchGroup').mockResolvedValue(undefined);
      const denySpy = vi.spyOn(component, 'onDenyResearchGroup').mockResolvedValue(undefined);
      const withdrawSpy = vi.spyOn(component, 'onWithdrawResearchGroup').mockResolvedValue(undefined);

      component.currentResearchGroupId.set(undefined);
      component.onConfirmApprove();
      component.onConfirmDeny();
      component.onConfirmWithdraw();

      expect(approveSpy).not.toHaveBeenCalled();
      expect(denySpy).not.toHaveBeenCalled();
      expect(withdrawSpy).not.toHaveBeenCalled();
    });

    it.each([
      {
        description: 'id is missing',
        setup: () => Object.assign({}, mockResearchGroup1, { id: undefined }),
        groups: [Object.assign({}, mockResearchGroup1, { id: undefined })],
      },
      { description: 'id is present but not in menu map', setup: () => mockResearchGroup2, groups: [] },
    ])('returns empty menu items when $description', ({ setup, groups }) => {
      component.researchGroups.set(groups);
      const items = component.getMenuItems()(setup());
      expect(items).toEqual([]);
    });
  });
});
