import { EffectRef, Injectable, Injector, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DialogRef, DialogService } from 'app/shared/dialog/dialog.service';
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
 *  - Opens the `AuthCardComponent` inside a dialog.
 *  - Bridges dialog lifecycle (open/close/destroy) to the orchestrator (`orchestrator.open/close`).
 *  - Reacts to the dialog closing (by any means) using Angular signals and effects.
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
  private ref: DialogRef | undefined;
  private onRefEventsEffect?: EffectRef;
  private onOrchestratorEffect?: EffectRef;

  /**
   * Opens the auth dialog and wires its lifecycle to the orchestrator.
   *
   * Order of operations:
   *  1) Close any dialog still open and tear down its effects.
   *  2) Hand the options to the orchestrator, which keeps the success callback.
   *  3) Open the dialog and react to its close and destroy events.
   *
   * Does nothing when a previous auth dialog is still closing, since the dialog service refuses to
   * stack two dialogs of the same component.
   *
   * @param opts what the dialog should start on, and what to run once authentication succeeds
   */
  open(opts?: AuthOpenOptions): void {
    // Ensure any previous dialog/effects are cleaned up before opening a new one
    if (this.ref) {
      try {
        this.ref.close();
      } finally {
        this.ref = undefined;
      }
    }
    this.destroyEffects();

    // Initialize orchestrator state (this stores opts.onSuccess intern)
    this.orchestrator.open(opts);

    // Open new dialog
    const ref = this.dialogService.open(AuthCardComponent, {
      style: { border: 'none', overflow: 'auto', background: 'transparent', boxShadow: 'none', width: 'min(25rem, 95vw)' },
      contentStyle: { padding: '0' },
      dismissableMask: true,
      showHeader: false,
    });

    // The dialog service refuses a second dialog of the same component, which happens while a previous
    // auth dialog is still being torn down. Leave the orchestrator closed so the next attempt starts clean.
    if (ref === undefined) {
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
            this.ref = undefined;
          }
        }
      },
      { injector: this.injector },
    );

    const closedSig = toSignal(ref.closed.pipe(map(() => true)), { injector: this.injector, initialValue: false });

    this.onRefEventsEffect = effect(
      () => {
        if (closedSig() && this.ref) {
          try {
            this.ref.close();
          } finally {
            this.ref = undefined;
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
   *  1) Attempt to close the dialog (if it exists).
   *  2) Clear the reference and notify the orchestrator via `orchestrator.close()`.
   *  3) Tear down reactive effects to prevent memory leaks.
   *
   * This method is idempotent and safe to call multiple times.
   */
  close(): void {
    try {
      this.ref?.close();
    } finally {
      this.ref = undefined;
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
