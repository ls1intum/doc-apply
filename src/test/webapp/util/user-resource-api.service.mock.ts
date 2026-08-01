import { vi } from 'vitest';
import { Provider } from '@angular/core';
import { UserResourceApi } from 'app/generated/api/user-resource-api';

export type UserResourceApiMock = {
  getCurrentUser: ReturnType<typeof vi.fn>;
  updateUserName: ReturnType<typeof vi.fn>;
  updatePassword: ReturnType<typeof vi.fn>;
  getAiConsent: ReturnType<typeof vi.fn>;
  getAllProfessors: ReturnType<typeof vi.fn>;
};

export function createUserResourceApiMock(): UserResourceApiMock {
  return {
    getCurrentUser: vi.fn(),
    updateUserName: vi.fn(),
    updatePassword: vi.fn(),
    getAiConsent: vi.fn(),
    getAllProfessors: vi.fn(),
  };
}

export function provideUserResourceApiMock(mock: UserResourceApiMock = createUserResourceApiMock()): Provider {
  return { provide: UserResourceApi, useValue: mock };
}
