import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ToastService } from 'app/service/toast-service';
import { AuthFacadeService } from 'app/core/auth/auth-facade.service';
import { KeycloakAuthenticationService } from 'app/core/auth/keycloak-authentication.service';
import { WebAuthnService } from 'app/core/auth/webauthn.service';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';
import TranslateDirective from 'app/shared/language/translate.directive';
import { PasskeyCredentialSummary } from 'app/core/auth/models/auth.model';
import { TranslateService } from '@ngx-translate/core';
import { getLocale } from 'app/shared/util/date-time.util';

interface PasskeySettingsItem {
  id: string;
  label: string;
  createdAtLabel?: string;
  removeDisabled: boolean;
  removing: boolean;
}

/**
 * Settings panel that lets the signed-in user list, create, and remove their passkeys. Loads existing credentials on
 * init and surfaces success / error feedback through the toast service so failures don't fail silently.
 */
@Component({
  selector: 'jhi-passkey-settings',
  standalone: true,
  imports: [ButtonComponent, ConfirmDialog, TranslateDirective],
  templateUrl: './passkey-settings.component.html',
})
export class PasskeySettingsComponent {
  readonly passkeys = signal<PasskeyCredentialSummary[]>([]);
  readonly loaded = signal(false);
  readonly loadFailed = signal(false);
  readonly creating = signal(false);
  readonly removingId = signal<string | undefined>(undefined);
  readonly canManagePasskeys = computed(() => this.keycloakAuthenticationService.canManagePasskeys());
  readonly locale = computed(() => {
    this.currentLangEvent();
    return getLocale(this.translateService);
  });

  readonly passkeyItems = computed<PasskeySettingsItem[]>(() => {
    const removingId = this.removingId();
    const locale = this.locale();
    return this.passkeys().map((passkey, index) => ({
      id: passkey.id,
      label: this.getPasskeyLabel(passkey, index),
      createdAtLabel: this.getCreatedAtLabel(passkey, locale),
      removeDisabled: removingId !== undefined && removingId !== passkey.id,
      removing: removingId === passkey.id,
    }));
  });
  readonly hasPasskeys = computed(() => this.passkeyItems().length > 0);

  private readonly authFacade = inject(AuthFacadeService);
  private readonly keycloakAuthenticationService = inject(KeycloakAuthenticationService);
  private readonly webAuthnService = inject(WebAuthnService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly currentLangEvent = toSignal(this.translateService.onLangChange, { initialValue: undefined });

  constructor() {
    void this.loadPasskeys();
  }

  async createPasskey(): Promise<void> {
    if (this.creating() || !this.canManagePasskeys()) {
      return;
    }

    this.creating.set(true);
    try {
      if (this.isTumSession()) {
        await this.authFacade.registerPasskey();
      } else {
        await this.webAuthnService.register(this.defaultPasskeyLabel());
        this.toastService.showSuccessKey('auth.common.toast.passkeyRegistered');
      }
      await this.loadPasskeys();
    } catch (error) {
      // The user declining the browser prompt is not an error worth surfacing.
      if (!(error instanceof DOMException && error.name === 'NotAllowedError')) {
        this.toastService.showErrorKey('settings.passkeys.createFailed');
      }
    } finally {
      this.creating.set(false);
    }
  }

  async removePasskey(id: string): Promise<void> {
    if (this.removingId() !== undefined || !this.canManagePasskeys()) {
      return;
    }

    this.removingId.set(id);
    try {
      if (this.isTumSession()) {
        await this.keycloakAuthenticationService.removePasskey(id);
      } else {
        await this.webAuthnService.remove(id);
      }
      this.passkeys.update(passkeys => passkeys.filter(passkey => passkey.id !== id));
      this.toastService.showSuccessKey('settings.passkeys.removed');
    } catch {
      this.toastService.showErrorKey('settings.passkeys.removeFailed');
    } finally {
      this.removingId.set(undefined);
    }
  }

  /** TUM staff passkeys live in Keycloak; applicant passkeys are handled in-app. */
  private isTumSession(): boolean {
    return this.keycloakAuthenticationService.isLoggedIn();
  }

  private defaultPasskeyLabel(): string {
    return `Passkey ${new Date().toLocaleDateString()}`;
  }

  private getPasskeyLabel(passkey: PasskeyCredentialSummary, index: number): string {
    const label = passkey.label?.trim();
    if (label !== undefined && label !== '') {
      return label;
    }
    return `Passkey ${index + 1}`;
  }

  private getCreatedAtLabel(passkey: PasskeyCredentialSummary, locale: string): string | undefined {
    if (passkey.createdDate === undefined) {
      return undefined;
    }

    try {
      if (!Number.isFinite(passkey.createdDate)) {
        return undefined;
      }

      return new Date(passkey.createdDate).toLocaleString(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return undefined;
    }
  }

  private async loadPasskeys(): Promise<void> {
    if (!this.canManagePasskeys()) {
      this.passkeys.set([]);
      this.loadFailed.set(false);
      this.loaded.set(true);
      return;
    }

    this.loadFailed.set(false);
    try {
      const passkeys = this.isTumSession() ? await this.keycloakAuthenticationService.listPasskeys() : await this.webAuthnService.list();
      this.passkeys.set(passkeys);
    } catch {
      this.passkeys.set([]);
      this.loadFailed.set(true);
      this.toastService.showErrorKey('settings.passkeys.loadFailed');
    } finally {
      this.loaded.set(true);
    }
  }
}
