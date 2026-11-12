import { Component, computed, inject } from '@angular/core';
import { ToastService } from 'app/service/toast-service';
import { TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';

import { CredentialsGroupComponent } from '../../molecules/credentials-group/credentials-group.component';
import { AuthFacadeService } from '../../../../core/auth/auth-facade.service';
import { AuthOrchestratorService } from '../../../../core/auth/auth-orchestrator.service';
import { TranslateDirective } from '../../../language';
import { OtpInput } from '../../atoms/otp-input/otp-input';

@Component({
  selector: 'jhi-login',
  imports: [CredentialsGroupComponent, TranslateDirective, OtpInput, ButtonComponent],
  templateUrl: './login.html',
})
export class Login {
  readonly authFacade = inject(AuthFacadeService);
  readonly authOrchestrator = inject(AuthOrchestratorService);
  readonly toastService = inject(ToastService);
  readonly translate = inject(TranslateService);

  showPassword = computed(() => this.authOrchestrator.loginStep() === 'password');

  submitHandler = async (email: string, password?: string): Promise<boolean> => {
    if (this.showPassword()) {
      return this.onEmailLogin(email, password);
    }
    this.authOrchestrator.email.set(email);
    await this.authFacade.requestOtp();
    return Promise.resolve(true);
  };

  secondButtonHandler = (): void => {
    this.authOrchestrator.loginStep.set('password');
  };

  backButtonHandler = (): void => {
    this.authOrchestrator.previousStep();
  };

  onEmailLogin = async (email: string, password?: string): Promise<boolean> => {
    if (password == null || password.trim() === '') {
      return false;
    }
    const response = await this.authFacade.loginWithEmail(email, password);
    if (!response) {
      this.toastService.showError({
        summary: this.translate.instant('auth.login.messages.error.header'),
        detail: this.translate.instant('auth.login.messages.error.wrongCredentials'),
      });
    }
    return response;
  };
}
