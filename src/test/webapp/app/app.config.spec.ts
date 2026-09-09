import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initializeApp } from 'app/app.config';

import {
  ApplicationConfigServiceMock,
  createApplicationConfigServiceMock,
  provideApplicationConfigServiceMock,
} from 'util/application-config.service.mock';
import { AuthFacadeServiceMock, createAuthFacadeServiceMock, provideAuthFacadeServiceMock } from 'util/auth-facade.service.mock';
import {
  PublicConfigResourceApiMock,
  createPublicConfigResourceApiMock,
  providePublicConfigResourceApiMock,
} from 'util/public-config-resource-api.service.mock';

describe('initializeApp', () => {
  let configApi: PublicConfigResourceApiMock;
  let appConfigService: ApplicationConfigServiceMock;
  let authFacade: AuthFacadeServiceMock;

  beforeEach(() => {
    configApi = createPublicConfigResourceApiMock();
    configApi.config.mockReturnValue(of({ siteName: 'DocApply' }));

    appConfigService = createApplicationConfigServiceMock();
    authFacade = createAuthFacadeServiceMock();
    vi.mocked(authFacade.initAuth).mockResolvedValue(true);

    // SiteConfigService is dependency-free, so the real one is used rather than a mock.
    TestBed.configureTestingModule({
      providers: [
        providePublicConfigResourceApiMock(configApi),
        provideApplicationConfigServiceMock(appConfigService),
        provideAuthFacadeServiceMock(authFacade),
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
