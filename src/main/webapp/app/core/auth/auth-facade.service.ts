import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DocumentCacheService } from 'app/service/document-cache.service';
import { AuthSessionInfoDTO } from 'app/generated/model/auth-session-info-dto';
import { OtpCompleteDTOPurposeEnum } from 'app/generated/model/otp-complete-dto';
import { UserProfileDTO } from 'app/generated/model/user-profile-dto';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';
import { ToastMessageInput, ToastService } from 'app/service/toast-service';
import { TranslateService } from '@ngx-translate/core';

import { ServerAuthenticationService } from './server-authentication.service';
import { IdpProvider, KeycloakAuthenticationService } from './keycloak-authentication.service';
import { AccountService } from './account.service';
import { AuthOrchestratorService } from './auth-orchestrator.service';
import { WebAuthnService } from './webauthn.service';

type AuthMethod = 'none' | 'server' | 'keycloak';

@Injectable({ providedIn: 'root' })
/**
 * Purpose
 * -------
 * Single entry point that orchestrates *both* authentication domains:
 *  - Server-issued session (email/password/OTP, cookie-based)
 *  - Keycloak SSO (IdP providers, header-based)
 *
 * Responsibilities
 * ----------------
 *  - Tries to establish/refresh an authenticated session on app start (`initAuth`).
 *  - Delegates login flows to the respective domain services (server or Keycloak).
 *  - Performs coordinated logout that clears server session and/or Keycloak SSO.
 *  - Loads the current user profile after successful authentication.
 *  - Centralises redirect handling after auth actions.
 *
 * Notes
 * -----
 *  - This facade does not attach Authorization headers and performs no low-level HTTP; it delegates to
 *    `ServerAuthenticationService` and `KeycloakAuthenticationService`.
 *  - It tracks which auth method is active (`authMethod`) to execute the correct logout path and avoid mixing flows.
 *  - UI routing beyond post-auth redirects is not handled here; components/pages remain responsible for navigation.
 */
export class AuthFacadeService {
  private static readonly PROFESSOR_PORTAL_AUTHORITIES: UserShortDTORolesEnum[] = [
    UserShortDTORolesEnum.Professor,
    UserShortDTORolesEnum.Employee,
  ];

  private readonly serverAuthenticationService = inject(ServerAuthenticationService);
  private readonly keycloakAuthenticationService = inject(KeycloakAuthenticationService);
  private readonly accountService = inject(AccountService);
  private readonly router = inject(Router);
  private readonly authOrchestrator = inject(AuthOrchestratorService);
  private readonly webAuthnService = inject(WebAuthnService);
  private readonly documentCache = inject(DocumentCacheService);
  private readonly toastService = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly translationKey = 'auth.common.toast';
  private readonly REGISTRATION_KEY = 'pendingIdpRegistration';

  private authMethod: AuthMethod = 'none';

  /**
   * Try to refresh the authentication session.
   * First attempts the email session refresh,
   * otherwise falls back to Keycloak SSO initialization.
   *
   * Runs as a background bootstrap and intentionally does NOT go through
   * `runAuthAction`: this is silent SSO/refresh, not a user-initiated action,
   * so it must not toggle `authOrchestrator.isBusy`. Otherwise a slow Keycloak
   * iframe or refresh call would leave the orchestrator busy and silently reject
   * subsequent user clicks on Login.
   *
   * If a user-driven login establishes a session while this is still in flight,
   * the `authMethod !== 'none'` guards prevent init from overriding it.
   *
   * @return true if the user is authenticated, false otherwise.
   */
  async initAuth(): Promise<boolean> {
    try {
      // 1) Email-Authentication-Flow (server session)
      const refreshed = await this.serverAuthenticationService.refreshTokens(true);
      if (this.hasActiveAuthMethod()) {
        return true;
      }
      if (refreshed) {
        await this.accountService.loadUser();
        if (this.hasActiveAuthMethod()) {
          return true;
        }
        this.authMethod = 'server';
        // A direct Google/Apple sign-in returns as a server (cookie) session; send the
        // registration confirmation email here if this round-trip completed a registration.
        await this.handlePendingIdpRegistration();
        return true;
      }

      // 2) Keycloak-Flow
      const keycloakInitialized = await this.keycloakAuthenticationService.init();
      if (this.hasActiveAuthMethod()) {
        return true;
      }
      if (keycloakInitialized) {
        await this.accountService.loadUser();
        if (this.accountService.user() === undefined && this.keycloakAuthenticationService.isLoggedIn()) {
          await this.accountService.loadUser();
        }
        if (this.hasActiveAuthMethod()) {
          return true;
        }
        this.authMethod = 'keycloak';

        // Check if IdP registration to be done
        await this.handlePendingIdpRegistration();
        return true;
      }

      // 3) not authenticated
      return false;
    } catch {
      // Don't rethrow: initAuth is awaited by Angular's appInitializer at startup,
      // and a rejected promise there would block app bootstrap.
      this.toastService.showError({
        summary: this.translate.instant(`${this.translationKey}.autoSignInFailed.summary`),
        detail: this.translate.instant(`${this.translationKey}.autoSignInFailed.detail`),
      });
      return false;
    }
  }

  /**
   * Silently refreshes the currently active session so an expired access token can be recovered without
   * logging the user out. Delegates to the mechanism matching the active method: the server refresh endpoint
   * for cookie sessions, or a Keycloak token update for SSO sessions.
   *
   * @return true if a valid session remains after the refresh, false otherwise
   */
  async refreshSession(): Promise<boolean> {
    if (this.authMethod === 'server') {
      // Suppress the refresh-failure toast; on failure the caller logs out, which surfaces a single message.
      return this.serverAuthenticationService.refreshTokens(true);
    }
    if (this.authMethod === 'keycloak') {
      try {
        await this.keycloakAuthenticationService.ensureFreshToken();
        return this.keycloakAuthenticationService.isLoggedIn();
      } catch {
        return false;
      }
    }
    return false;
  }

  // --------------- Email/Password ---------------
  /**
   * Logs in via email/password on the server.
   * @returns true on success, throws on failure
   */
  async loginWithEmail(email: string, password: string): Promise<boolean> {
    return this.runAuthAction(
      async () => {
        await this.serverAuthenticationService.login(email, password);
        await this.accountService.loadUser();
        this.authOrchestrator.nextStep();
        this.authMethod = 'server';
        return true;
      },
      {
        summary: this.translate.instant(`${this.translationKey}.emailLoginFailed.summary`),
        detail: this.translate.instant(`${this.translationKey}.emailLoginFailed.detail`),
      },
      true,
    );
  }

  // --------------- Email/OTP ---------------
  /** Sends registration confirmation email after successful registration. */
  async sendRegistrationEmail(): Promise<void> {
    const email = this.authOrchestrator.email();
    return this.runAuthAction(
      async () => {
        await this.serverAuthenticationService.sendRegistrationEmail(email);
      },
      {
        summary: this.translate.instant(`${this.translationKey}.registrationEmailSendFailed.summary`),
        detail: this.translate.instant(`${this.translationKey}.registrationEmailSendFailed.detail`),
      },
    );
  }

  /** Request an OTP to be sent to the user's email. */
  async requestOtp(registration = false, resend = false): Promise<void> {
    this.authOrchestrator.resetOtpAttempts();
    const email = this.authOrchestrator.email();
    return this.runAuthAction(
      async () => {
        await this.serverAuthenticationService.sendOtp(email, registration);
        if (resend) {
          this.authOrchestrator.startOtpRefreshCooldown();
        } else {
          this.authOrchestrator.nextStep(!registration ? 'otp' : undefined);
        }
      },
      {
        summary: this.translate.instant(`${this.translationKey}.otpSendFailed.summary`),
        detail: this.translate.instant(`${this.translationKey}.otpSendFailed.detail`),
      },
    );
  }

  /** Verify an OTP code and start a server session, then redirect. */
  async verifyOtp(code: string, registration = false): Promise<boolean> {
    const email = this.authOrchestrator.email();
    const purpose = registration ? OtpCompleteDTOPurposeEnum.Register : OtpCompleteDTOPurposeEnum.Login;
    const profile: UserProfileDTO | undefined = registration
      ? {
          firstName: this.authOrchestrator.firstName(),
          lastName: this.authOrchestrator.lastName(),
        }
      : undefined;
    try {
      return await this.runAuthAction(
        async () => {
          const response: AuthSessionInfoDTO = await this.serverAuthenticationService.verifyOtp(email, code, purpose, profile);
          await this.accountService.loadUser();
          if (response.profileRequired === false) {
            this.authOrchestrator.authSuccess();
          } else if (registration) {
            this.authOrchestrator.nextStep();
          }
          this.authMethod = 'server';
          return true;
        },
        {
          summary: this.translate.instant(`${this.translationKey}.otpInvalid.summary`),
          detail: this.translate.instant(`${this.translationKey}.otpInvalid.detail`),
        },
        !registration,
      );
    } catch (e) {
      this.authOrchestrator.recordFailedOtpAttempt();
      throw e;
    }
  }

  // --------------- Passkey ---------------
  /**
   * Logs in via WebAuthn passkey on Keycloak.
   * Note: This passkey flow needs a custom Keycloak SPI endpoint and won't work with a standard Keycloak setup out-of-the-box.
   * @param redirectUri optional post-login redirect URI to be set before initiating the flow
   */
  async loginWithPasskey(redirectUri?: string): Promise<void> {
    if (redirectUri !== undefined && redirectUri.trim() !== '') {
      this.authOrchestrator.redirectUri.set(redirectUri);
    }
    return this.runAuthAction(
      async () => {
        await this.keycloakAuthenticationService.loginWithPasskey(this.authOrchestrator.redirectUri() ?? undefined);
        this.authMethod = 'keycloak';
        await this.accountService.loadUser();
        this.authOrchestrator.authSuccess();
      },
      {
        summary: this.translate.instant(`${this.translationKey}.passkeyLoginFailed.summary`),
        detail: this.translate.instant(`${this.translationKey}.passkeyLoginFailed.detail`),
      },
      false,
    );
  }

  /**
   * Logs in an applicant via an in-app WebAuthn passkey (no Keycloak). On success a server (cookie) session
   * is established, the user profile is loaded, and the auth flow is completed.
   *
   * @param redirectUri optional post-login redirect URI
   */
  async loginWithInAppPasskey(redirectUri?: string): Promise<void> {
    if (redirectUri !== undefined && redirectUri.trim() !== '') {
      this.authOrchestrator.redirectUri.set(redirectUri);
    }
    return this.runAuthAction(
      async () => {
        await this.webAuthnService.authenticate();
        this.authMethod = 'server';
        await this.accountService.loadUser();
        this.authOrchestrator.authSuccess();
      },
      {
        summary: this.translate.instant(`${this.translationKey}.passkeyLoginFailed.summary`),
        detail: this.translate.instant(`${this.translationKey}.passkeyLoginFailed.detail`),
      },
      false,
    );
  }

  /**
   * Registers a new passkey for the currently logged-in user.
   * Note: This also requires a custom Keycloak SPI endpoint and won't work with a standard Keycloak setup out-of-the-box.
   * After successful registration, a success toast is shown. Any errors during the process will be captured and rethrown.
   */
  async registerPasskey(): Promise<void> {
    return this.runAuthAction(
      async () => {
        await this.keycloakAuthenticationService.registerPasskey();
        this.toastService.showSuccessKey(`${this.translationKey}.passkeyRegistered`);
      },
      {
        summary: this.translate.instant(`${this.translationKey}.passkeyRegisterFailed.summary`),
        detail: this.translate.instant(`${this.translationKey}.passkeyRegisterFailed.detail`),
      },
    );
  }

  // --------------- IdPs ---------------
  /**
   * Starts a direct backend OIDC login for Google/Apple (no Keycloak brokering). Performs a full-page
   * redirect to the backend authorization endpoint; the backend verifies the identity, provisions the
   * local user, sets the session cookies and redirects back to the SPA, where `initAuth` resumes the session.
   *
   * @param provider the external identity provider (Google or Apple)
   * @param isRegistration if true, marks the flow so a registration confirmation email is sent on return
   */
  loginWithSocialProvider(provider: IdpProvider, isRegistration = false): void {
    if (isRegistration) {
      localStorage.setItem(this.REGISTRATION_KEY, 'true');
    }
    // provider is a fixed IdpProvider enum value; encode it defensively and navigate via assign().
    window.location.assign(`/oauth2/authorization/${encodeURIComponent(provider)}`);
  }

  /**
   * Logs in via a Keycloak identity provider (TUM SSO).
   * @param provider Google, Apple, Microsoft, etc.
   * @param redirectUri optional post-login redirect
   * @param isRegistration if true, sends a registration email after login
   */
  async loginWithProvider(provider: IdpProvider, redirectUri?: string, isRegistration = false): Promise<void> {
    if (isRegistration) {
      localStorage.setItem(this.REGISTRATION_KEY, 'true');
    }
    return this.runAuthAction(
      async () => {
        await this.keycloakAuthenticationService.loginWithProvider(provider, redirectUri);
        this.authMethod = 'keycloak';
      },
      {
        summary: this.translate.instant(`${this.translationKey}.providerLoginFailed.summary`),
        detail: this.translate.instant(`${this.translationKey}.providerLoginFailed.detail`),
      },
    );
  }

  // --------------- Logout ---------------
  /**
   * Logs the user out from the currently active authentication domain.
   *
   * - If the active method is `server`, calls server logout (cookie-based) and then redirects.
   * - If the active method is `keycloak`, triggers RP-initiated logout at Keycloak (front-channel).
   * - In both cases, local user state is cleared and `authMethod` is reset to `none`.
   *
   * The branching prevents mixed flows (e.g., trying Keycloak logout when only a server session exists)
   * and avoids unnecessary calls when no auth method is active.
   */
  async logout(sessionExpired = false): Promise<void> {
    if (this.authMethod === 'none' && !sessionExpired) {
      return;
    }
    this.documentCache.clear();
    return this.runAuthAction(
      async () => {
        const { targetRoute, redirectUrl } = this.getLogoutRedirectRoutes();

        await this.performDomainLogout(targetRoute, redirectUrl);
        this.handlePostLogoutState(sessionExpired);
      },
      {
        summary: this.translate.instant(`${this.translationKey}.logoutFailed.summary`),
        detail: this.translate.instant(`${this.translationKey}.logoutFailed.detail`),
      },
    );
  }

  /**
   * Read the current auth method through a method call so the TypeScript compiler
   * cannot narrow the field to its initializer literal across `await` boundaries.
   * Concurrent user-driven login flows can mutate `authMethod` while `initAuth`
   * is still in flight; the narrowing would otherwise hide that possibility from
   * the guards in `initAuth`.
   */
  private hasActiveAuthMethod(): boolean {
    return this.authMethod !== 'none';
  }

  private async handlePendingIdpRegistration(): Promise<void> {
    const pending = localStorage.getItem(this.REGISTRATION_KEY);
    if (pending === 'true') {
      localStorage.removeItem(this.REGISTRATION_KEY);
      const user = this.accountService.user();
      if (user === undefined) return;

      const email = user.email;
      if (email.trim() === '') return;

      await this.serverAuthenticationService.sendRegistrationEmail(email);
    }
  }

  private getLogoutRedirectRoutes(): { targetRoute: string; redirectUrl: string } {
    const user = this.accountService.user();
    const belongsToProfessorPortal = AuthFacadeService.PROFESSOR_PORTAL_AUTHORITIES.some(
      role => user?.authorities?.includes(role) ?? false,
    );

    const targetRoute = belongsToProfessorPortal ? '/professor' : '/';
    const redirectUrl = window.location.origin + targetRoute;

    return { targetRoute, redirectUrl };
  }

  private async performDomainLogout(targetRoute: string, redirectUrl: string): Promise<void> {
    if (this.authMethod === 'server') {
      this.authMethod = 'none';
      await this.serverAuthenticationService.logout();
      void this.router.navigate([targetRoute]);
    } else if (this.authMethod === 'keycloak') {
      this.authMethod = 'none';
      await this.keycloakAuthenticationService.logout(redirectUrl);
    } else {
      void this.router.navigate([targetRoute]);
    }
  }

  private handlePostLogoutState(sessionExpired: boolean): void {
    this.accountService.user.set(undefined);
    this.accountService.loaded.set(true);
    this.accountService.clearActiveResearchGroup();

    if (sessionExpired) {
      this.toastService.showWarnKey('auth.common.toast.logout.sessionExpired');
    } else {
      this.toastService.showSuccessKey('auth.common.toast.logout.successfullyLoggedOut');
    }
  }

  // --------------- Helpers ---------------

  /**
   * Runs an auth action while toggling the orchestrator's busy flag and capturing errors.
   * Any thrown error will be surfaced via the orchestrator and rethrown for callers that care.
   */
  private async runAuthAction<T>(
    action: () => Promise<T>,
    errorMessage: ToastMessageInput = {
      summary: this.translate.instant(`${this.translationKey}.authenticationFailed.summary`),
      detail: this.translate.instant(`${this.translationKey}.authenticationFailed.detail`),
    },
    lastAction = false,
  ): Promise<T> {
    if (this.authOrchestrator.isBusy()) {
      throw new Error('AuthOrchestrator is busy');
    }
    this.authOrchestrator.clearError();
    this.authOrchestrator.isBusy.set(true);
    try {
      const response = await action();
      if (lastAction) {
        this.authOrchestrator.authSuccess();
      }
      return response;
    } catch (e) {
      // сheck if passkey had an error because user refused to use passkey
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        return undefined as unknown as T;
      }
      this.authOrchestrator.setError(errorMessage);
      throw e;
    } finally {
      this.authOrchestrator.isBusy.set(false);
    }
  }
}
