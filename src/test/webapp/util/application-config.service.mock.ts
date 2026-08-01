import { Provider, Type } from '@angular/core';
import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { ApplicationConfig, KeycloakConfig, OtpConfig } from 'app/core/config/application-config.model';
import { vi } from 'vitest';

/**
 * A full mock reflecting the real ApplicationConfigService API.
 */
export interface ApplicationConfigServiceMock extends Partial<ApplicationConfigService> {
  keycloak?: KeycloakConfig;
  otp: OtpConfig;
  appConfig?: Partial<ApplicationConfig>;
}

/**
 * Factory that creates a realistic mock of the ApplicationConfigService.
 */
export function createApplicationConfigServiceMock(overrides: Partial<ApplicationConfigServiceMock> = {}): ApplicationConfigServiceMock {
  const keycloakDefaults: KeycloakConfig = {
    url: 'http://mock-keycloak',
    tumLoginRealm: 'tumidpldap',
    clientId: 'mock-client',
    relyingPartyId: '',
  };
  const otpDefaults: OtpConfig = {
    length: 4,
    ttlSeconds: 300,
    resendCooldownSeconds: 60,
  };

  const defaultConfig: ApplicationConfigServiceMock = {
    keycloak: Object.assign({}, keycloakDefaults, overrides.keycloak ?? {}),
    otp: Object.assign({}, otpDefaults, overrides.otp ?? {}),
    appConfig: Object.assign({}, overrides.appConfig ?? {}),
    setAppConfig: vi.fn(),
    getAppConfig: vi.fn(),
    getEndpointFor: vi.fn(api => api),
  };

  return Object.assign({}, defaultConfig, overrides);
}

/**
 * Provider wrapper for Angular test modules.
 */
export function provideApplicationConfigServiceMock(
  mock: ApplicationConfigServiceMock = createApplicationConfigServiceMock(),
  provideToken: Type<ApplicationConfigService> = ApplicationConfigService,
): Provider {
  return { provide: provideToken, useValue: mock };
}
