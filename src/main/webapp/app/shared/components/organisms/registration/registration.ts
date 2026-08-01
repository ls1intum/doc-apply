import { Component, computed, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProgressBar } from 'primeng/progressbar';
import { ToastMessageInput } from 'app/service/toast-service';
import { TranslateService } from '@ngx-translate/core';
import { AuthOrchestratorService } from 'app/core/auth/auth-orchestrator.service';
import { AccountService } from 'app/core/auth/account.service';
import { AuthFacadeService } from 'app/core/auth/auth-facade.service';

import { CredentialsGroupComponent } from '../../molecules/credentials-group/credentials-group.component';
import { TranslateDirective } from '../../../language';
import { OtpInput } from '../../atoms/otp-input/otp-input';
import { ButtonComponent } from '../../atoms/button/button.component';
import { PasswordInputComponent } from '../../atoms/password-input/password-input';
import { ProfileComponent } from '../../molecules/profile/profile.component';

@Component({
  selector: 'jhi-registration',
  imports: [
    ButtonComponent,
    CredentialsGroupComponent,
    OtpInput,
    ProgressBar,
    TranslateDirective,
    PasswordInputComponent,
    ProfileComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './registration.html',
  styleUrl: './registration.scss',
})
export class Registration {
  readonly authFacade = inject(AuthFacadeService);
  readonly accountService = inject(AccountService);
  readonly authOrchestrator = inject(AuthOrchestratorService);
  readonly translate = inject(TranslateService);

  readonly registerProgress = computed(() => this.authOrchestrator.registerProgress());
  readonly totalRegisterSteps = this.authOrchestrator.totalRegisterSteps;
  readonly registerProgressInPercent = computed(() => (this.registerProgress() / this.totalRegisterSteps) * 100);
  readonly showBackButton = computed(() => this.authOrchestrator.registerStep() === 'otp');
  readonly showSkipButton = computed(() => this.authOrchestrator.registerStep() === 'password');

  passwordForm: FormGroup<{ password: FormControl<string> }>;

  private readonly translationKey = 'auth.common.toast';

  constructor() {
    const fb = inject(FormBuilder);
    // Mirror the server's UpdatePasswordDTO constraint (@Size(min = 8, max = 128)) so an invalid
    // password is caught inline instead of failing the request with a generic error.
    this.passwordForm = fb.nonNullable.group({
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
    });
  }

  sendOtp = async (email: string): Promise<boolean> => {
    const normalized = email.trim();
    if (!normalized) {
      return false;
    }
    this.authOrchestrator.email.set(normalized);
    await this.authFacade.requestOtp(true);
    return true;
  };

  setProfile = async (firstName: string, lastName: string): Promise<void> => {
    await this.runWithOrchestratorBusy(
      async () => {
        await this.accountService.updateUser(firstName, lastName);
        this.authOrchestrator.nextStep();
      },
      {
        summary: this.translate.instant(`${this.translationKey}.updateNameFailed.summary`),
        detail: this.translate.instant(`${this.translationKey}.updateNameFailed.detail`),
      },
    );
  };

  setPassword = async (): Promise<void> => {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const { password } = this.passwordForm.getRawValue();
    await this.runWithOrchestratorBusy(
      async () => {
        await this.accountService.updatePassword(password);
        this.authOrchestrator.nextStep();
      },
      {
        summary: this.translate.instant(`${this.translationKey}.updatePasswordFailed.summary`),
        detail: this.translate.instant(`${this.translationKey}.updatePasswordFailed.detail`),
      },
    );
  };

  sendRegistrationEmail = async (): Promise<void> => {
    await this.authFacade.sendRegistrationEmail();
  };

  onBack = (): void => {
    this.authOrchestrator.previousStep();
  };

  onSkip = (): void => {
    this.authOrchestrator.nextStep();
  };

  /**
   * Helper to run an async action while setting isBusy=true on the AuthOrchestrator,
   * catching errors and reporting them to the orchestrator.
   *
   * @param action The async function to execute
   * @param errorMessage Optional custom error message to show if the action fails
   */
  private async runWithOrchestratorBusy(
    action: () => Promise<void>,
    errorMessage: ToastMessageInput = {
      summary: this.translate.instant(`${this.translationKey}.error.summary`),
      detail: this.translate.instant(`${this.translationKey}.error.detail`),
    },
  ): Promise<void> {
    this.authOrchestrator.isBusy.set(true);
    try {
      await action();
    } catch {
      this.authOrchestrator.setError(errorMessage);
    } finally {
      this.authOrchestrator.isBusy.set(false);
    }
  }
}
