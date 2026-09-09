import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initializeApp } from 'app/app.config';
import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { PublicConfigResourceApi } from 'app/generated/api/public-config-resource-api';
import { SiteConfigService } from 'app/core/config/site-config.service';
import { AuthFacadeService } from 'app/core/auth/auth-facade.service';

describe('initializeApp', () => {
  let configApi: { config: ReturnType<typeof vi.fn> };
  let appConfigService: { setAppConfig: ReturnType<typeof vi.fn> };
  let authFacade: { initAuth: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    configApi = { config: vi.fn(() => of({ siteName: 'DocApply' })) };
    appConfigService = { setAppConfig: vi.fn() };
    authFacade = { initAuth: vi.fn(() => Promise.resolve(true)) };

    TestBed.configureTestingModule({
      providers: [
        { provide: PublicConfigResourceApi, useValue: configApi },
        { provide: ApplicationConfigService, useValue: appConfigService },
        { provide: SiteConfigService, useValue: { siteName: { set: vi.fn() } } },
        { provide: AuthFacadeService, useValue: authFacade },
      ],
    });
  });

  it('should apply the loaded config and initialise auth', async () => {
    await TestBed.runInInjectionContext(() => initializeApp());

    expect(appConfigService.setAppConfig).toHaveBeenCalledOnce();
    expect(authFacade.initAuth).toHaveBeenCalledOnce();
  });

  it('should still start the app when the config call fails', async () => {
    configApi.config.mockReturnValue(throwError(() => new Error('config unavailable')));

    await expect(TestBed.runInInjectionContext(() => initializeApp())).resolves.toBeUndefined();

    expect(authFacade.initAuth).toHaveBeenCalledOnce();
  });
});
