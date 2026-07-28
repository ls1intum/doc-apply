import { WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NavigationEnd, NavigationStart } from '@angular/router';

import { TranslateService } from '@ngx-translate/core';
import { provideTranslateMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';

import { IdpProvider } from 'app/core/auth/keycloak-authentication.service';
import { User } from 'app/core/auth/account.service';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';

import { HeaderComponent } from 'app/shared/components/organisms/header/header.component';
import { MobileSidebarService } from 'app/service/mobile-sidebar.service';
import { createRouterMock, provideRouterMock, RouterMock } from 'util/router.mock';
import { AccountServiceMock, createAccountServiceMock, provideAccountServiceMock } from 'util/account.service.mock';
import { AuthFacadeServiceMock, createAuthFacadeServiceMock, provideAuthFacadeServiceMock } from 'util/auth-facade.service.mock';
import {
  AuthDialogServiceMock,
  createAuthDialogServiceMock,
  provideAuthDialogServiceMock,
} from '../../../../../util/auth-dialog.service.mock';
import { setupWindowMatchMediaMock, createThemeServiceMock, provideThemeServiceMock, ThemeServiceMock } from 'util/theme.service.mock';

type HeaderComponentTestInstance = Omit<HeaderComponent, 'routeAuthorities' | 'isProfessorPage'> & {
  routeAuthorities: () => UserShortDTORolesEnum[] | string[];
  isProfessorPage: () => boolean;
};

type AuthDialogOpenArgs = {
  mode: 'login';
  onSuccess: () => void;
};

describe('HeaderComponent', () => {
  let fixture: ComponentFixture<HeaderComponent>;
  let component: HeaderComponentTestInstance;

  let router: RouterMock;
  let accountService: AccountServiceMock;
  let authFacade: AuthFacadeServiceMock;
  let authDialog: AuthDialogServiceMock;
  let translate: TranslateService;
  let themeService: ThemeServiceMock;

  beforeEach(async () => {
    setupWindowMatchMediaMock();

    router = createRouterMock();
    accountService = createAccountServiceMock();
    authFacade = createAuthFacadeServiceMock();
    authDialog = createAuthDialogServiceMock();
    themeService = createThemeServiceMock();

    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouterMock(router),
        provideAccountServiceMock(accountService),
        provideAuthFacadeServiceMock(authFacade),
        provideAuthDialogServiceMock(authDialog),
        provideThemeServiceMock(themeService),
        provideTranslateMock(),
        provideFontAwesomeTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance as HeaderComponentTestInstance;
    fixture.detectChanges();

    translate = TestBed.inject(TranslateService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('onLogoClick', () => {
    it.each<[string, UserShortDTORolesEnum[], string, boolean, string[]]>([
      ['professor', [UserShortDTORolesEnum.Professor], '/', true, ['/professor']],
      ['employee', [UserShortDTORolesEnum.Employee], '/', true, ['/professor']],
      ['signed-out user on the public /professor page', [], '/professor', false, ['/professor']],
      ['signed-in user on /professor without professor portal roles', [], '/professor', true, ['/']],
    ])('should navigate to the correct landing page for %s', (_desc, authorities, url, signedIn, expectedRoute) => {
      router.url = url;
      (accountService.signedIn as WritableSignal<boolean>).set(signedIn);
      accountService.setAuthorities(authorities);

      fixture = TestBed.createComponent(HeaderComponent);
      component = fixture.componentInstance as HeaderComponentTestInstance;
      fixture.detectChanges();

      component.navigateToHome();

      expect(router.navigate).toHaveBeenCalledWith(expectedRoute);
    });

    it.each([
      ['plain left-click without modifiers', { button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, true, true],
      ['middle-click', { button: 1, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, false, false],
      ['left-click with modifier keys', { button: 0, ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, false, false],
    ])('should handle onLogoClick: %s', (_desc, eventProps, shouldPrevent, shouldNavigate) => {
      const navSpy = vi.spyOn(component, 'navigateToHome');
      const mockEvent = {
        button: eventProps.button,
        ctrlKey: eventProps.ctrlKey,
        metaKey: eventProps.metaKey,
        shiftKey: eventProps.shiftKey,
        altKey: eventProps.altKey,
        preventDefault: vi.fn(),
      } as unknown as MouseEvent;

      component.onLogoClick(mockEvent);

      if (shouldPrevent) {
        expect(mockEvent.preventDefault).toHaveBeenCalledOnce();
      } else {
        expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      }

      if (shouldNavigate) {
        expect(navSpy).toHaveBeenCalledOnce();
      } else {
        expect(navSpy).not.toHaveBeenCalled();
      }
    });
  });

  describe('isProfessorPage', () => {
    it.each<[string, UserShortDTORolesEnum[], string, boolean, boolean]>([
      ['account has PROFESSOR authority', [UserShortDTORolesEnum.Professor], '/', true, true],
      ['account has EMPLOYEE authority', [UserShortDTORolesEnum.Employee], '/', true, true],
      ['public /professor landing page when signed out', [], '/professor', false, true],
      ['signed-in user on /professor without professor portal roles', [], '/professor', true, false],
    ])('should derive professor page state when %s', (_desc, authorities, url, signedIn, expected) => {
      router.url = url;
      (accountService.signedIn as WritableSignal<boolean>).set(signedIn);
      accountService.setAuthorities(authorities);

      fixture = TestBed.createComponent(HeaderComponent);
      component = fixture.componentInstance as HeaderComponentTestInstance;
      fixture.detectChanges();

      expect(component.isProfessorPage()).toBe(expected);
    });

    it.each<[string, UserShortDTORolesEnum[], boolean]>([
      ['route data only contains Professor', [UserShortDTORolesEnum.Professor], true],
      [
        'route data mixes Professor with non-professor roles and user lacks professor portal roles',
        [UserShortDTORolesEnum.Admin, UserShortDTORolesEnum.Professor, UserShortDTORolesEnum.Applicant, UserShortDTORolesEnum.Employee],
        false,
      ],
    ])('should derive isProfessorPage from route data when %s', (_desc, authorities, expected) => {
      router.url = '/some-route';
      accountService.setAuthorities([]);
      router.routerState.snapshot.root.data = { authorities };

      fixture = TestBed.createComponent(HeaderComponent);
      component = fixture.componentInstance as HeaderComponentTestInstance;
      fixture.detectChanges();

      expect(component.isProfessorPage()).toBe(expected);
    });

    it('should consider page as professor page when nested route snapshot contains Professor role', () => {
      router.url = '/some-nested-route';
      accountService.setAuthorities([]);

      (
        router.routerState.snapshot.root as {
          firstChild: unknown;
          data: Record<string, unknown>;
        }
      ).firstChild = {
        firstChild: {
          firstChild: null,
          data: { authorities: [UserShortDTORolesEnum.Professor] },
        },
        data: {},
      };

      fixture = TestBed.createComponent(HeaderComponent);
      component = fixture.componentInstance as HeaderComponentTestInstance;
      fixture.detectChanges();

      expect(component.isProfessorPage()).toBe(true);
    });

    it('should update isProfessorPage when NavigationEnd occurs and nested child has authorities', () => {
      router.url = '/some-other-route';
      accountService.setAuthorities([]);

      fixture = TestBed.createComponent(HeaderComponent);
      component = fixture.componentInstance as HeaderComponentTestInstance;
      fixture.detectChanges();

      (
        router.routerState.snapshot.root as {
          firstChild: unknown;
          data: Record<string, unknown>;
        }
      ).firstChild = {
        firstChild: {
          firstChild: null,
          data: { authorities: [UserShortDTORolesEnum.Professor] },
        },
        data: {},
      };

      router.events.next(new NavigationEnd(1, '/some-other-route', '/some-other-route'));
      fixture.detectChanges();

      expect(component.isProfessorPage()).toBe(true);
    });
  });

  describe('toggleProfileMenu', () => {
    it('should call profileMenu toggle method with event', () => {
      accountService.user.set({ id: '1', email: 'test@example.com', name: 'testuser' } satisfies User);
      fixture.detectChanges();

      const mockEvent = new MouseEvent('click');
      const menuComponent = component.profileMenu();
      const toggleSpy = vi.spyOn(menuComponent!, 'toggle');

      component.toggleProfileMenu(mockEvent);

      expect(toggleSpy).toHaveBeenCalledWith(mockEvent);
    });

    it('should not throw when profileMenu is undefined', () => {
      vi.spyOn(component, 'profileMenu').mockReturnValue(undefined);

      expect(() => component.toggleProfileMenu(new MouseEvent('click'))).not.toThrow();
    });
  });

  describe('profileMenuItems', () => {
    it('should return empty array when user is not authenticated', () => {
      accountService.user.set(undefined);
      fixture.detectChanges();

      expect(component.profileMenuItems()).toEqual([]);
    });

    it('should return settings and logout menu items wired to component handlers when authenticated', () => {
      accountService.user.set({ id: '1', email: 'test@example.com', name: 'testuser' } satisfies User);
      const navigateSpy = vi.spyOn(component, 'navigateToSettings');
      const logoutSpy = vi.spyOn(component, 'logout');
      fixture.detectChanges();

      const menuItems = component.profileMenuItems();
      expect(menuItems).toHaveLength(2);
      expect(menuItems[0]).toMatchObject({ label: 'header.settings', icon: 'gear', severity: 'primary' });
      expect(menuItems[1]).toMatchObject({ label: 'header.logout', icon: 'right-from-bracket', severity: 'danger' });

      menuItems[0]?.command?.();
      expect(navigateSpy).toHaveBeenCalledOnce();
      expect(router.navigate).toHaveBeenCalledWith(['/settings']);

      menuItems[1]?.command?.();
      expect(logoutSpy).toHaveBeenCalledOnce();
    });
  });

  describe('login & logout', () => {
    it('should open login dialog when login is called on applicant page', () => {
      component.isProfessorPage = () => false;

      component.login();

      expect(authDialog.open).toHaveBeenCalledOnce();
      const args = authDialog.open.mock.calls[0]?.[0] as AuthDialogOpenArgs;
      expect(args.mode).toBe('login');
      expect(authFacade.loginWithProvider).not.toHaveBeenCalled();
    });

    it('should perform TUM SSO login when login is called on professor page', () => {
      component.isProfessorPage = () => true;
      router.url = '/professor';

      component.login();

      expect(authDialog.open).not.toHaveBeenCalled();
      expect(authFacade.loginWithProvider).toHaveBeenCalledOnce();
      expect(authFacade.loginWithProvider).toHaveBeenCalledWith(IdpProvider.TUM, '/professor');
    });

    it('should call logout on authFacadeService when logout is called', () => {
      component.logout();

      expect(authFacade.logout).toHaveBeenCalledOnce();
    });
  });

  describe('language handling', () => {
    it('should change language when supported language is toggled', () => {
      const useSpy = vi.spyOn(translate, 'use');
      const firstLanguage = component.languages[0];

      component.toggleLanguage(firstLanguage);

      expect(useSpy).toHaveBeenCalledOnce();
      expect(useSpy).toHaveBeenCalledWith(firstLanguage.toLowerCase());
    });

    it('should warn when unsupported language is toggled', () => {
      const useSpy = vi.spyOn(translate, 'use');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      component.toggleLanguage('XX');

      expect(useSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0]?.[0]).toContain('Unsupported language: XX');
    });

    it('should default to EN for currentLanguage when translateService has no current lang', () => {
      vi.spyOn(translate, 'getCurrentLang').mockReturnValue('');
      fixture = TestBed.createComponent(HeaderComponent);
      component = fixture.componentInstance as HeaderComponentTestInstance;
      fixture.detectChanges();

      expect(component.currentLanguage()).toBe('EN');
    });
  });

  describe('theme handling', () => {
    beforeEach(() => {
      document.documentElement.classList.remove('docapply-dark-mode', 'theme-switching');
      localStorage.clear();
    });

    it.each<['dark' | 'light']>([['dark'], ['light']])('should set theme to %s via themeService', target => {
      component.themeService.setTheme(target);

      expect(themeService.setTheme).toHaveBeenCalledWith(target);
      expect(themeService.theme()).toBe(target);
    });
  });

  describe('mobile drawers close on NavigationStart', () => {
    it('should close the anonymous burger menu when navigation starts', () => {
      component.mobileMenuOpen.set(true);
      router.events.next(new NavigationStart(1, '/jobs'));

      expect(component.mobileMenuOpen()).toBe(false);
    });

    it('should close the logged-in mobile sidebar when navigation starts', () => {
      const mobileSidebar = TestBed.inject(MobileSidebarService);
      mobileSidebar.open.set(true);
      router.events.next(new NavigationStart(1, '/settings'));

      expect(mobileSidebar.open()).toBe(false);
    });
  });
});
