import { Provider, WritableSignal, signal } from '@angular/core';
import { vi } from 'vitest';
import { OnboardingOrchestratorService } from 'app/service/onboarding-orchestrator.service';

export type OnboardingOrchestratorServiceMock = {
  suppressesFollowupPrompts: WritableSignal<boolean>;
  accessRequestPending: WritableSignal<boolean>;
  markAccessRequestPending: ReturnType<typeof vi.fn>;
  hookToAuth: ReturnType<typeof vi.fn>;
};

/**
 * Creates a mock of the onboarding orchestrator whose signals the spec can set.
 *
 * @param accessRequestPending whether the user already has a pending access request
 * @returns the mock
 */
export function createOnboardingOrchestratorServiceMock(accessRequestPending = false): OnboardingOrchestratorServiceMock {
  const pending = signal(accessRequestPending);
  return {
    suppressesFollowupPrompts: signal(false),
    accessRequestPending: pending,
    markAccessRequestPending: vi.fn(() => pending.set(true)),
    hookToAuth: vi.fn(),
  };
}

/**
 * Provides the onboarding orchestrator mock.
 *
 * @param mock the mock to provide
 * @returns the provider
 */
export function provideOnboardingOrchestratorServiceMock(
  mock: OnboardingOrchestratorServiceMock = createOnboardingOrchestratorServiceMock(),
): Provider {
  return { provide: OnboardingOrchestratorService, useValue: mock };
}
