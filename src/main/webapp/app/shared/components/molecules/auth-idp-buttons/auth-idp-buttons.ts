import { Component, computed, inject, input } from '@angular/core';

import ButtonGroupComponent, { ButtonGroupData } from '../../molecules/button-group/button-group.component';
import { IdpProvider } from '../../../../core/auth/keycloak-authentication.service';
import { AuthFacadeService } from '../../../../core/auth/auth-facade.service';

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
    buttons: [
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
    ],
  }));
}
