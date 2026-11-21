import { Provider } from '@angular/core';
import { vi } from 'vitest';
import { DialogService } from 'app/shared/dialog/dialog.service';

import { createDialogRefMock } from './dialog-ref.mock';

export type DialogServiceMock = {
  open: ReturnType<typeof vi.fn>;
};

export function createDialogServiceMock(): DialogServiceMock {
  return {
    open: vi.fn().mockReturnValue(createDialogRefMock()),
  };
}

export function provideDialogServiceMock(mock: DialogServiceMock = createDialogServiceMock()): Provider {
  return { provide: DialogService, useValue: mock };
}
