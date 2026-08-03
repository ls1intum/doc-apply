import { Injectable, inject } from '@angular/core';
import Keycloak, { KeycloakInitOptions } from 'keycloak-js';
import { firstValueFrom } from 'rxjs';
import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { environment } from 'app/environments/environment';
import { ToastService } from 'app/service/toast-service';
import { TranslateService } from '@ngx-translate/core';
import { AuthenticationResourceApi } from 'app/generated/api/authentication-resource-api';

import { AccountService } from './account.service';
import { PasskeyCredentialSummary } from './models/auth.model';
import { buildRedirectUri } from './keycloak-authentication.utils';
import { KeycloakPasskeyManager } from './keycloak-passkey-manager';

export enum IdpProvider {
  Google = 'google',
  Apple = 'apple',
  TUM = 'tum',
}

/**
 * Purpose
 * -------
 * Handles all communication from the client to Keycloak for Keycloak‑based authentication and access token lifecycle.
 *
 * Responsibilities
 * ----------------
 * - Initialize the Keycloak client and determine authentication state (SSO/redirect).
 * - Perform login and logout flows (including provider‑specific login and email login).
 * - Keep Keycloak access tokens fresh by scheduling automatic refreshes.
 * - Expose helpers to read the current token, basic user profile, and login state.
 * - Provide safe start/stop controls for the refresh timer.
 *
 * Notes
 * -----
 * - This service deals exclusively with Keycloak; it does not handle server‑issued tokens.
 * - No routing or UI logic; navigation and user loading are handled by the AuthFacade.
 */
@Injectable({ providedIn: 'root' })
export class KeycloakAuthenticationService {
  readonly config = inject(ApplicationConfigService);
  private readonly accountService = inject(AccountService);
  private readonly toastService = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly authenticationApi = inject(AuthenticationResourceApi);
  private readonly translationKey = 'auth.common.toast';

  private keycloak: Keycloak | undefined;
  private refreshIntervalId: ReturnType<typeof setInterval> | undefined;
  private refreshInFlight: Promise<void> | undefined;
  private windowListenersActive = false;
  private passkeyManager?: KeycloakPasskeyManager;

  /**
   * Initializes the Keycloak client and determines login status.
   * Loads the user profile and starts the token refresh cycle if authenticated.
   *
   * @returns A promise that resolves to true if the user is authenticated, false otherwise.
   */
  async init(): Promise<boolean> {
    try {
      return await this.initializeSession();
    } catch (err) {
      this.toastService.showError({
        summary: this.translate.instant(`${this.translationKey}.error.summary`),
        detail: this.translate.instant(`${this.translationKey}.error.detail`),
      });
      console.error('🔁 Keycloak init failed:', err);
      return false;
    }
  }

  /**
   * Returns the current authentication token.
   *
   * @returns The current token string if available, otherwise undefined.
   */
  getToken(): string | undefined {
    return this.keycloak?.token;
  }

  /**
   * Checks if the user is currently authenticated.
   *
   * @returns True if the user is authenticated, false otherwise.
   */
  isLoggedIn(): boolean {
    return Boolean(this.keycloak?.authenticated);
  }

  /**
   * Returns whether the current authenticated Keycloak session supports passkey management.
   */
  canManagePasskeys(): boolean {
    return this.accountService.signedIn();
  }

  /** Returns true when current authenticated Keycloak session belongs to the TUM realm. */
  isTumRealmSession(): boolean {
    const realmName = this.getRealmNameFromTokenIssuer();
    if (realmName === undefined) {
      return false;
    }
    return !realmName.toLowerCase().includes('external');
  }

  // --------------------------- Login ----------------------------

  /**
   * Triggers the Keycloak login flow for a specific identity provider.
   * Optionally redirects to the specified URI after login.
   * Note: The `TUM` provider is for development the default keycloak login
   *
   * @param provider The identity provider to use for login.
   * @param redirectUri Optional URI to redirect to after login. Defaults to the app root.
   */
  async loginWithProvider(provider: IdpProvider, redirectUri?: string): Promise<void> {
    const keycloak = this.createKeycloakClient();

    try {
      await this.initializeKeycloakForLogin(keycloak);
      await keycloak.login({
        redirectUri: buildRedirectUri(redirectUri),
      });
    } catch (err) {
      this.toastService.showError({
        summary: this.translate.instant(`${this.translationKey}.providerLoginFailed.summary`),
        detail: this.translate.instant(`${this.translationKey}.providerLoginFailed.detail`),
      });
      console.error(`Login with provider ${provider} failed:`, err);
    }
  }

  // --------------------------- Logout ----------------------------

  /**
   * Triggers the Keycloak logout flow.
   * Optionally redirects to the specified URI after logout.
   *
   * @param redirectUri Optional URI to redirect to after logout. Defaults to the app root.
   */
  async logout(redirectUri?: string): Promise<void> {
    const keycloak = this.keycloak;
    this.stopTokenRefreshScheduler();
    this.clearActiveRealm();
    if (keycloak?.authenticated === true) {
      await keycloak.logout({ redirectUri: buildRedirectUri(redirectUri) });
    }
  }

  // --------------------------- Passkey ----------------------------

  /**
   * Performs a login flow using WebAuthn passkeys.
   * @param redirectUri Optional post-login redirect URI reserved for future use.
   */
  async loginWithPasskey(redirectUri?: string): Promise<void> {
    await this.getPasskeyManager().loginWithPasskey();
    await this.refreshKeycloakSessionFromBrowser();
    this.redirectAfterPasskeyLogin(redirectUri);
  }

  /**
   * Performs a passkey registration flow to add a new passkey credential to the user's account.
   * Requires the user to be authenticated with Keycloak beforehand, as it uses the current session for authorization.
   */
  async registerPasskey(): Promise<void> {
    await this.getPasskeyManager().registerPasskey();
  }

  /**
   * Fetches the list of registered passkey credentials for the authenticated user.
   *
   * @returns An array of passkey credential summaries.
   */
  async listPasskeys(): Promise<PasskeyCredentialSummary[]> {
    return this.getPasskeyManager().listPasskeys();
  }

  /**
   * Removes a registered passkey credential from the user's account.
   * @param id
   */
  async removePasskey(id: string): Promise<void> {
    await this.getPasskeyManager().removePasskey(id);
  }

  // --------------------------- Refresh ----------------------------

  /**
   * Ensures the access token is valid for at least x seconds. Otherwise, it attempts to refresh it.
   * If the refresh fails, the user is logged out.
   *
   * @throws An error if the token refresh fails.
   */
  async ensureFreshToken(): Promise<void> {
    if (this.keycloak?.authenticated !== true) {
      return;
    }
    if (this.refreshInFlight !== undefined) {
      return this.refreshInFlight;
    }

    const refreshPromise = Promise.resolve(this.keycloak.updateToken(20));
    this.refreshInFlight = refreshPromise
      .then(() => {})
      .catch(async (e: unknown) => {
        this.toastService.showError({
          summary: this.translate.instant(`${this.translationKey}.refreshTokenFailed.summary`),
          detail: this.translate.instant(`${this.translationKey}.refreshTokenFailed.detail`),
        });
        console.warn('Failed to refresh token, logging out...', e);
        await this.logout();
        throw e;
      })
      .finally(() => {
        this.refreshInFlight = undefined;
      });
    return this.refreshInFlight;
  }

  private getRealmNameFromTokenIssuer(): string | undefined {
    const issuer = typeof this.keycloak?.tokenParsed?.iss === 'string' ? this.keycloak.tokenParsed.iss : '';
    if (issuer.trim() === '') {
      return undefined;
    }
    const marker = '/realms/';
    const markerIndex = issuer.indexOf(marker);
    if (markerIndex < 0) {
      return undefined;
    }
    const realmStart = markerIndex + marker.length;
    const realmEnd = issuer.indexOf('/', realmStart);
    const realmName = (realmEnd >= 0 ? issuer.slice(realmStart, realmEnd) : issuer.slice(realmStart)).trim();
    return realmName !== '' ? realmName : undefined;
  }

  /**
   * Starts a timer to refresh the session tokens periodically.
   */
  private startTokenRefreshScheduler(): void {
    this.bindWindowListeners();
    if (this.refreshIntervalId !== undefined) {
      return;
    }
    this.refreshIntervalId = setInterval(() => {
      void this.ensureFreshToken();
    }, 15_000);
  }

  /**
   * Cancels any scheduled token refresh schedulers.
   */
  private stopTokenRefreshScheduler(): void {
    this.unbindWindowListeners();
    if (this.refreshIntervalId !== undefined) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = undefined;
    }
  }

  private onVisibilityChange?: () => void = () => {};
  private onFocus?: () => void = () => {};
  private onOnline?: () => void = () => {};

  /** Bind window listeners so a returning user gets a fresh token without being logged out. */
  private bindWindowListeners(): void {
    if (this.windowListenersActive) {
      return;
    }

    this.onVisibilityChange = () => {
      if (!document.hidden) {
        void this.ensureFreshToken();
      }
    };
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.onFocus = () => {
      void this.ensureFreshToken();
    };
    this.onOnline = () => {
      void this.ensureFreshToken();
    };
    window.addEventListener('focus', this.onFocus);
    window.addEventListener('online', this.onOnline);

    this.windowListenersActive = true;
  }

  /** Unbind window listeners; call on logout to avoid leaks. */
  private unbindWindowListeners(): void {
    if (!this.windowListenersActive) {
      return;
    }
    if (this.onVisibilityChange) {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    if (this.onFocus) {
      window.removeEventListener('focus', this.onFocus);
    }
    if (this.onOnline) {
      window.removeEventListener('online', this.onOnline);
    }
    this.windowListenersActive = false;
  }

  /** Creates a Keycloak client instance bound to the TUM realm. */
  private createKeycloakClient(): Keycloak {
    return new Keycloak({
      url: this.config.keycloak.url,
      realm: this.config.keycloak.tumLoginRealm,
      clientId: this.config.keycloak.clientId,
    });
  }

  /** Lazily creates and returns the passkey manager bound to current app config. */
  private getPasskeyManager(): KeycloakPasskeyManager {
    this.passkeyManager ??= new KeycloakPasskeyManager({
      keycloakUrl: this.config.keycloak.url,
      tumRealmName: this.config.keycloak.tumLoginRealm,
      clientId: this.config.keycloak.clientId,
      relyingPartyId: this.config.keycloak.relyingPartyId,
      getTokenParsed: () => (this.keycloak?.tokenParsed ?? {}) as Record<string, unknown>,
      canManagePasskeys: () => this.canManagePasskeys(),
      getPasskeyUserIdentity: () => this.getPasskeyUserIdentity(),
      listPasskeys: () => firstValueFrom(this.authenticationApi.listPasskeys()),
      removePasskey: (id: string) => firstValueFrom(this.authenticationApi.removePasskey(id)),
      createPasskeyActionToken: () => firstValueFrom(this.authenticationApi.createPasskeyActionToken()),
    });
    return this.passkeyManager;
  }

  /**
   * Silently initializes the Keycloak client for the TUM realm, activates it on success,
   * and returns authentication state.
   */
  private async initializeSession(): Promise<boolean> {
    const keycloak = this.createKeycloakClient();
    const authenticated = await this.initializeKeycloak(keycloak).catch((error: unknown) => {
      console.warn('Keycloak init failed:', error);
      return false;
    });
    if (authenticated) {
      this.activateKeycloakClient(keycloak);
      return true;
    }

    this.clearActiveRealm();
    return false;
  }

  /**
   * Initializes a Keycloak client in silent SSO mode and starts token refresh if authenticated.
   */
  private async initializeKeycloak(keycloak: Keycloak): Promise<boolean> {
    const authenticated = await keycloak.init(this.getCheckSsoOptions());
    if (!authenticated) {
      console.warn('Keycloak not authenticated.');
      return authenticated;
    }
    this.startTokenRefreshScheduler();
    return authenticated;
  }

  /**
   * Performs lightweight Keycloak initialization prior to interactive login redirect.
   */
  private async initializeKeycloakForLogin(keycloak: Keycloak): Promise<void> {
    await keycloak.init(this.getLoginOptions());
  }

  /** Keycloak init options for silent SSO check during app bootstrap. */
  private getCheckSsoOptions(): KeycloakInitOptions {
    return {
      onLoad: 'check-sso',
      silentCheckSsoRedirectUri: window.location.origin + '/assets/silent-check-sso.html',
      silentCheckSsoFallback: false,
      checkLoginIframe: true,
      pkceMethod: 'S256',
      enableLogging: environment.keycloak.enableLogging,
    };
  }

  /** Keycloak init options for explicit login flow bootstrap. */
  private getLoginOptions(): KeycloakInitOptions {
    return {
      checkLoginIframe: false,
      pkceMethod: 'S256',
      enableLogging: environment.keycloak.enableLogging,
    };
  }

  /**
   * Re-initializes the target realm client after passkey auth so browser session cookies
   * are converted into usable Keycloak tokens in the SPA.
   */
  private async refreshKeycloakSessionFromBrowser(): Promise<void> {
    this.stopTokenRefreshScheduler();
    const keycloak = this.createKeycloakClient();
    const authenticated = await this.initializeKeycloak(keycloak);
    if (!authenticated) {
      throw new Error('No session after passkey auth');
    }
    this.activateKeycloakClient(keycloak);
  }

  /**
   * Applies a safe post-passkey redirect if a target differs from current URL.
   */
  private redirectAfterPasskeyLogin(redirectUri?: string): void {
    const validRedicrectUri = buildRedirectUri(redirectUri);
    if (redirectUri === undefined || window.location.href === validRedicrectUri) {
      return;
    }

    window.location.replace(validRedicrectUri);
  }

  /** Marks the given Keycloak client as the active session. */
  private activateKeycloakClient(keycloak: Keycloak): void {
    this.keycloak = keycloak;
  }

  /** Clears the active Keycloak session state. */
  private clearActiveRealm(): void {
    this.keycloak = undefined;
  }

  private getPasskeyUserIdentity(): { id: string; username: string; displayName: string } | undefined {
    const user = this.accountService.user();
    if (user === undefined) {
      return undefined;
    }

    return {
      id: user.id,
      username: user.email || user.id,
      displayName: user.name || user.email || user.id,
    };
  }
}
