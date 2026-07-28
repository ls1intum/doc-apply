import { Injectable, Injector, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { EMPTY, endWith, interval, startWith, switchMap, takeUntil, timer } from 'rxjs';
import { Router } from '@angular/router';
import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { ToastMessageInput, ToastService } from 'app/service/toast-service';

import { AuthFlowMode, AuthOpenOptions, LoginStep, REGISTER_STEPS, RegisterStep } from './models/auth.model';

@Injectable({ providedIn: 'root' })
/**
 * Purpose
 * -------
 * Central state machine and coordinator for the authentication dialog (login & registration flows).
 *
 * Responsibilities
 * ----------------
 *  - Maintains all high-level state for the modal dialog: open/close, current mode (login/register),
 *    current sub-step for each flow (email, otp, etc.).
 *  - Holds the shared form state (email, firstName, lastName) and UI state (busy flag, error messages).
 *  - Computes progress indicators for multi-step registration and exposes a reactive cooldown timer
 *    for OTP resend.
 *  - Automatically starts the OTP cooldown whenever the user reaches the OTP step in login or register flow.
 *  - Tracks consecutive failed OTP attempts and enforces a submission cooldown after too many failures.
 *  - Provides helper methods to switch flows, navigate between steps, and reset state.
 *
 * Notes
 * -----
 *  - Pure client-side state container: does not perform any network requests itself.
 *  - Intended to be used by `AuthDialogService` and other UI components to drive the authentication UI.
 */
export class AuthOrchestratorService {
  private static readonly OTP_MAX_FAILED_ATTEMPTS = 3;
  private static readonly OTP_ATTEMPT_COOLDOWN_SECONDS = 30;
  readonly config = inject(ApplicationConfigService);
  readonly toastService = inject(ToastService);
  readonly router = inject(Router);

  // high level dialog state
  readonly isOpen = signal(false);
  readonly mode = signal<AuthFlowMode>('login');
  // substates per flow
  loginStep = signal<LoginStep>('email');
  registerStep = signal<RegisterStep>(null);
  // form state (shared across flows)
  readonly email = signal<string>('');
  readonly firstName = signal<string>('');
  readonly lastName = signal<string>('');
  // UX state
  readonly isBusy = signal(false);
  readonly error = signal<ToastMessageInput | null>(null);
  readonly redirectUri = signal<string | null>(null);
  // progress for registration dialog
  readonly registerProgress = computed(() => {
    const idx = REGISTER_STEPS.indexOf(this.registerStep());
    return idx;
  });
  readonly totalRegisterSteps = REGISTER_STEPS.length - 1;
  // cooldown for OTP resend
  readonly cooldownUntil = signal<number | undefined>(undefined);
  // cooldown for OTP submission after too many failed attempts
  readonly failedOtpAttempts = signal(0);
  readonly otpAttemptCooldownUntil = signal<number | undefined>(undefined);
  readonly injector = inject(Injector);
  readonly _tick = toSignal(
    toObservable(this.cooldownUntil).pipe(
      switchMap(cooldownUntilTimestamp => {
        if (cooldownUntilTimestamp === undefined) {
          // No cooldown: no ticking, but keep initial value
          return EMPTY;
        }
        const remainingTimeInMs = Math.max(0, cooldownUntilTimestamp - Date.now());
        if (remainingTimeInMs === 0) {
          // Already expired: emit once to trigger recompute
          return timer(0);
        }
        // Tick every 250ms until cooldown end, then emit one final value
        return interval(250).pipe(takeUntil(timer(remainingTimeInMs)), endWith(0));
      }),
      startWith(0),
    ),
    { initialValue: 0, injector: this.injector },
  );
  readonly cooldownSeconds = computed(() => {
    // depend on _tick so this recomputes ~4x per second
    this._tick();
    const cooldownUntilTimestamp = this.cooldownUntil();
    if (cooldownUntilTimestamp === undefined) {
      return 0;
    }
    const remainingTimeInMs = cooldownUntilTimestamp - Date.now();
    return remainingTimeInMs <= 0 ? 0 : Math.ceil(remainingTimeInMs / 1000);
  });

  readonly _otpAttemptTick = toSignal(
    toObservable(this.otpAttemptCooldownUntil).pipe(
      switchMap(ts => {
        if (ts === undefined) return EMPTY;
        const remaining = Math.max(0, ts - Date.now());
        if (remaining === 0) return timer(0);
        return interval(250).pipe(takeUntil(timer(remaining)), endWith(0));
      }),
      startWith(0),
    ),
    { initialValue: 0, injector: this.injector },
  );
  readonly otpAttemptCooldownSeconds = computed(() => {
    this._otpAttemptTick();
    const ts = this.otpAttemptCooldownUntil();
    if (ts === undefined) return 0;
    const remaining = ts - Date.now();
    return remaining <= 0 ? 0 : Math.ceil(remaining / 1000);
  });
  readonly isOtpAttemptCooldown = computed(() => this.otpAttemptCooldownSeconds() > 0);

  // Auto-start OTP cooldown when the user enters the OTP step in login or register
  private readonly _autoStartOtpCooldown = effect(
    () => {
      const mode = this.mode();
      const login = this.loginStep();
      const register = this.registerStep();
      const cooldownSet = this.cooldownUntil() !== undefined;

      if (!cooldownSet && ((mode === 'login' && login === 'otp') || (mode === 'register' && register === 'otp'))) {
        this.startOtpRefreshCooldown();
      }
    },
    { injector: this.injector },
  );

  private onSuccessCb: (() => void) | undefined;

  // open the dialog in a specific mode
  open(opts?: AuthOpenOptions): void {
    this.resetAll();
    if (opts?.mode) this.mode.set(opts.mode);

    const prefill = opts?.prefill;
    if (prefill) {
      this.setIfPresent(prefill.email, value => this.email.set(value));
      this.setIfPresent(prefill.firstName, value => this.firstName.set(value));
      this.setIfPresent(prefill.lastName, value => this.lastName.set(value));
    }
    if (opts?.redirectUri !== undefined && opts.redirectUri !== '') this.redirectUri.set(opts.redirectUri);

    // choose sensible starting substates
    if (this.mode() === 'login') {
      this.loginStep.set('email');
    }
    if (this.mode() === 'register') {
      this.registerStep.set('email');
    }

    this.onSuccessCb = opts?.onSuccess;
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.resetOtpAttempts();
  }

  // call after successful authentication to close and notify
  authSuccess(): void {
    this.isOpen.set(false);
    const targetUrl = this.redirectUri();

    try {
      this.onSuccessCb?.();
      if (targetUrl !== null && targetUrl !== '') {
        const path = targetUrl.startsWith(window.location.origin) ? targetUrl.slice(window.location.origin.length) : targetUrl;
        void this.router.navigateByUrl(path);
      }
    } finally {
      this.onSuccessCb = undefined;
    }
  }

  switchToLogin(): void {
    this.mode.set('login');
    this.loginStep.set('email');
  }

  switchToRegister(): void {
    this.mode.set('register');
    this.registerStep.set(null);
    requestAnimationFrame(() => {
      this.registerStep.set('email');
    });
  }

  clearError(): void {
    this.error.set(null);
  }

  setError(msg: ToastMessageInput | null): void {
    this.error.set(msg);
    if (msg) {
      this.toastService.showError(msg);
    }
  }

  nextStep(loginStep?: LoginStep): void {
    if (this.mode() === 'login' && loginStep !== undefined) {
      this.loginStep.set(loginStep);
      return;
    } else if (this.mode() === 'register') {
      const currentIndex = REGISTER_STEPS.indexOf(this.registerStep());
      if (currentIndex < REGISTER_STEPS.length - 1) {
        this.registerStep.set(REGISTER_STEPS[currentIndex + 1]);
        return;
      }
    }
    this.close();
  }

  previousStep(): void {
    if (this.mode() === 'login' && this.loginStep() !== 'email') {
      this.loginStep.set('email');
    } else {
      const currentIndex = REGISTER_STEPS.indexOf(this.registerStep());
      if (currentIndex > 0) {
        this.registerStep.set(REGISTER_STEPS[currentIndex - 1]);
      }
    }
  }

  // -------- Helpers ----------

  recordFailedOtpAttempt(): void {
    const next = this.failedOtpAttempts() + 1;
    if (next >= AuthOrchestratorService.OTP_MAX_FAILED_ATTEMPTS) {
      this.failedOtpAttempts.set(0);
      this.otpAttemptCooldownUntil.set(Date.now() + AuthOrchestratorService.OTP_ATTEMPT_COOLDOWN_SECONDS * 1000);
    } else {
      this.failedOtpAttempts.set(next);
    }
  }

  resetOtpAttempts(): void {
    this.failedOtpAttempts.set(0);
    this.otpAttemptCooldownUntil.set(undefined);
  }

  startOtpRefreshCooldown(): void {
    const cooldown = this.config.otp.resendCooldownSeconds;
    const now = Date.now();
    this.cooldownUntil.set(now + Math.max(0, cooldown) * 1000);
  }

  private setIfPresent(input: string | undefined, setter: (value: string) => void): void {
    const value = (input ?? '').replace(/\s+/g, ' ').trim();
    if (value) {
      setter(value);
    }
  }

  private resetAll(): void {
    this.isBusy.set(false);
    this.error.set(null);
    this.cooldownUntil.set(undefined);
    this.redirectUri.set(null);
    this.resetOtpAttempts();
  }
}
