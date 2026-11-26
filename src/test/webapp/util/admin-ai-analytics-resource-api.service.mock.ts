import { AdminAiAnalyticsResourceApi } from 'app/generated/api/admin-ai-analytics-resource-api';
import { Provider } from '@angular/core';
import { vi, Mock } from 'vitest';

export interface AdminAiAnalyticsResourceApiMock {
  getAiUsage: Mock;
}

export function createAdminAiAnalyticsResourceApiMock(): AdminAiAnalyticsResourceApiMock {
  return {
    getAiUsage: vi.fn(),
  };
}

export function provideAdminAiAnalyticsResourceApiMock(
  mock: AdminAiAnalyticsResourceApiMock = createAdminAiAnalyticsResourceApiMock(),
): Provider {
  return { provide: AdminAiAnalyticsResourceApi, useValue: mock };
}
