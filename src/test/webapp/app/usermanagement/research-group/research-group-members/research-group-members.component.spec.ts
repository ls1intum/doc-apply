import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { of, throwError } from 'rxjs';

import { ResearchGroupMembersComponent } from 'app/usermanagement/research-group/research-group-members/research-group-members.component';
import { UserShortDTO, UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';
import { PageResponseDTOUserShortDTO } from 'app/generated/model/page-response-dto-user-short-dto';
import { ResearchGroupDTO } from 'app/generated/model/research-group-dto';
import { provideTranslateMock } from 'util/translate.mock';
import { provideToastServiceMock, createToastServiceMock } from 'util/toast-service.mock';
import { provideDialogServiceMock } from 'util/dialog.service.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { createAccountServiceMock, provideAccountServiceMock } from 'util/account.service.mock';
import { ActivatedRouteMock, createActivatedRouteMock, provideActivatedRouteMock } from 'util/activated-route.mock';
import { createRouterMock, provideRouterMock, RouterMock } from 'util/router.mock';
import {
  createResearchGroupResourceApiMock,
  provideResearchGroupResourceApiMock,
  ResearchGroupResourceApiMock,
} from 'util/research-group-resource-api.service.mock';
import { TablePageEvent } from 'app/shared/components/organisms/dynamic-table/dynamic-table.component';

describe('ResearchGroupMembersComponent', () => {
  let component: ResearchGroupMembersComponent;
  let fixture: ComponentFixture<ResearchGroupMembersComponent>;
  let mockResearchGroupApi: ResearchGroupResourceApiMock;
  let mockToastService: ReturnType<typeof createToastServiceMock>;
  let mockAccountService: ReturnType<typeof createAccountServiceMock>;
  let mockActivatedRoute: ActivatedRouteMock;
  let mockRouter: RouterMock;

  const mockUserData: UserShortDTO = {
    userId: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    roles: [UserShortDTORolesEnum.Professor],
  };

  const mockCurrentUser: UserShortDTO = {
    userId: 'current-user',
    firstName: 'Current',
    lastName: 'User',
    roles: [UserShortDTORolesEnum.Admin],
  };

  const mockPageResponse: PageResponseDTOUserShortDTO = {
    content: [mockUserData, mockCurrentUser],
    totalElements: 2,
  };

  beforeEach(async () => {
    mockResearchGroupApi = createResearchGroupResourceApiMock();
    mockResearchGroupApi.getResearchGroupMembers.mockReturnValue(of({ content: [], totalElements: 0 }));
    mockResearchGroupApi.getResearchGroupMembersById.mockReturnValue(of({ content: [], totalElements: 0 }));
    mockActivatedRoute = createActivatedRouteMock();
    mockToastService = createToastServiceMock();
    mockAccountService = createAccountServiceMock();
    mockAccountService.user.set({ id: 'current-user', name: 'Current User', email: 'test@test.com', authorities: [] });
    mockRouter = createRouterMock();

    await TestBed.configureTestingModule({
      imports: [ResearchGroupMembersComponent],
      providers: [
        provideResearchGroupResourceApiMock(mockResearchGroupApi),
        provideAccountServiceMock(mockAccountService),
        provideDialogServiceMock(),
        provideToastServiceMock(mockToastService),
        provideTranslateMock(),
        provideFontAwesomeTesting(),
        provideActivatedRouteMock(mockActivatedRoute),
        provideRouterMock(mockRouter),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResearchGroupMembersComponent);
    component = fixture.componentInstance;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should load members on init via table lazy load', () => {
    mockResearchGroupApi.getResearchGroupMembers.mockReturnValue(of(mockPageResponse));
    fixture.detectChanges();
    expect(mockResearchGroupApi.getResearchGroupMembers).toHaveBeenCalledWith(10, 0);
  });

  it('should load members by ID when route param is present', () => {
    mockResearchGroupApi.getResearchGroupMembersById.mockReturnValue(of(mockPageResponse));

    mockActivatedRoute.setParams({ id: '123' });
    fixture.detectChanges();

    expect(mockResearchGroupApi.getResearchGroupMembersById).toHaveBeenCalledWith('123', 10, 0);
  });

  it('should load members by ID when query param is present', () => {
    mockResearchGroupApi.getResearchGroupMembersById.mockReturnValue(of(mockPageResponse));

    mockActivatedRoute.setQueryParams({ researchGroupId: '456' });
    mockActivatedRoute.setParams({});
    fixture.detectChanges();

    expect(mockResearchGroupApi.getResearchGroupMembersById).toHaveBeenCalledWith('456', 10, 0);
  });

  it('should update page number and load members on table emit', () => {
    const event: TablePageEvent = { first: 20, rows: 10 };
    mockResearchGroupApi.getResearchGroupMembers.mockReturnValue(of(mockPageResponse));

    component.loadOnTableEmit(event);

    expect(component.pageNumber()).toBe(2);
    expect(mockResearchGroupApi.getResearchGroupMembers).toHaveBeenCalledWith(10, 2);
  });

  it('should populate members and total on successful load', async () => {
    mockResearchGroupApi.getResearchGroupMembers.mockReturnValue(of(mockPageResponse));

    await component.loadMembers();

    expect(component.members()).toEqual(mockPageResponse.content);
    expect(component.total()).toBe(mockPageResponse.totalElements);
  });

  it('should handle empty response when loading members', async () => {
    mockResearchGroupApi.getResearchGroupMembers.mockReturnValue(of({} as PageResponseDTOUserShortDTO));

    await component.loadMembers();

    expect(component.members()).toEqual([]);
    expect(component.total()).toBe(0);
  });

  it('should show error toast when loading members fails', async () => {
    mockResearchGroupApi.getResearchGroupMembers.mockReturnValue(throwError(() => new Error('API Error')));

    await component.loadMembers();

    expect(mockToastService.showErrorKey).toHaveBeenCalledWith('researchGroup.members.toastMessages.loadFailed');
  });

  it('should remove member and reload', async () => {
    mockResearchGroupApi.removeMemberFromResearchGroup.mockReturnValue(of(void 0));
    mockResearchGroupApi.getResearchGroupMembers.mockReturnValue(of(mockPageResponse));

    await component.removeMember(mockUserData);

    expect(mockResearchGroupApi.removeMemberFromResearchGroup).toHaveBeenCalledWith('user-1');
    expect(mockToastService.showSuccessKey).toHaveBeenCalledWith('researchGroup.members.toastMessages.removeSuccess', {
      memberName: 'John Doe',
    });
    expect(mockResearchGroupApi.getResearchGroupMembers).toHaveBeenCalledWith(10, 0);
  });

  it('should show error toast and not reload when remove fails', async () => {
    mockResearchGroupApi.removeMemberFromResearchGroup.mockReturnValue(throwError(() => new Error('API Error')));

    await component.removeMember(mockUserData);

    expect(mockToastService.showErrorKey).toHaveBeenCalledWith('researchGroup.members.toastMessages.removeFailed', {
      memberName: 'John Doe',
    });
    expect(mockResearchGroupApi.getResearchGroupMembers).not.toHaveBeenCalled();
  });

  it('should default missing userId to empty string when removing', async () => {
    const memberWithoutId: UserShortDTO = {
      userId: undefined,
      firstName: 'John',
      lastName: 'Doe',
      roles: [UserShortDTORolesEnum.Professor],
    };
    mockResearchGroupApi.removeMemberFromResearchGroup.mockReturnValue(of(void 0));
    mockResearchGroupApi.getResearchGroupMembers.mockReturnValue(of(mockPageResponse));

    await component.removeMember(memberWithoutId);

    expect(mockResearchGroupApi.removeMemberFromResearchGroup).toHaveBeenCalledWith('');
  });

  it('should transform members data and identify current user in tableData', () => {
    component.members.set([mockUserData, mockCurrentUser]);

    const tableData = component.tableData();

    expect(tableData[0]).toEqual({
      userId: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      roles: [UserShortDTORolesEnum.Professor],
      name: 'John Doe',
      role: 'Professor',
      isCurrentUser: false,
      canRemove: true,
    });
    expect(tableData[1].isCurrentUser).toBe(true);
    expect(tableData[1].canRemove).toBe(false);
  });

  it('should show no-role text when roles is undefined or empty', () => {
    component.members.set([{ userId: 'user-1', firstName: 'John', lastName: 'Doe', roles: undefined }]);
    expect(component.tableData()[0].role).toBe('researchGroup.members.noRole');

    component.members.set([{ userId: 'user-1', firstName: 'John', lastName: 'Doe', roles: [] }]);
    expect(component.tableData()[0].role).toBe('researchGroup.members.noRole');
  });

  describe('openAddMembersModal', () => {
    let dialogService: DialogService;

    beforeEach(() => {
      dialogService = TestBed.inject(DialogService);
      mockResearchGroupApi.getResearchGroupMembers.mockReturnValue(of(mockPageResponse));
      fixture.detectChanges();
      vi.clearAllMocks();
    });

    it('should reload members when add members modal closes with true', () => {
      vi.spyOn(dialogService, 'open').mockReturnValue({ onClose: of(true) } as DynamicDialogRef);

      component.openAddMembersModal();

      expect(mockResearchGroupApi.getResearchGroupMembers).toHaveBeenCalledOnce();
    });

    it('should NOT reload members when add members modal closes with false', () => {
      vi.spyOn(dialogService, 'open').mockReturnValue({ onClose: of(false) } as DynamicDialogRef);

      component.openAddMembersModal();

      expect(mockResearchGroupApi.getResearchGroupMembers).not.toHaveBeenCalled();
    });
  });

  it('should not allow employee to remove members regardless of target role', () => {
    mockAccountService.user.update(user => {
      if (!user) return user;
      return { id: user.id, name: user.name, email: user.email, authorities: [UserShortDTORolesEnum.Employee] };
    });
    component.members.set([
      { userId: 'user-1', firstName: 'John', lastName: 'Doe', roles: [UserShortDTORolesEnum.Professor] },
      { userId: 'user-2', firstName: 'Jane', lastName: 'Smith', roles: [UserShortDTORolesEnum.Employee] },
    ]);

    const rows = component.tableData();

    expect(rows[0].canRemove).toBe(false);
    expect(rows[1].canRemove).toBe(false);
  });

  it('should load research group name', async () => {
    mockResearchGroupApi.getResearchGroup.mockReturnValue(of({ name: 'AI Lab' } as ResearchGroupDTO));

    await component['loadResearchGroupName']('group-1');

    expect(component.researchGroupName()).toBe('AI Lab');
  });

  it('should clear research group name when loading fails', async () => {
    mockResearchGroupApi.getResearchGroup.mockReturnValue(throwError(() => new Error('API Error')));
    component.researchGroupName.set('Existing Name');

    await component['loadResearchGroupName']('group-2');

    expect(component.researchGroupName()).toBeUndefined();
  });

  it.each([
    { description: 'has Employee role', authorities: [UserShortDTORolesEnum.Employee], expected: true },
    { description: 'lacks Employee role', authorities: [UserShortDTORolesEnum.Professor], expected: false },
  ])('should compute isEmployee=$expected when user $description', ({ authorities, expected }) => {
    mockAccountService.user.update(user => {
      if (!user) return user;
      return { id: user.id, name: user.name, email: user.email, authorities };
    });

    expect(component.isEmployee()).toBe(expected);
  });

  it('should compute isEmployee=false when user is undefined', () => {
    mockAccountService.user.set(undefined);

    expect(component.isEmployee()).toBe(false);
  });
});
