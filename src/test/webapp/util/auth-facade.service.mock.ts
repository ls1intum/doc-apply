import { AuthFacadeService } from 'app/core/auth/auth-facade.service';
import { Provider } from '@angular/core';
import { vi } from 'vitest';

export type AuthFacadeServiceMock = Pick<
  AuthFacadeService,
  | 'requestOtp'
  | 'verifyOtp'
  | 'loginWithEmail'
  | 'loginWithProvider'
  | 'loginWithSocialProvider'
  | 'registerPasskey'
  | 'logout'
  | 'refreshSession'
>;

export function createAuthFacadeServiceMock(): AuthFacadeServiceMock {
  return {
    requestOtp: vi.fn(),
    verifyOtp: vi.fn(),
    loginWithEmail: vi.fn(),
    loginWithProvider: vi.fn(),
    loginWithSocialProvider: vi.fn(),
    registerPasskey: vi.fn(),
    logout: vi.fn(),
    refreshSession: vi.fn(),
  };
}

export function provideAuthFacadeServiceMock(mock: AuthFacadeServiceMock = createAuthFacadeServiceMock()): Provider {
  return { provide: AuthFacadeService, useValue: mock };
}
