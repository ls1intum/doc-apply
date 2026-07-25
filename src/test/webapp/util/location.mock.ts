import { Location } from '@angular/common';
import { Provider } from '@angular/core';
import { vi } from 'vitest';

export type LocationMock = Pick<Location, 'back' | 'forward' | 'path' | 'go' | 'replaceState'>;

export function createLocationMock(): LocationMock {
  return {
    back: vi.fn(),
    forward: vi.fn(),
    path: vi.fn().mockReturnValue(''),
    go: vi.fn(),
    replaceState: vi.fn(),
  };
}

export function provideLocationMock(mock: LocationMock = createLocationMock()): Provider {
  return { provide: Location, useValue: mock };
}
