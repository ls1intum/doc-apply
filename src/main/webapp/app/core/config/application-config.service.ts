import { Injectable } from '@angular/core';
import { ApplicationConfig, KeycloakConfig, OtpConfig } from 'app/core/config/application-config.model';

@Injectable({
  providedIn: 'root',
})
export class ApplicationConfigService {
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

  /**
   * Returns the loaded configuration, or an empty one when the config call did not succeed. The
   * getters above supply defaults from there, so the app degrades instead of throwing on every
   * access — the failure itself is reported once by the initializer that loaded it.
   *
   * @returns the configuration, empty when none was loaded
   */
  getAppConfig(): ApplicationConfig {
    return this._config ?? {};
  }
}
