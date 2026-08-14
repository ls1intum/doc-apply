import { Provider } from '@angular/core';
import { vi, Mock } from 'vitest';
import { UserAdminResourceApi } from 'app/generated/api/user-admin-resource-api';

export interface UserAdminResourceApiMock {
  createUser: Mock;
  deleteUser: Mock;
  getAllUsers: Mock;
  getUser: Mock;
  importUser: Mock;
  updateUser: Mock;
}

export function createUserAdminResourceApiMock(): UserAdminResourceApiMock {
  return {
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    getAllUsers: vi.fn(),
    getUser: vi.fn(),
    importUser: vi.fn(),
    updateUser: vi.fn(),
  };
}

export function provideUserAdminResourceApiMock(mock: UserAdminResourceApiMock = createUserAdminResourceApiMock()): Provider {
  return { provide: UserAdminResourceApi, useValue: mock };
}
