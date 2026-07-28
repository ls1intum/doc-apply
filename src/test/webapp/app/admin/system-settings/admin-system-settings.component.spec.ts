import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { AdminSystemSettingsComponent } from 'app/admin/system-settings/admin-system-settings.component';
import { AiFeatureToggleResourceApi } from 'app/generated/api/ai-feature-toggle-resource-api';
import { SiteSettingResourceApi } from 'app/generated/api/site-setting-resource-api';
import { AiFeatureStatusDTO } from 'app/generated/model/ai-feature-status-dto';
import { SiteConfigService } from 'app/core/config/site-config.service';
import { provideTranslateMock, createTranslateServiceMock } from 'util/translate.mock';
import { provideToastServiceMock, createToastServiceMock, ToastServiceMock } from 'util/toast-service.mock';

describe('AdminSystemSettingsComponent', () => {
  let component: AdminSystemSettingsComponent;
  let fixture: ComponentFixture<AdminSystemSettingsComponent>;
  let mockApi: {
    getAiStatus: ReturnType<typeof vi.fn>;
    toggleAi: ReturnType<typeof vi.fn>;
    resetCircuitBreaker: ReturnType<typeof vi.fn>;
  };
  let mockSiteSettingApi: {
    updateSiteName: ReturnType<typeof vi.fn>;
  };
  let siteConfigService: SiteConfigService;
  let mockToastService: ToastServiceMock;

  const enabledStatus: AiFeatureStatusDTO = {
    aiEnabled: true,
    manuallyDisabled: false,
    circuitBreakerOpen: false,
  };

  const disabledStatus: AiFeatureStatusDTO = {
    aiEnabled: false,
    manuallyDisabled: true,
    circuitBreakerOpen: false,
  };

  const circuitBreakerOpenStatus: AiFeatureStatusDTO = {
    aiEnabled: false,
    manuallyDisabled: false,
    circuitBreakerOpen: true,
  };

  beforeEach(async () => {
    mockApi = {
      getAiStatus: vi.fn(),
      toggleAi: vi.fn(),
      resetCircuitBreaker: vi.fn(),
    };

    mockSiteSettingApi = {
      updateSiteName: vi.fn(),
    };

    mockToastService = createToastServiceMock();

    mockApi.getAiStatus.mockReturnValue(of(enabledStatus));

    await TestBed.configureTestingModule({
      imports: [AdminSystemSettingsComponent],
      providers: [
        { provide: AiFeatureToggleResourceApi, useValue: mockApi },
        { provide: SiteSettingResourceApi, useValue: mockSiteSettingApi },
        provideTranslateMock(createTranslateServiceMock()),
        provideToastServiceMock(mockToastService),
      ],
    }).compileComponents();

    siteConfigService = TestBed.inject(SiteConfigService);
    fixture = TestBed.createComponent(AdminSystemSettingsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading Status', () => {
    it('should fetch AI status on construction', async () => {
      await Promise.resolve();

      expect(mockApi.getAiStatus).toHaveBeenCalledOnce();
      expect(component.aiStatus()).toEqual(enabledStatus);
    });

    it('should show error toast when loading fails', async () => {
      mockApi.getAiStatus.mockReturnValue(throwError(() => new Error('Network error')));

      await component.loadStatus();

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('systemSettings.ai.toast.loadError');
      expect(component.isLoading()).toBe(false);
    });
  });

  it('should derive computed signals from status and default safely when undefined', async () => {
    await Promise.resolve();
    expect(component.aiEnabled()).toBe(true);

    mockApi.getAiStatus.mockReturnValue(of(disabledStatus));
    await component.loadStatus();
    expect(component.manuallyDisabled()).toBe(true);

    mockApi.getAiStatus.mockReturnValue(of(circuitBreakerOpenStatus));
    await component.loadStatus();
    expect(component.circuitBreakerOpen()).toBe(true);

    component.aiStatus.set(undefined);
    expect(component.aiEnabled()).toBe(true);
    expect(component.manuallyDisabled()).toBe(false);
    expect(component.circuitBreakerOpen()).toBe(false);
  });

  describe('Toggle AI', () => {
    it('should disable AI and show success toast', async () => {
      mockApi.toggleAi.mockReturnValue(of(disabledStatus));

      await component.onAiToggleChanged(false);

      expect(mockApi.toggleAi).toHaveBeenCalledWith(false);
      expect(component.aiStatus()).toEqual(disabledStatus);
      expect(mockToastService.showSuccessKey).toHaveBeenCalledWith('systemSettings.ai.toast.disabled');
    });

    it('should enable AI and show success toast', async () => {
      mockApi.toggleAi.mockReturnValue(of(enabledStatus));

      await component.onAiToggleChanged(true);

      expect(mockApi.toggleAi).toHaveBeenCalledWith(true);
      expect(component.aiStatus()).toEqual(enabledStatus);
      expect(mockToastService.showSuccessKey).toHaveBeenCalledWith('systemSettings.ai.toast.enabled');
    });

    it('should show error toast when toggle fails', async () => {
      mockApi.toggleAi.mockReturnValue(throwError(() => new Error('API error')));

      await component.onAiToggleChanged(false);

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('systemSettings.ai.toast.toggleError');
    });
  });

  describe('Site Name', () => {
    it('should only allow saving a non-blank site name that differs from the active one', () => {
      expect(component.canSaveSiteName()).toBe(false);

      component.siteNameInput.set('   ');
      expect(component.canSaveSiteName()).toBe(false);

      component.siteNameInput.set('New Portal');
      expect(component.canSaveSiteName()).toBe(true);
    });

    it('should save the trimmed site name, update the site config live, and show a success toast', async () => {
      mockSiteSettingApi.updateSiteName.mockReturnValue(of({ siteName: 'New Portal' }));
      component.siteNameInput.set('  New Portal  ');

      await component.onSiteNameConfirmed();

      expect(mockSiteSettingApi.updateSiteName).toHaveBeenCalledWith({ siteName: 'New Portal' });
      expect(siteConfigService.siteName()).toBe('New Portal');
      expect(mockToastService.showSuccessKey).toHaveBeenCalledWith('systemSettings.general.siteName.toast.success', {
        newName: 'New Portal',
      });
      expect(component.isSavingSiteName()).toBe(false);
    });

    it('should show an error toast and keep the current site name when saving fails', async () => {
      mockSiteSettingApi.updateSiteName.mockReturnValue(throwError(() => new Error('API error')));
      component.siteNameInput.set('New Portal');

      await component.onSiteNameConfirmed();

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('systemSettings.general.siteName.toast.error');
      expect(component.isSavingSiteName()).toBe(false);
    });
  });

  describe('Reset Circuit Breaker', () => {
    it('should reset circuit breaker and show success toast', async () => {
      mockApi.resetCircuitBreaker.mockReturnValue(of(enabledStatus));

      await component.resetCircuitBreaker();

      expect(mockApi.resetCircuitBreaker).toHaveBeenCalledOnce();
      expect(component.aiStatus()).toEqual(enabledStatus);
      expect(mockToastService.showSuccessKey).toHaveBeenCalledWith('systemSettings.ai.toast.circuitBreakerReset');
    });

    it('should show error toast when reset fails', async () => {
      mockApi.resetCircuitBreaker.mockReturnValue(throwError(() => new Error('API error')));

      await component.resetCircuitBreaker();

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('systemSettings.ai.toast.resetError');
    });
  });
});
