import { Component, computed, inject, input } from '@angular/core';

import ButtonGroupComponent, { ButtonGroupData } from '../../molecules/button-group/button-group.component';
import { IdpProvider } from '../../../../core/auth/keycloak-authentication.service';
import { AuthFacadeService } from '../../../../core/auth/auth-facade.service';
import { AuthOrchestratorService } from '../../../../core/auth/auth-orchestrator.service';
import { Button } from '../../atoms/button/button.component';

@Component({
  selector: 'jhi-auth-idp-buttons',
  standalone: true,
  imports: [ButtonGroupComponent],
  templateUrl: './auth-idp-buttons.html',
})
export class AuthIdpButtons {
  authFacadeService = inject(AuthFacadeService);
  isRegistration = input<boolean>(false);

  readonly idpButtons = computed<ButtonGroupData>(() => ({
    direction: 'vertical',
    fullWidth: true,
    buttons: this.tumButtons().concat([
      {
        label: 'Apple',
        icon: 'apple',
        severity: 'primary',
        variant: 'outlined',
        disabled: false,
        fullWidth: true,
        onClick: () => {
          this.authFacadeService.loginWithSocialProvider(IdpProvider.Apple, this.isRegistration());
        },
      },
      {
        label: 'Google',
        icon: 'google',
        severity: 'primary',
        variant: 'outlined',
        disabled: false,
        fullWidth: true,
        onClick: () => {
          this.authFacadeService.loginWithSocialProvider(IdpProvider.Google, this.isRegistration());
        },
      },
    ]),
  }));

  private readonly orchestrator = inject(AuthOrchestratorService);

  /**
   * The TUM login, offered only when the dialog guards a route that staff members open as well, so they are not stuck
   * with the applicant logins. It returns to the same URL as the other logins.
   *
   * @returns the TUM login button, or no button
   */
  private tumButtons(): Button[] {
    if (!this.orchestrator.offerTumLogin() || this.isRegistration()) {
      return [];
    }
    return [
      {
        label: 'auth.common.tumLogin',
        icon: 'building-columns',
        severity: 'primary',
        variant: 'outlined',
        disabled: false,
        fullWidth: true,
        onClick: () => {
          void this.authFacadeService.loginWithProvider(IdpProvider.TUM, this.orchestrator.redirectUri() ?? undefined);
        },
      },
    ];
  }
}
