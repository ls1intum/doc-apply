import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsComponent } from 'app/shared/settings/settings.component';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';
import { createThemeServiceMock, provideThemeServiceMock, setupWindowMatchMediaMock } from '../../../util/theme.service.mock';
import { createTranslateServiceMock, provideTranslateMock } from '../../../util/translate.mock';
import { EmailSettingResourceApi } from 'app/generated/api/email-setting-resource-api';
import { createAccountServiceMock, provideAccountServiceMock } from '../../../util/account.service.mock';
import { createToastServiceMock, provideToastServiceMock } from '../../../util/toast-service.mock';
import { UserDataExportResourceApi } from 'app/generated/api/user-data-export-resource-api';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { createActivatedRouteMock, provideActivatedRouteMock } from '../../../util/activated-route.mock';

describe('SettingsComponent', () => {
  let accountServiceMock: ReturnType<typeof createAccountServiceMock>;
  let translateMock: ReturnType<typeof createTranslateServiceMock>;
  let themeServiceMock: ReturnType<typeof createThemeServiceMock>;
  const activatedRouteMock = createActivatedRouteMock();

  const emailSettingServiceMock = {
    getEmailSettings: vi.fn(),
    updateEmailSettings: vi.fn(),
  };

  const toastServiceMock = createToastServiceMock();

  const userDataExportServiceMock = {
    exportUserData: vi.fn(),
  };

  beforeEach(() => {
    setupWindowMatchMediaMock();

    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }

    global.ResizeObserver = ResizeObserverMock;

    accountServiceMock = createAccountServiceMock();
    translateMock = createTranslateServiceMock();
    themeServiceMock = createThemeServiceMock();

    TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        provideAccountServiceMock(accountServiceMock),
        provideTranslateMock(translateMock),
        provideThemeServiceMock(themeServiceMock),
        provideToastServiceMock(toastServiceMock),
        provideActivatedRouteMock(activatedRouteMock),
        provideFontAwesomeTesting(),
        { provide: EmailSettingResourceApi, useValue: emailSettingServiceMock },
        { provide: UserDataExportResourceApi, useValue: userDataExportServiceMock },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('role()', () => {
    it('should derive role from AccountService user authorities', () => {
      accountServiceMock.user.set({
        id: 'u1',
        name: 'Test User',
        email: 'user@test.com',
        authorities: [UserShortDTORolesEnum.Professor],
      });
      expect(TestBed.createComponent(SettingsComponent).componentInstance.role()).toBe(UserShortDTORolesEnum.Professor);

      accountServiceMock.user.set(undefined);
      expect(TestBed.createComponent(SettingsComponent).componentInstance.role()).toBeUndefined();

      accountServiceMock.user.set({ id: 'u1', name: 'X', email: 'x@x.com', authorities: [] });
      expect(TestBed.createComponent(SettingsComponent).componentInstance.role()).toBeUndefined();
    });
  });

  describe('tabs()', () => {
    it.each([
      [UserShortDTORolesEnum.Applicant, ['general', 'notifications', 'application-information', 'qualifications']],
      [UserShortDTORolesEnum.Professor, ['general', 'notifications']],
      [UserShortDTORolesEnum.Admin, ['general']],
    ])('should expose the correct tabs for role %s', (role, expectedIds) => {
      accountServiceMock.user.set({ id: 'u1', name: 'User', email: 'u@x.com', authorities: [role] });

      const tabs = TestBed.createComponent(SettingsComponent).componentInstance.tabs();

      expect(tabs.map(t => t.id)).toEqual(expectedIds);
    });
  });

  describe('theme', () => {
    it('should set sync-with-system or specific theme based on selection', () => {
      const component = TestBed.createComponent(SettingsComponent).componentInstance;

      component.onThemeChange({ name: 'System', value: 'system' });
      expect(themeServiceMock.setSyncWithSystem).toHaveBeenCalledWith(true);

      component.onThemeChange({ name: 'Dark', value: 'dark' });
      expect(themeServiceMock.setSyncWithSystem).toHaveBeenCalledWith(false);
      expect(themeServiceMock.setTheme).toHaveBeenCalledWith('dark');
    });

    it('should compute selectedTheme correctly based on theme service state', () => {
      const component = TestBed.createComponent(SettingsComponent).componentInstance;

      themeServiceMock.syncWithSystem.set(true);
      expect(component.selectedTheme().value).toBe('system');

      themeServiceMock.syncWithSystem.set(false);
      themeServiceMock.theme.set('dark');
      expect(component.selectedTheme().value).toBe('dark');

      component.themeOptions = [{ name: 'settings.appearance.options.light', value: 'light' }];
      themeServiceMock.theme.set('light');
      themeServiceMock.theme.set('dark');
      expect(component.selectedTheme().value).toBe('light');
    });
  });

  describe('exportButtonDisabled()', () => {
    it('should disable the export button during cooldown or while an export is in progress', () => {
      const component = TestBed.createComponent(SettingsComponent).componentInstance;

      expect(component.exportButtonDisabled()).toBe(false);

      component.exportCooldownRemaining.set(10);
      expect(component.exportButtonDisabled()).toBe(true);

      component.exportCooldownRemaining.set(0);
      component.exportInProgress.set(true);
      expect(component.exportButtonDisabled()).toBe(true);
    });
  });

  describe('onTabChange()', () => {
    it('should change to known tabs and keep the current tab for unknown ones', () => {
      accountServiceMock.user.set({
        id: 'u1',
        name: 'Test Applicant',
        email: 'applicant@test.com',
        authorities: [UserShortDTORolesEnum.Applicant],
      });
      const component = TestBed.createComponent(SettingsComponent).componentInstance;

      expect(component.activeTab()).toBe('general');

      component.onTabChange('notifications');
      expect(component.activeTab()).toBe('notifications');

      component.onTabChange('qualifications');
      expect(component.activeTab()).toBe('qualifications');

      component.onTabChange('invalid-tab');
      expect(component.activeTab()).toBe('qualifications');
    });
  });
});
