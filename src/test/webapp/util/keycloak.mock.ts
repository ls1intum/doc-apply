import { vi } from 'vitest';
import { Provider } from '@angular/core';
import { KeycloakAuthenticationService } from 'app/core/auth/keycloak-authentication.service';

export type KeycloakMock = {
  authenticated: boolean;
  token: string;
  tokenParsed: Record<string, unknown>;
  init: ReturnType<typeof vi.fn>;
  login: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  updateToken: ReturnType<typeof vi.fn>;
};

export function createKeycloakMock(): KeycloakMock {
  return {
    authenticated: false,
    token: 'mock-token',
    tokenParsed: {
      sub: 'mock-subject',
      preferred_username: 'mock-user',
      name: 'Mock User',
    },
    init: vi.fn().mockResolvedValue(true),
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    updateToken: vi.fn().mockResolvedValue(true),
  };
}

export function provideKeycloakMock(mock: KeycloakMock = createKeycloakMock(), provideToken: any = 'Keycloak'): Provider {
  return { provide: provideToken, useValue: mock };
}

export type KeycloakAuthenticationServiceMock = {
  isLoggedIn: ReturnType<typeof vi.fn>;
  canManagePasskeys: ReturnType<typeof vi.fn>;
  isTumRealmSession: ReturnType<typeof vi.fn>;
  listPasskeys: ReturnType<typeof vi.fn>;
  loginWithPasskey: ReturnType<typeof vi.fn>;
  registerPasskey: ReturnType<typeof vi.fn>;
  removePasskey: ReturnType<typeof vi.fn>;
  getToken: ReturnType<typeof vi.fn>;
};

export function createKeycloakAuthenticationServiceMock(): KeycloakAuthenticationServiceMock {
  return {
    isLoggedIn: vi.fn().mockReturnValue(true),
    canManagePasskeys: vi.fn().mockReturnValue(true),
    isTumRealmSession: vi.fn().mockReturnValue(false),
    listPasskeys: vi.fn().mockResolvedValue([]),
    loginWithPasskey: vi.fn().mockResolvedValue(undefined),
    registerPasskey: vi.fn().mockResolvedValue(undefined),
    removePasskey: vi.fn().mockResolvedValue(undefined),
    getToken: vi.fn().mockReturnValue(undefined),
  };
}

export function provideKeycloakAuthenticationServiceMock(
  mock: KeycloakAuthenticationServiceMock = createKeycloakAuthenticationServiceMock(),
): Provider {
  return { provide: KeycloakAuthenticationService, useValue: mock };
}
