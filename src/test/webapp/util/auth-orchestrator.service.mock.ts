import { vi } from 'vitest';
import { AuthOrchestratorService } from 'app/core/auth/auth-orchestrator.service';
import { Provider, signal, WritableSignal } from '@angular/core';
import { AuthFlowMode, LoginStep, RegisterStep } from 'app/core/auth/models/auth.model';

export interface AuthOrchestratorServiceMock {
  email: WritableSignal<string>;
  firstName: WritableSignal<string>;
  lastName: WritableSignal<string>;
  accountExisted: WritableSignal<boolean>;
  redirectUri: WritableSignal<string | undefined>;
  offerTumLogin: WritableSignal<boolean>;
  nextStep: ReturnType<typeof vi.fn>;
  authSuccess: ReturnType<typeof vi.fn>;
  clearError: () => void;
  setError: (msg: string | null) => void;
  isBusy: WritableSignal<boolean>;
  error: WritableSignal<string | null>;
  cooldownSeconds: WritableSignal<number>;
  startOtpRefreshCooldown: ReturnType<typeof vi.fn>;
  isOtpAttemptCooldown: WritableSignal<boolean>;
  otpAttemptCooldownSeconds: WritableSignal<number>;
  recordFailedOtpAttempt: ReturnType<typeof vi.fn>;
  resetOtpAttempts: ReturnType<typeof vi.fn>;
  isOpen: WritableSignal<boolean>;
  mode: WritableSignal<AuthFlowMode>;
  loginStep: WritableSignal<LoginStep>;
  registerStep: WritableSignal<RegisterStep>;
  registerProgress: WritableSignal<number>;
  totalRegisterSteps: number;
  open: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  previousStep: ReturnType<typeof vi.fn>;
  switchToRegister: ReturnType<typeof vi.fn>;
}

export function createAuthOrchestratorServiceMock(): AuthOrchestratorServiceMock {
  const isBusy = signal(false);
  const error = signal<string | null>(null);
  const cooldownSeconds = signal(0);
  const isOtpAttemptCooldown = signal(false);
  const otpAttemptCooldownSeconds = signal(0);

  const isOpenSignal = signal<boolean>(true);
  const errorSignal = signal<string | null>(null);

  const openMock = vi.fn(() => {
    isOpenSignal.set(true);
  });

  const closeMock = vi.fn(() => {
    isOpenSignal.set(false);
  });

  return {
    email: signal<string>('user@example.com'),
    firstName: signal<string>('Jane'),
    lastName: signal<string>('Doe'),
    accountExisted: signal<boolean>(false),
    redirectUri: signal<string | undefined>(undefined),
    offerTumLogin: signal<boolean>(false),
    nextStep: vi.fn(),
    authSuccess: vi.fn(),
    clearError: () => error.set(null),
    setError: (msg: string | null) => error.set(msg),
    isBusy,
    error,
    cooldownSeconds,
    startOtpRefreshCooldown: vi.fn(),
    isOtpAttemptCooldown,
    otpAttemptCooldownSeconds,
    recordFailedOtpAttempt: vi.fn(),
    resetOtpAttempts: vi.fn(),
    isOpen: isOpenSignal,
    mode: signal<AuthFlowMode>('login'),
    loginStep: signal<LoginStep>('email'),
    registerStep: signal<RegisterStep>('email'),
    registerProgress: signal<number>(1),
    totalRegisterSteps: 3,
    open: openMock,
    close: closeMock,
    previousStep: vi.fn(),
    switchToRegister: vi.fn(),
  };
}

export function provideAuthOrchestratorServiceMock(mock: AuthOrchestratorServiceMock = createAuthOrchestratorServiceMock()): Provider {
  return { provide: AuthOrchestratorService, useValue: mock };
}
