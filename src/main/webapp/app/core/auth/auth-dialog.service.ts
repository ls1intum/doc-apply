import { EffectRef, Injectable, Injector, effect, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { AuthCardComponent } from 'app/shared/components/templates/auth-card/auth-card.component';

import { AuthOrchestratorService } from './auth-orchestrator.service';
import { AuthOpenOptions } from './models/auth.model';

@Injectable({ providedIn: 'root' })
/**
 * Purpose
 * -------
 * Provides a single, orchestrated entry point to open/close the authentication dialog (modal) and
 * wire it to the `AuthOrchestratorService` state machine.
 *
 * Responsibilities
 * ----------------
 *  - Opens the `AuthCardComponent` inside a PrimeNG DynamicDialog.
 *  - Bridges dialog lifecycle (open/close/destroy) to the orchestrator (`orchestrator.open/close`).
 *  - Subscribes to dialog events (`onClose`, `onDestroy`) using Angular signals and reacts via effects.
 *  - Ensures only one dialog instance is active at a time and cleans up effects reliably.
 *
 * Notes
 * -----
 *  - No authentication logic here; this service deals purely with dialog lifecycle and coupling to the orchestrator.
 */
export class AuthDialogService {
  private readonly injector = inject(Injector);
  private readonly dialogService = inject(DialogService);
  private readonly orchestrator = inject(AuthOrchestratorService);
  private ref:
    | (Omit<DynamicDialogRef, 'onClose' | 'onDestroy'> & {
        onClose: Observable<unknown>;
        onDestroy: Observable<unknown>;
      })
    | null = null;
  private onRefEventsEffect?: EffectRef;
  private onOrchestratorEffect?: EffectRef;

  open(opts?: AuthOpenOptions): void {
    // Ensure any previous dialog/effects are cleaned up before opening a new one
    if (this.ref) {
      try {
        this.ref.close();
      } finally {
        this.ref = null;
      }
    }
    this.destroyEffects();

    // Initialize orchestrator state (this stores opts.onSuccess intern)
    this.orchestrator.open(opts);

    // Open new dialog
    const ref = this.dialogService.open(AuthCardComponent, {
      style: { border: 'none', overflow: 'auto', background: 'transparent', boxShadow: 'none', width: 'min(25rem, 95vw)' },
      contentStyle: { padding: '0' },
      modal: true,
      dismissableMask: true,
      closeOnEscape: true,
      draggable: false,
      showHeader: false,
    }) as DynamicDialogRef | null;

    // PrimeNG refuses a second dialog of the same component and returns null, which happens while a
    // previous auth dialog is still being torn down. Leave the orchestrator closed so the next
    // attempt starts clean, rather than reading onClose off nothing.
    if (ref === null) {
      console.warn('The auth dialog is still closing; ignoring this request to open it.');
      this.orchestrator.close();
      return;
    }

    this.ref = ref;

    this.onOrchestratorEffect = effect(
      () => {
        const isOpen = this.orchestrator.isOpen();
        if (!isOpen && this.ref) {
          try {
            this.ref.close();
          } finally {
            this.ref = null;
          }
        }
      },
      { injector: this.injector },
    );

    const onCloseSig = toSignal<unknown>(ref.onClose, { injector: this.injector, initialValue: null });
    const onDestroySig = toSignal<unknown>(ref.onDestroy, { injector: this.injector, initialValue: null });

    this.onRefEventsEffect = effect(
      () => {
        const closed = onCloseSig();
        const destroyed = onDestroySig();
        if ((closed !== null || destroyed !== null) && this.ref) {
          try {
            this.ref.close();
          } finally {
            this.ref = null;
            this.orchestrator.close();
          }
        }
      },
      { injector: this.injector },
    );
  }

  /**
   * Closes the auth dialog (if present) and resets orchestration state.
   *
   * Order of operations:
   *  1) Attempt to close the DynamicDialogRef (if it exists).
   *  2) Null out the reference and notify the orchestrator via `orchestrator.close()`.
   *  3) Tear down reactive effects to prevent memory leaks.
   *
   * This method is idempotent and safe to call multiple times.
   */
  close(): void {
    try {
      this.ref?.close();
    } finally {
      this.ref = null;
      this.orchestrator.close();
      this.destroyEffects();
    }
  }

  private destroyEffects(): void {
    if (this.onRefEventsEffect) {
      this.onRefEventsEffect.destroy();
      this.onRefEventsEffect = undefined;
    }
    if (this.onOrchestratorEffect) {
      this.onOrchestratorEffect.destroy();
      this.onOrchestratorEffect = undefined;
    }
  }
}
