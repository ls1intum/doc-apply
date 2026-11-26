import { AiFeatureToggleResourceApi } from 'app/generated/api/ai-feature-toggle-resource-api';
import { Provider } from '@angular/core';
import { vi, Mock } from 'vitest';

export interface AiFeatureToggleResourceApiMock {
  getAiStatus: Mock;
  toggleAi: Mock;
  resetCircuitBreaker: Mock;
}

export function createAiFeatureToggleResourceApiMock(): AiFeatureToggleResourceApiMock {
  return {
    getAiStatus: vi.fn(),
    toggleAi: vi.fn(),
    resetCircuitBreaker: vi.fn(),
  };
}

export function provideAiFeatureToggleResourceApiMock(
  mock: AiFeatureToggleResourceApiMock = createAiFeatureToggleResourceApiMock(),
): Provider {
  return { provide: AiFeatureToggleResourceApi, useValue: mock };
}
