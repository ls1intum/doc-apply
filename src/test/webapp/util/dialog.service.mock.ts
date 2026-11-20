import { Provider } from '@angular/core';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { DialogService } from 'app/shared/dialog/dialog.service';

export type DialogServiceMock = {
  open: ReturnType<typeof vi.fn>;
};

export function createDialogServiceMock(): DialogServiceMock {
  return {
    open: vi.fn().mockReturnValue({ close: vi.fn(), closed: new Subject<unknown>() }),
  };
}

export function provideDialogServiceMock(mock: DialogServiceMock = createDialogServiceMock()): Provider {
  return { provide: DialogService, useValue: mock };
}
