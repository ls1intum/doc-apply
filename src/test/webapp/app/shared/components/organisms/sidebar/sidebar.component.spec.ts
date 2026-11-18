import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SidebarComponent } from 'app/shared/components/organisms/sidebar/sidebar.component';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';
import { provideTranslateMock } from '../../../../../util/translate.mock';
import { AccountServiceMock, createAccountServiceMock, provideAccountServiceMock } from '../../../../../util/account.service.mock';
import { createRouterMock, provideRouterMock, RouterMock } from '../../../../../util/router.mock';
import { provideFontAwesomeTesting } from '../../../../../util/fontawesome.testing';
import { User } from 'app/core/auth/account.service';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;

  let accountService: AccountServiceMock;
  let router: RouterMock;

  beforeEach(async () => {
    accountService = createAccountServiceMock();
    router = createRouterMock();

    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideTranslateMock(),
        provideFontAwesomeTesting(),
        provideAccountServiceMock(accountService),
        provideRouterMock(router),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('isSidebarCollapsed', false);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should emit sidebarCollapsedChange with the opposite value when toggleSidebar called', () => {
    const emitSpy = vi.spyOn(component.sidebarCollapsedChange, 'emit');

    component.toggleSidebar();

    expect(emitSpy).toHaveBeenCalledWith(true);
  });

  describe('categories getter', () => {
    it('should return undefined if user is not logged in', () => {
      accountService.user.set(undefined);
      fixture.detectChanges();
      expect(component.categories).toBeUndefined();
    });

    it.each<[UserShortDTORolesEnum, number]>([
      [UserShortDTORolesEnum.Applicant, 2],
      [UserShortDTORolesEnum.Professor, 3],
    ])('should return %i categories for role %s', (role, expectedLength) => {
      accountService.user.set({ authorities: [role] } as User);
      fixture.detectChanges();
      expect(component.categories).toHaveLength(expectedLength);
    });
  });

  describe('isActive method', () => {
    it.each<[string, string, string, boolean]>([
      ['exact match', '/job-overview', '/job-overview', true],
      ['prefix match', '/job/create/123', '/job/create', true],
      ['root path', '/', '/', true],
      ['partial prefix non-match', '/job-overview-something', '/job-overview', false],
      ['custom group main path', '/application/overview', '/application/overview', true],
      ['custom group sub path', '/application/detail/456', '/application/overview', true],
      ['ignore query parameters', '/job-overview?param=value', '/job-overview', true],
      ['non-matching link', '/some/other/path', '/job-overview', false],
    ])('should resolve isActive for %s', (_desc, url, link, expected) => {
      router.url = url;
      router.events.next(new NavigationEnd(1, url, url));
      expect(component.isActive(link)).toBe(expected);
    });
  });
});
