import { TestBed } from '@angular/core/testing';

import { AccountServiceMock, createAccountServiceMock, provideAccountServiceMock } from 'util/account.service.mock';
import { AuthFacadeService } from 'app/core/auth/auth-facade.service';
import { ServerAuthenticationService } from 'app/core/auth/server-authentication.service';
import { IdpProvider, KeycloakAuthenticationService } from 'app/core/auth/keycloak-authentication.service';
import { DocumentCacheService } from 'app/service/document-cache.service';
import { createKeycloakMock, provideKeycloakMock } from 'util/keycloak.mock';
import { vi } from 'vitest';
import { provideMessageServiceMock } from 'util/message-service.mock';
import { createToastServiceMock, provideToastServiceMock } from 'util/toast-service.mock';
import { provideTranslateMock } from 'util/translate.mock';
import {
  AuthOrchestratorServiceMock,
  createAuthOrchestratorServiceMock,
  provideAuthOrchestratorServiceMock,
} from '../../../util/auth-orchestrator.service.mock';
import { createRouterMock, provideRouterMock, RouterMock } from '../../../util/router.mock';

type AuthFacadeInternals = { authMethod: 'none' | 'server' | 'keycloak' };

function setup() {
  const server = {
    refreshTokens: vi.fn(),
    login: vi.fn(),
    sendOtp: vi.fn(),
    verifyOtp: vi.fn(),
    logout: vi.fn(),
    sendRegistrationEmail: vi.fn(),
  };
  const keycloak = Object.assign(createKeycloakMock(), {
    init: vi.fn(),
    isLoggedIn: vi.fn(function (this: { authenticated: boolean }) {
      return this.authenticated;
    }),
    ensureFreshToken: vi.fn(),
    loginWithProvider: vi.fn(),
    loginWithPasskey: vi.fn(),
    registerPasskey: vi.fn(),
    logout: vi.fn(),
  });
  const account: AccountServiceMock = createAccountServiceMock();
  vi.spyOn(account.user, 'set');
  const orchestrator: AuthOrchestratorServiceMock = createAuthOrchestratorServiceMock();
  const docCache = { clear: vi.fn() };
  const router: RouterMock = createRouterMock();
  const toast = createToastServiceMock();

  TestBed.configureTestingModule({
    providers: [
      AuthFacadeService,
      { provide: ServerAuthenticationService, useValue: server },
      { provide: DocumentCacheService, useValue: docCache },
      provideKeycloakMock(keycloak, KeycloakAuthenticationService),
      provideAccountServiceMock(account),
      provideAuthOrchestratorServiceMock(orchestrator),
      provideRouterMock(router),
      provideMessageServiceMock(),
      provideToastServiceMock(toast),
      provideTranslateMock(),
    ],
  });
  const facade = TestBed.inject(AuthFacadeService);
  return { facade, server, keycloak, account, orchestrator, docCache, router, toast };
}

describe('AuthFacadeService', () => {
  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('initAuth', () => {
    it('should succeed via server auth', async () => {
      const { facade, server, account } = setup();
      server.refreshTokens.mockResolvedValue(true);
      account.loadUser.mockResolvedValue(undefined);
      const result = await facade.initAuth();
      expect(result).toBe(true);
      expect(server.refreshTokens).toHaveBeenCalledOnce();
      expect(account.loadUser).toHaveBeenCalledOnce();
    });

    it('should succeed via keycloak fallback', async () => {
      const { facade, server, keycloak, account } = setup();
      server.refreshTokens.mockResolvedValue(false);
      keycloak.init.mockResolvedValue(true);
      account.loadUser.mockResolvedValue(undefined);
      const result = await facade.initAuth();
      expect(result).toBe(true);
      expect(keycloak.init).toHaveBeenCalledOnce();
    });

    it('should retry loading the user once after keycloak bootstrap when the first load is empty', async () => {
      const { facade, server, keycloak, account } = setup();
      server.refreshTokens.mockResolvedValue(false);
      keycloak.init.mockResolvedValue(true);
      keycloak.authenticated = true;
      account.user.set(undefined);
      account.loadUser.mockImplementation(async () => {
        if (account.loadUser.mock.calls.length === 1) {
          account.user.set(undefined);
          return;
        }
        account.user.set({
          id: 'u1',
          name: 'First Login User',
          email: 'first@login.test',
          authorities: ['ROLE_USER'],
        });
      });

      const result = await facade.initAuth();

      expect(result).toBe(true);
      expect(account.loadUser).toHaveBeenCalledTimes(2);
      expect(account.user()?.email).toBe('first@login.test');
    });

    it('should return false when neither auth method succeeds', async () => {
      const { facade, server, keycloak } = setup();
      server.refreshTokens.mockResolvedValue(false);
      keycloak.init.mockResolvedValue(false);
      const result = await facade.initAuth();
      expect(result).toBe(false);
    });

    it('should not block user-initiated login when initAuth is still in flight', async () => {
      const { facade, server, keycloak, account } = setup();

      let resolveKeycloakInit: (v: boolean) => void = () => {};
      const keycloakInitPromise = new Promise<boolean>(resolve => {
        resolveKeycloakInit = resolve;
      });
      server.refreshTokens.mockResolvedValue(false);
      keycloak.init.mockReturnValue(keycloakInitPromise);
      account.loadUser.mockResolvedValue(undefined);

      // Kick off init but don't await — simulates a slow Keycloak silent SSO check.
      const initPromise = facade.initAuth();

      // While init is still in flight, the user clicks Login. It must succeed.
      server.login.mockResolvedValue(undefined);
      await expect(facade.loginWithEmail('a@b.com', 'pw')).resolves.toBe(true);
      expect(server.login).toHaveBeenCalledOnce();

      // Finish the slow init; it must not overwrite the server-established session.
      resolveKeycloakInit(true);
      await initPromise;
      expect((facade as unknown as AuthFacadeInternals).authMethod).toBe('server');
    });
  });

  describe('refreshSession', () => {
    it('should refresh via the server refresh endpoint for a server session', async () => {
      const { facade, server, keycloak } = setup();
      (facade as unknown as AuthFacadeInternals).authMethod = 'server';
      server.refreshTokens.mockResolvedValue(true);

      const result = await facade.refreshSession();

      expect(result).toBe(true);
      expect(server.refreshTokens).toHaveBeenCalledWith(true);
      expect(keycloak.ensureFreshToken).not.toHaveBeenCalled();
    });

    it('should refresh the Keycloak token and report the session validity for a keycloak session', async () => {
      const { facade, server, keycloak } = setup();
      (facade as unknown as AuthFacadeInternals).authMethod = 'keycloak';
      keycloak.authenticated = true;
      keycloak.ensureFreshToken.mockResolvedValue(undefined);

      const result = await facade.refreshSession();

      expect(result).toBe(true);
      expect(keycloak.ensureFreshToken).toHaveBeenCalledOnce();
      expect(server.refreshTokens).not.toHaveBeenCalled();
    });

    it('should return false when the Keycloak refresh throws', async () => {
      const { facade, keycloak } = setup();
      (facade as unknown as AuthFacadeInternals).authMethod = 'keycloak';
      keycloak.ensureFreshToken.mockRejectedValue(new Error('expired'));

      const result = await facade.refreshSession();

      expect(result).toBe(false);
    });

    it('should return false without refreshing when no session is active', async () => {
      const { facade, server, keycloak } = setup();
      (facade as unknown as AuthFacadeInternals).authMethod = 'none';

      const result = await facade.refreshSession();

      expect(result).toBe(false);
      expect(server.refreshTokens).not.toHaveBeenCalled();
      expect(keycloak.ensureFreshToken).not.toHaveBeenCalled();
    });
  });

  describe('loginWithEmail', () => {
    it('should trigger nextStep and authSuccess on success', async () => {
      const { facade, server, account, orchestrator } = setup();
      server.login.mockResolvedValue(undefined);
      account.loadUser.mockResolvedValue(undefined);
      await facade.loginWithEmail('a@b.com', 'pw');
      expect(server.login).toHaveBeenCalledWith('a@b.com', 'pw');
      expect(account.loadUser).toHaveBeenCalledOnce();
      expect(orchestrator.nextStep).toHaveBeenCalledOnce();
    });

    it('should surface orchestrator error when login fails', async () => {
      const { facade, server, orchestrator } = setup();
      const setErrorSpy = vi.spyOn(orchestrator, 'setError');
      server.login.mockRejectedValue(new Error('bad'));
      await expect(facade.loginWithEmail('x@y', 'pw')).rejects.toThrow();
      expect(setErrorSpy).toHaveBeenCalledOnce();
    });
  });

  describe('requestOtp', () => {
    it('should advance step on success', async () => {
      const { facade, server, orchestrator } = setup();
      server.sendOtp.mockResolvedValue(undefined);
      orchestrator.email.set('user@example.com');
      await facade.requestOtp(false);
      expect(server.sendOtp).toHaveBeenCalledWith('user@example.com', false);
      expect(orchestrator.nextStep).toHaveBeenCalledWith('otp');
      expect(server.sendOtp).toHaveBeenCalledOnce();
      expect(orchestrator.nextStep).toHaveBeenCalledOnce();
    });
  });

  describe('sendRegistrationEmail', () => {
    it('should send the registration confirmation email to the orchestrator email', async () => {
      const { facade, server, orchestrator } = setup();
      server.sendRegistrationEmail.mockResolvedValue(undefined);
      orchestrator.email.set('new@user.com');

      await facade.sendRegistrationEmail();

      expect(server.sendRegistrationEmail).toHaveBeenCalledExactlyOnceWith('new@user.com');
    });

    it('should surface an orchestrator error when sending the confirmation email fails', async () => {
      const { facade, server, orchestrator } = setup();
      const setErrorSpy = vi.spyOn(orchestrator, 'setError');
      server.sendRegistrationEmail.mockRejectedValue(new Error('smtp down'));
      orchestrator.email.set('new@user.com');

      await expect(facade.sendRegistrationEmail()).rejects.toThrow();
      expect(setErrorSpy).toHaveBeenCalledOnce();
    });
  });

  describe('pending IdP registration', () => {
    const withEmail = { id: 'u1', name: 'New User', email: 'idp@user.com', authorities: ['ROLE_USER'] };

    it('should send the confirmation email and clear the pending flag when a server session completes a registration', async () => {
      const { facade, server, account } = setup();
      localStorage.setItem('pendingIdpRegistration', 'true');
      server.refreshTokens.mockResolvedValue(true);
      server.sendRegistrationEmail.mockResolvedValue(undefined);
      account.loadUser.mockImplementation(async () => {
        account.user.set(withEmail);
      });

      await facade.initAuth();

      expect(server.sendRegistrationEmail).toHaveBeenCalledExactlyOnceWith('idp@user.com');
      expect(localStorage.getItem('pendingIdpRegistration')).toBeNull();
    });

    it.each([
      { scenario: 'no pending flag is set', flag: undefined, user: withEmail },
      { scenario: 'the resolved user is missing', flag: 'true', user: undefined },
      { scenario: 'the resolved user has no email', flag: 'true', user: { id: 'u1', name: 'No Email', email: '', authorities: [] } },
    ])('should not send the confirmation email when $scenario', async ({ flag, user }) => {
      const { facade, server, account } = setup();
      if (flag !== undefined) {
        localStorage.setItem('pendingIdpRegistration', flag);
      }
      server.refreshTokens.mockResolvedValue(true);
      account.loadUser.mockImplementation(async () => {
        account.user.set(user);
      });

      await facade.initAuth();

      expect(server.sendRegistrationEmail).not.toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    it('should complete login path successfully', async () => {
      const { facade, server, account, orchestrator } = setup();
      server.verifyOtp.mockResolvedValue({ profileRequired: false });
      account.loadUser.mockResolvedValue(undefined);
      await facade.verifyOtp('123456', false);
      expect(server.verifyOtp).toHaveBeenCalledOnce();
      expect(account.loadUser).toHaveBeenCalledOnce();
      expect(orchestrator.authSuccess).toHaveBeenCalledTimes(2);
    });

    it('should advance step for registration path when profile is required', async () => {
      const { facade, server, orchestrator, account } = setup();
      server.verifyOtp.mockResolvedValue({ profileRequired: true });
      account.loadUser.mockResolvedValue(undefined);
      orchestrator.firstName.set('Jane');
      orchestrator.lastName.set('Doe');
      await facade.verifyOtp('123456', true);
      expect(server.verifyOtp).toHaveBeenCalledOnce();
      expect(orchestrator.nextStep).toHaveBeenCalledOnce();
    });
  });

  describe('loginWithProvider', () => {
    it('should delegate provider login to keycloak', async () => {
      const { facade, keycloak } = setup();
      keycloak.loginWithProvider.mockResolvedValue(undefined);
      await facade.loginWithProvider('google' as IdpProvider, '/home');
      expect(keycloak.loginWithProvider).toHaveBeenCalledWith('google', '/home');
      expect(keycloak.loginWithProvider).toHaveBeenCalledOnce();
    });

    it('should mark a pending registration so the confirmation email is sent after the return trip', async () => {
      const { facade, keycloak } = setup();
      keycloak.loginWithProvider.mockResolvedValue(undefined);

      await facade.loginWithProvider('google' as IdpProvider, '/home', true);

      expect(localStorage.getItem('pendingIdpRegistration')).toBe('true');
    });
  });

  describe('loginWithPasskey', () => {
    it('should store an explicit redirect URI and delegate to keycloak', async () => {
      const { facade, keycloak, orchestrator, account } = setup();
      keycloak.loginWithPasskey.mockResolvedValue(undefined);
      account.loadUser.mockResolvedValue(undefined);
      const authSuccessSpy = vi.spyOn(orchestrator, 'authSuccess');

      await facade.loginWithPasskey('/jobs/123');

      expect(orchestrator.redirectUri()).toBe('/jobs/123');
      expect(keycloak.loginWithPasskey).toHaveBeenCalledWith('/jobs/123');
      expect(keycloak.loginWithPasskey).toHaveBeenCalledOnce();
      expect(account.loadUser).toHaveBeenCalledOnce();
      expect(authSuccessSpy).toHaveBeenCalledOnce();
    });

    it('should reuse the existing redirect URI when none is provided', async () => {
      const { facade, keycloak, orchestrator, account } = setup();
      keycloak.loginWithPasskey.mockResolvedValue(undefined);
      account.loadUser.mockResolvedValue(undefined);
      const authSuccessSpy = vi.spyOn(orchestrator, 'authSuccess');
      orchestrator.redirectUri.set('/dashboard');

      await facade.loginWithPasskey();

      expect(keycloak.loginWithPasskey).toHaveBeenCalledWith('/dashboard');
      expect(account.loadUser).toHaveBeenCalledOnce();
      expect(authSuccessSpy).toHaveBeenCalledOnce();
    });
  });

  describe('registerPasskey', () => {
    it('should delegate passkey registration to keycloak and show a success toast', async () => {
      const { facade, keycloak, toast } = setup();
      keycloak.registerPasskey.mockResolvedValue(undefined);

      await facade.registerPasskey();

      expect(keycloak.registerPasskey).toHaveBeenCalledOnce();
      expect(toast.showSuccessKey).toHaveBeenCalledWith('auth.common.toast.passkeyRegistered');
    });
  });

  describe('logout', () => {
    it('should logout via server path', async () => {
      const { facade, server, account, router, docCache } = setup();
      (facade as unknown as AuthFacadeInternals).authMethod = 'server';
      account.user.set({ id: 'id-2', name: 'User', email: 'user@test.com', authorities: ['PROFESSOR'] });
      account.loaded.set(true);
      account.loaded.set(true);
      await facade.logout();
      expect(docCache.clear).toHaveBeenCalledOnce();
      expect(server.logout).toHaveBeenCalledOnce();
      expect(router.navigate).toHaveBeenCalledWith(['/professor']);
      expect(account.user.set).toHaveBeenCalledWith(undefined);
      expect(router.navigate).toHaveBeenCalledOnce();
      expect(account.user.set).toHaveBeenCalledTimes(2);
    });

    it('should logout via keycloak path', async () => {
      const { facade, keycloak, account, docCache } = setup();
      (facade as unknown as AuthFacadeInternals).authMethod = 'keycloak';
      account.user.set({ id: 'id-2', name: 'User', email: 'user@test.com', authorities: ['ROLE_USER'] });
      await facade.logout();
      expect(docCache.clear).toHaveBeenCalledOnce();
      expect(keycloak.logout).toHaveBeenCalledOnce();
      expect(account.user.set).toHaveBeenCalledWith(undefined);
      expect(account.user.set).toHaveBeenCalledTimes(2);
    });

    it.each([
      { role: 'PROFESSOR', expected: '/professor' },
      { role: 'EMPLOYEE', expected: '/professor' },
      { role: 'ADMIN', expected: '/' },
      { role: 'APPLICANT', expected: '/' },
    ])('should redirect $role to $expected on server logout', async ({ role, expected }) => {
      const { facade, account, router } = setup();
      (facade as unknown as AuthFacadeInternals).authMethod = 'server';
      account.user.set({ id: 'id-x', name: 'User', email: 'user@test.com', authorities: [role] });
      account.loaded.set(true);

      await facade.logout();

      expect(router.navigate).toHaveBeenCalledWith([expected]);
    });

    it.each([
      { role: 'PROFESSOR', expectedSuffix: '/professor' },
      { role: 'EMPLOYEE', expectedSuffix: '/professor' },
      { role: 'ADMIN', expectedSuffix: '/' },
      { role: 'APPLICANT', expectedSuffix: '/' },
    ])('should hand $expectedSuffix to keycloak for $role logout', async ({ role, expectedSuffix }) => {
      const { facade, keycloak, account } = setup();
      (facade as unknown as AuthFacadeInternals).authMethod = 'keycloak';
      account.user.set({ id: 'id-x', name: 'User', email: 'user@test.com', authorities: [role] });
      account.loaded.set(true);

      await facade.logout();

      expect(keycloak.logout).toHaveBeenCalledOnce();
      expect(keycloak.logout).toHaveBeenCalledWith(window.location.origin + expectedSuffix);
    });

    it('should do nothing when authMethod is none and sessionExpired is false', async () => {
      const { facade, server, keycloak, docCache, router } = setup();

      await facade.logout(false);

      expect(docCache.clear).not.toHaveBeenCalled();
      expect(server.logout).not.toHaveBeenCalled();
      expect(keycloak.logout).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should handle sessionExpired logout when authMethod is none', async () => {
      const { facade, account, router, docCache } = setup();
      account.user.set({
        id: 'id-3',
        name: 'User',
        email: 'user@test.com',
        authorities: ['ROLE_USER'],
      });
      await facade.logout(true);

      expect(docCache.clear).toHaveBeenCalledOnce();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });
  });

  describe('runAuthAction', () => {
    it('should throw when busy', async () => {
      const { facade, orchestrator } = setup();
      orchestrator.isBusy.set(true);
      await expect(facade.loginWithEmail('a', 'b')).rejects.toThrow('AuthOrchestrator is busy');
    });
  });
});
