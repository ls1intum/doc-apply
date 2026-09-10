import { PublicConfigResourceApi } from 'app/generated/api/public-config-resource-api';
import { Provider } from '@angular/core';
import { vi, Mock } from 'vitest';

export interface PublicConfigResourceApiMock {
  config: Mock;
}

export function createPublicConfigResourceApiMock(): PublicConfigResourceApiMock {
  return {
    config: vi.fn(),
  };
}

export function providePublicConfigResourceApiMock(mock: PublicConfigResourceApiMock = createPublicConfigResourceApiMock()): Provider {
  return { provide: PublicConfigResourceApi, useValue: mock };
}
