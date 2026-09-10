import { Component, computed, effect, inject, signal } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faBolt, faFingerprint, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import { AccountService } from 'app/core/auth/account.service';
import { AuthFacadeService } from 'app/core/auth/auth-facade.service';
import { KeycloakAuthenticationService } from 'app/core/auth/keycloak-authentication.service';
import { OnboardingOrchestratorService } from 'app/service/onboarding-orchestrator.service';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { CheckboxComponent } from 'app/shared/components/atoms/checkbox/checkbox.component';
import { DialogComponent } from 'app/shared/components/atoms/dialog/dialog.component';
import { TranslateDirective } from 'app/shared/language';

/**
 * Post-login dialog that invites a signed-in user to register a passkey for faster future sign-ins. Honours an
 * opt-out preference so the prompt is only shown once per user unless they ask to be reminded again.
 */
@Component({
  selector: 'jhi-passkey-registration-prompt',
  standalone: true,
  imports: [DialogComponent, CheckboxComponent, ButtonComponent, TranslateDirective, FontAwesomeModule],
  templateUrl: './passkey-registration-prompt.component.html',
})
export class PasskeyRegistrationPromptComponent {
  private static readonly PROMPT_PREFERENCE_ID = 'ui_pref_hide_passkey_prompt';
  private static readonly PROMPT_DISMISSED_DATE_ID = 'ui_pref_passkey_prompt_dismissed_date';

  readonly accountService = inject(AccountService);
  readonly authFacade = inject(AuthFacadeService);
  readonly keycloakAuthenticationService = inject(KeycloakAuthenticationService);
  readonly onboardingOrchestratorService = inject(OnboardingOrchestratorService);
  readonly faFingerprint = faFingerprint;
  readonly faBolt = faBolt;
  readonly faShieldHalved = faShieldHalved;

  readonly loggedIn = computed(() => this.accountService.signedIn());
  readonly promptHeaderKey = computed(() =>
    this.keycloakAuthenticationService.isTumRealmSession() ? 'auth.passkey.prompt.tum.modalHeader' : 'auth.passkey.prompt.header',
  );
  readonly visible = signal(false);
  readonly neverAskAgain = signal(false);
  readonly busy = signal(false);
  private readonly shownThisSession = signal(false);
  private readonly passkeyConfigurationLoaded = signal(false);
  private readonly hasPasskeyConfigured = signal(false);
  private readonly checkingPasskeys = signal(false);

  private readonly promptEvaluationEffect = effect(() => {
    if (!this.canEvaluatePrompt()) {
      return;
    }

    if (!this.passkeyConfigurationLoaded()) {
      if (!this.checkingPasskeys()) {
        void this.loadPasskeyConfiguration();
      }
      return;
    }

    if (this.shouldShowPrompt()) {
      this.visible.set(true);
      this.shownThisSession.set(true);
    }
  });

  close(): void {
    this.persistDismissedForToday();
    this.persistPreference();
    this.visible.set(false);
  }

  async registerPasskey(): Promise<void> {
    this.persistPreference();
    this.visible.set(false);
    this.busy.set(true);
    try {
      await this.authFacade.registerPasskey();
      this.hasPasskeyConfigured.set(true);
    } finally {
      this.busy.set(false);
    }
  }

  private canEvaluatePrompt(): boolean {
    return (
      this.loggedIn() &&
      this.keycloakAuthenticationService.canManagePasskeys() &&
      !this.shownThisSession() &&
      (!this.keycloakAuthenticationService.isTumRealmSession() || !this.onboardingOrchestratorService.suppressesFollowupPrompts()) &&
      localStorage.getItem(PasskeyRegistrationPromptComponent.PROMPT_DISMISSED_DATE_ID) !== this.getTodayDateStamp() &&
      localStorage.getItem(PasskeyRegistrationPromptComponent.PROMPT_PREFERENCE_ID) !== 'true'
    );
  }

  private shouldShowPrompt(): boolean {
    return this.canEvaluatePrompt() && this.passkeyConfigurationLoaded() && !this.hasPasskeyConfigured();
  }

  /**
   * Loads whether the account already has a passkey. A lookup that fails counts as configured, so that a
   * status nobody could determine leaves the prompt unshown rather than offering a setup that may be
   * unnecessary.
   */
  private async loadPasskeyConfiguration(): Promise<void> {
    this.checkingPasskeys.set(true);
    try {
      const passkeys = await this.keycloakAuthenticationService.listPasskeys();
      this.hasPasskeyConfigured.set(passkeys.length > 0);
    } catch {
      this.hasPasskeyConfigured.set(true);
    } finally {
      this.passkeyConfigurationLoaded.set(true);
      this.checkingPasskeys.set(false);
    }
  }

  private persistPreference(): void {
    if (!this.neverAskAgain()) {
      return;
    }
    localStorage.setItem(PasskeyRegistrationPromptComponent.PROMPT_PREFERENCE_ID, 'true');
  }

  private persistDismissedForToday(): void {
    localStorage.setItem(PasskeyRegistrationPromptComponent.PROMPT_DISMISSED_DATE_ID, this.getTodayDateStamp());
  }

  private getTodayDateStamp(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
