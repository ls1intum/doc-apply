import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';

import { AuthDialogService } from 'app/core/auth/auth-dialog.service';
import { AuthCardComponent } from 'app/shared/components/templates/auth-card/auth-card.component';
import { AuthOpenOptions } from 'app/core/auth/models/auth.model';

import {
  AuthOrchestratorServiceMock,
  createAuthOrchestratorServiceMock,
  provideAuthOrchestratorServiceMock,
} from 'util/auth-orchestrator.service.mock';

import { createDialogServiceMock, DialogServiceMock, provideDialogServiceMock } from 'util/dialog.service.mock';

describe('AuthDialogService', () => {
  let authDialogService: AuthDialogService;
  let authOrchestratorMock: AuthOrchestratorServiceMock;
  let dialogService: DialogServiceMock;

  beforeEach(() => {
    authOrchestratorMock = createAuthOrchestratorServiceMock();
    dialogService = createDialogServiceMock();

    TestBed.configureTestingModule({
      providers: [AuthDialogService, provideAuthOrchestratorServiceMock(authOrchestratorMock), provideDialogServiceMock(dialogService)],
    });

    authDialogService = TestBed.inject(AuthDialogService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createDialogRefMocks() {
    const closed$ = new Subject<unknown>();

    const ref = {
      close: vi.fn(),
      closed: closed$.asObservable(),
    };

    return { ref, closed$ };
  }

  describe('open', () => {
    it('should not throw when the dialog cannot be opened', () => {
      // The dialog service returns undefined while a previous auth dialog is still being destroyed.
      dialogService.open.mockReturnValue(undefined);

      expect(() => authDialogService.open()).not.toThrow();
      expect(authOrchestratorMock.close).toHaveBeenCalledOnce();
    });

    it('should open the dialog and notify orchestrator with provided options', () => {
      const { ref } = createDialogRefMocks();
      dialogService.open.mockReturnValue(ref);

      const opts: AuthOpenOptions = { mode: 'login' };

      authDialogService.open(opts);

      expect(authOrchestratorMock.open).toHaveBeenCalledOnce();
      expect(authOrchestratorMock.open).toHaveBeenCalledWith(opts);
      expect(dialogService.open).toHaveBeenCalledOnce();

      const [component, config] = dialogService.open.mock.calls[0];
      expect(component).toBe(AuthCardComponent);
      expect(config).toMatchObject({
        dismissableMask: true,
        showHeader: false,
      });

      expect(ref.close).not.toHaveBeenCalled();
    });

    it('should close existing dialog before opening a new one', () => {
      const first = createDialogRefMocks();
      const second = createDialogRefMocks();

      dialogService.open.mockReturnValueOnce(first.ref).mockReturnValueOnce(second.ref);

      authDialogService.open();
      authDialogService.open();

      expect(first.ref.close).toHaveBeenCalledOnce();
      expect(second.ref.close).not.toHaveBeenCalled();
      expect(dialogService.open).toHaveBeenCalledTimes(2);
    });
  });

  describe('close', () => {
    it('should close dialog and orchestrator when close is called', () => {
      const { ref } = createDialogRefMocks();
      dialogService.open.mockReturnValue(ref);

      authDialogService.open();
      authDialogService.close();

      expect(ref.close).toHaveBeenCalledOnce();
      expect(authOrchestratorMock.close).toHaveBeenCalledOnce();
    });
  });

  describe('reactive closing events', () => {
    it('should close dialog and orchestrator when the dialog closes', () => {
      const { ref, closed$ } = createDialogRefMocks();
      dialogService.open.mockReturnValue(ref);

      authDialogService.open();

      closed$.next(undefined);
      TestBed.tick();

      expect(ref.close).toHaveBeenCalledOnce();
      expect(authOrchestratorMock.close).toHaveBeenCalledOnce();
    });

    it('should close dialog when orchestrator isOpen becomes false', () => {
      const { ref } = createDialogRefMocks();
      dialogService.open.mockReturnValue(ref);

      authDialogService.open();

      authOrchestratorMock.isOpen.set(false);
      TestBed.tick();

      expect(ref.close).toHaveBeenCalledOnce();
      expect(authOrchestratorMock.close).not.toHaveBeenCalled();
    });
  });
});
