import { AddressSuggestionResourceApi } from 'app/generated/api/address-suggestion-resource-api';
import { Provider } from '@angular/core';
import { of } from 'rxjs';
import { vi, Mock } from 'vitest';

export interface AddressSuggestionResourceApiMock {
  getAddressSuggestions: Mock;
}

export function createAddressSuggestionResourceApiMock(): AddressSuggestionResourceApiMock {
  return {
    getAddressSuggestions: vi.fn().mockReturnValue(of([])),
  };
}

export function provideAddressSuggestionResourceApiMock(
  mock: AddressSuggestionResourceApiMock = createAddressSuggestionResourceApiMock(),
): Provider {
  return { provide: AddressSuggestionResourceApi, useValue: mock };
}
