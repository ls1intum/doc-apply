import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError, Observable } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';
import { HttpErrorResponse } from '@angular/common/http';

import { ResearchGroupAddMembersComponent } from 'app/usermanagement/research-group/research-group-add-members/research-group-add-members.component';
import { ResearchGroupResourceApi } from 'app/generated/api/research-group-resource-api';
import { UserResourceApi } from 'app/generated/api/user-resource-api';
import { PageResponseDTOUserShortDTO } from 'app/generated/model/page-response-dto-user-short-dto';
import { provideTranslateMock } from 'util/translate.mock';
import { provideToastServiceMock, createToastServiceMock, ToastServiceMock } from 'util/toast-service.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import {
  createDynamicDialogRefMock,
  DynamicDialogRefMock,
  provideDynamicDialogConfigMock,
  provideDynamicDialogRefMock,
} from 'util/dynamicdialogref.mock';
import { KeycloakUserDTO } from 'app/generated/model/keycloak-user-dto';
import { provideHttpClientMock } from 'util/http-client.mock';

describe('ResearchGroupAddMembersComponent', () => {
  let component: ResearchGroupAddMembersComponent;
  let fixture: ComponentFixture<ResearchGroupAddMembersComponent>;
  let mockUserService: {
    getAvailableUsersForResearchGroup: ReturnType<typeof vi.fn>;
  };
  let mockResearchGroupService: {
    addMembersToResearchGroup: ReturnType<typeof vi.fn>;
  };
  let mockDialogRef: DynamicDialogRefMock;
  let mockDialogConfig: DynamicDialogConfig;
  let mockToastService: ToastServiceMock;

  const mockUser1: KeycloakUserDTO = {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    username: 'johndoe',
  };

  const mockUser2: KeycloakUserDTO = {
    id: 'user-2',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
    username: 'janesmith',
  };

  const mockPageResponse: PageResponseDTOUserShortDTO = {
    content: [mockUser1, mockUser2],
    totalElements: 2,
  };

  const withDisplayName = (user: KeycloakUserDTO) => ({
    email: user.email,
    firstName: user.firstName,
    id: user.id,
    lastName: user.lastName,
    universityId: user.universityId,
    displayName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
  });

  const withoutId = (user: KeycloakUserDTO): KeycloakUserDTO => ({
    email: user.email,
    firstName: user.firstName,
    id: undefined,
    lastName: user.lastName,
    universityId: user.universityId,
    username: user.username,
  });

  beforeEach(async () => {
    mockUserService = {
      getAvailableUsersForResearchGroup: vi.fn().mockReturnValue(of({ content: [], totalElements: 0 })),
    };

    mockResearchGroupService = {
      addMembersToResearchGroup: vi.fn(),
    };

    mockDialogRef = createDynamicDialogRefMock();

    mockDialogConfig = {
      data: {
        researchGroupId: 'research-group-1',
      },
    };

    mockToastService = createToastServiceMock();

    await TestBed.configureTestingModule({
      imports: [ResearchGroupAddMembersComponent],
      providers: [
        { provide: UserResourceApi, useValue: mockUserService },
        { provide: ResearchGroupResourceApi, useValue: mockResearchGroupService },
        provideHttpClientMock(),
        provideDynamicDialogRefMock(mockDialogRef),
        provideDynamicDialogConfigMock(mockDialogConfig),
        provideToastServiceMock(mockToastService),
        provideTranslateMock(),
        provideFontAwesomeTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResearchGroupAddMembersComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Load users', () => {
    it('should load available users when a search query is provided', async () => {
      vi.clearAllMocks();
      mockUserService.getAvailableUsersForResearchGroup.mockReturnValue(of(mockPageResponse));

      await component.loadAvailableUsers('john');

      expect(component.users()).toEqual((mockPageResponse.content ?? []).map(withDisplayName));
      expect(component.totalRecords()).toBe(mockPageResponse.totalElements);
      expect(mockUserService.getAvailableUsersForResearchGroup).toHaveBeenCalledWith(5, 0, 'john', 'research-group-1');
    });

    it('should handle empty response', async () => {
      vi.clearAllMocks();
      mockUserService.getAvailableUsersForResearchGroup.mockReturnValue(of({} as PageResponseDTOUserShortDTO));

      await component.loadAvailableUsers('john');

      expect(component.users()).toEqual([]);
      expect(component.totalRecords()).toBe(0);
    });

    it('should show error toast when loading users fails', async () => {
      vi.clearAllMocks();
      mockUserService.getAvailableUsersForResearchGroup.mockReturnValue(throwError(() => new Error('API Error')));

      await component.loadAvailableUsers('john');

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('researchGroup.members.toastMessages.loadUsersFailed');
    });

    it('should reset page and load users when search query changes', async () => {
      component.page.set(2);
      component.searchQuery.set('old-query');
      vi.clearAllMocks();
      mockUserService.getAvailableUsersForResearchGroup.mockReturnValue(of(mockPageResponse));

      component.onSearch('new-query');
      await Promise.resolve();

      expect(component.page()).toBe(0);
      expect(component.searchQuery()).toBe('new-query');
      expect(mockUserService.getAvailableUsersForResearchGroup).toHaveBeenCalledWith(5, 0, 'new-query', 'research-group-1');
    });

    it('should not reload users when search query is the same', () => {
      component.searchQuery.set('same-query');
      vi.clearAllMocks();

      component.onSearch('same-query');

      expect(mockUserService.getAvailableUsersForResearchGroup).not.toHaveBeenCalled();
    });

    it('should clear users when given an empty query', async () => {
      component.users.set([withDisplayName(mockUser1)]);
      component.totalRecords.set(1);
      vi.clearAllMocks();

      await component.loadAvailableUsers();

      expect(component.users()).toEqual([]);
      expect(component.totalRecords()).toBe(0);
      expect(mockUserService.getAvailableUsersForResearchGroup).not.toHaveBeenCalled();
    });

    it('should not load users for queries shorter than MIN_SEARCH_LENGTH', async () => {
      vi.clearAllMocks();

      await component.loadAvailableUsers('ab');

      expect(mockUserService.getAvailableUsersForResearchGroup).not.toHaveBeenCalled();
    });

    it('should ignore stale requests and only apply the latest result', async () => {
      vi.clearAllMocks();

      let firstSubscriber: { next: (value: PageResponseDTOUserShortDTO) => void; complete: () => void } | undefined;
      const first$ = new Observable<PageResponseDTOUserShortDTO>(sub => {
        firstSubscriber = sub;
      });

      let secondSubscriber: { next: (value: PageResponseDTOUserShortDTO) => void; complete: () => void } | undefined;
      const second$ = new Observable<PageResponseDTOUserShortDTO>(sub => {
        secondSubscriber = sub;
      });

      mockUserService.getAvailableUsersForResearchGroup.mockReturnValueOnce(first$).mockReturnValueOnce(second$);

      const p1 = component.loadAvailableUsers('wag');
      const p2 = component.loadAvailableUsers('wagne');

      if (secondSubscriber) {
        secondSubscriber.next({ content: [mockUser2], totalElements: 1 });
        secondSubscriber.complete();
      }
      await p2;

      expect(component.users()).toEqual([withDisplayName(mockUser2)]);

      if (firstSubscriber) {
        firstSubscriber.next({ content: [mockUser1], totalElements: 1 });
        firstSubscriber.complete();
      }
      await p1;

      expect(component.users()).toEqual([withDisplayName(mockUser2)]);
      expect(mockToastService.showErrorKey).not.toHaveBeenCalled();
    });
  });

  describe('Pagination', () => {
    it('should update page and pageSize and load users on page change', async () => {
      vi.clearAllMocks();
      mockUserService.getAvailableUsersForResearchGroup.mockReturnValue(of(mockPageResponse));
      component.searchQuery.set('test-search');

      component.onPageChange({ first: 20, rows: 10 });
      await Promise.resolve();

      expect(component.page()).toBe(2);
      expect(component.pageSize()).toBe(10);
      expect(mockUserService.getAvailableUsersForResearchGroup).toHaveBeenCalledWith(10, 2, 'test-search', 'research-group-1');
    });

    it('should fall back to defaults for undefined first/rows', async () => {
      vi.clearAllMocks();
      mockUserService.getAvailableUsersForResearchGroup.mockReturnValue(of(mockPageResponse));
      component.searchQuery.set('abc');

      component.onPageChange({});
      await Promise.resolve();

      expect(component.page()).toBe(0);
      expect(component.pageSize()).toBe(5);
    });
  });

  describe('User Selection', () => {
    it('should toggle user selection on and off and support multiple selections', () => {
      component.toggleUserSelection(mockUser1);
      expect(component.selectedUserCount()).toBe(1);
      expect(component.isUserSelected(mockUser1)).toBe(true);

      component.toggleUserSelection(mockUser2);
      expect(component.selectedUserCount()).toBe(2);

      component.toggleUserSelection(mockUser1);
      expect(component.selectedUserCount()).toBe(1);
      expect(component.isUserSelected(mockUser1)).toBe(false);
    });

    it('should show error toast when toggling user with undefined id', () => {
      component.toggleUserSelection(withoutId(mockUser1));

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('researchGroup.members.toastMessages.invalidUser');
      expect(component.selectedUserCount()).toBe(0);
    });

    it('should return false for isUserSelected when user has no id', () => {
      expect(component.isUserSelected(withoutId(mockUser1))).toBe(false);
    });
  });

  describe('Dialog Actions', () => {
    it('should close dialog on cancel', () => {
      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });

    it('should not add members when no users are selected', async () => {
      await component.onAddMembers();

      expect(mockResearchGroupService.addMembersToResearchGroup).not.toHaveBeenCalled();
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('should add members successfully and close dialog with true', async () => {
      component.toggleUserSelection(mockUser1);
      component.toggleUserSelection(mockUser2);
      mockResearchGroupService.addMembersToResearchGroup.mockReturnValue(of(void 0));

      await component.onAddMembers();

      expect(mockResearchGroupService.addMembersToResearchGroup).toHaveBeenCalledWith({
        keycloakUsers: [mockUser1, mockUser2],
        researchGroupId: 'research-group-1',
        role: 'EMPLOYEE',
      });
      expect(mockToastService.showSuccessKey).toHaveBeenCalledWith('researchGroup.members.toastMessages.addMembersSuccess');
      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });

    it('should show error toast and close with false when adding fails', async () => {
      component.toggleUserSelection(mockUser1);
      mockResearchGroupService.addMembersToResearchGroup.mockReturnValue(throwError(() => new Error('API Error')));

      await component.onAddMembers();

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('researchGroup.members.toastMessages.addMembersFailed');
      expect(mockDialogRef.close).toHaveBeenCalledWith(false);
    });

    it('should show already-member error toast on OPERATION_NOT_ALLOWED', async () => {
      component.toggleUserSelection(mockUser1);
      const apiError = {
        errorCode: 'OPERATION_NOT_ALLOWED',
        message: "User with universityId 'ab12abc' is already a member of research group.",
      };
      mockResearchGroupService.addMembersToResearchGroup.mockReturnValue(
        throwError(() => new HttpErrorResponse({ error: apiError, status: 400 })),
      );

      await component.onAddMembers();

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('researchGroup.members.toastMessages.addMembersFailedAlreadyMember');
    });

    it('should show invalid-university-id error toast when server returns invalid universityId error', async () => {
      component.toggleUserSelection(mockUser1);
      const apiError = { message: 'User does not have a valid universityId' };
      mockResearchGroupService.addMembersToResearchGroup.mockReturnValue(
        throwError(() => new HttpErrorResponse({ error: apiError, status: 400 })),
      );

      await component.onAddMembers();

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('researchGroup.members.toastMessages.addMembersFailedInvalidUniversityId');
      expect(mockDialogRef.close).toHaveBeenCalledWith(false);
    });

    it('should add members with undefined researchGroupId', async () => {
      mockDialogConfig.data = undefined;
      component.toggleUserSelection(mockUser1);
      mockResearchGroupService.addMembersToResearchGroup.mockReturnValue(of(void 0));

      await component.onAddMembers();

      expect(mockResearchGroupService.addMembersToResearchGroup).toHaveBeenCalledWith({
        keycloakUsers: [mockUser1],
        researchGroupId: undefined,
        role: 'EMPLOYEE',
      });
    });
  });

  describe('Role Selection', () => {
    it('should default the role to EMPLOYEE', () => {
      expect(component.selectedRole()).toBe('EMPLOYEE');
    });

    it('should pass the selected role through to the add-members API call', async () => {
      component.toggleUserSelection(mockUser1);
      component.toggleUserSelection(mockUser2);
      component.selectedRole.set('PROFESSOR');
      mockResearchGroupService.addMembersToResearchGroup.mockReturnValue(of(void 0));

      await component.onAddMembers();

      expect(mockResearchGroupService.addMembersToResearchGroup).toHaveBeenCalledWith(expect.objectContaining({ role: 'PROFESSOR' }));
    });
  });

  describe('State Persistence', () => {
    it('should maintain selection state across page changes', async () => {
      component.toggleUserSelection(mockUser1);
      expect(component.selectedUserCount()).toBe(1);

      mockUserService.getAvailableUsersForResearchGroup.mockReturnValue(of(mockPageResponse));
      component.onPageChange({ first: 10, rows: 10 });
      await Promise.resolve();

      expect(component.selectedUserCount()).toBe(1);
      expect(component.isUserSelected(mockUser1)).toBe(true);
    });

    it('should maintain selection state across search queries', async () => {
      component.toggleUserSelection(mockUser1);
      component.toggleUserSelection(mockUser2);
      expect(component.selectedUserCount()).toBe(2);

      mockUserService.getAvailableUsersForResearchGroup.mockReturnValue(of(mockPageResponse));
      component.onSearch('new-search');
      await Promise.resolve();

      expect(component.selectedUserCount()).toBe(2);
      expect(component.isUserSelected(mockUser1)).toBe(true);
      expect(component.isUserSelected(mockUser2)).toBe(true);
    });
  });
});
