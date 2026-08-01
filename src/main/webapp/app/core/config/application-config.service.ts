import { Injectable, inject } from '@angular/core';
import { ApplicationConfig, KeycloakConfig, OtpConfig } from 'app/core/config/application-config.model';
import { ToastService } from 'app/service/toast-service';

@Injectable({
  providedIn: 'root',
})
export class ApplicationConfigService {
  toastService = inject(ToastService);
  private _config?: ApplicationConfig;

  /**
   * Convenience getters with sane defaults
   */

  /** Returns the entire Keycloak configuration or sensible defaults */
  get keycloak(): KeycloakConfig {
    const keycloak = this.getAppConfig().keycloak;
    return {
      url: keycloak?.url ?? '',
      tumLoginRealm: keycloak?.tumLoginRealm ?? '',
      clientId: keycloak?.clientId ?? '',
      relyingPartyId: keycloak?.relyingPartyId ?? '',
    };
  }

  /** Returns the entire OTP configuration or sensible defaults */
  get otp(): OtpConfig {
    const otp = this.getAppConfig().otp;
    return {
      length: otp?.length ?? 4,
      ttlSeconds: otp?.ttlSeconds ?? 300,
      resendCooldownSeconds: otp?.resendCooldownSeconds ?? 60,
    };
  }

  getEndpointFor(api: string): string {
    return api;
  }

  setAppConfig(config: ApplicationConfig): void {
    this._config = Object.freeze(structuredClone(config));
  }

  getAppConfig(): ApplicationConfig {
    if (!this._config) {
      this.toastService.showError({
        summary: 'Error',
        detail: 'Failed to load the application. Please refresh the' + ' page.',
      });
      throw new Error('ApplicationConfig not initialized yet');
    }
    return this._config;
  }
}
