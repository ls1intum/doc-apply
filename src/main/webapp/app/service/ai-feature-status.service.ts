import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AiFeatureToggleResourceApi } from 'app/generated/api/ai-feature-toggle-resource-api';
import { AccountService } from 'app/core/auth/account.service';

/**
 * Service that tracks the system-wide AI feature availability.
 *
 * Fetches the status from {@code /api/ai/feature-toggle/status} once a user is signed in
 * and exposes reactive signals so components can hide or disable AI features
 * when the system-wide kill switch is active or the circuit breaker has tripped.
 *
 * Call {@link refresh} to re-check after a 503 response.
 */
@Injectable({
  providedIn: 'root',
})
export class AiFeatureStatusService {
  /** Whether AI is available system-wide (manual toggle ON and circuit breaker closed). */
  readonly aiSystemEnabled = signal<boolean>(true);

  /** Whether an admin has manually disabled AI. */
  readonly manuallyDisabled = signal<boolean>(false);

  /** Whether the circuit breaker tripped due to consecutive LLM failures. */
  readonly circuitBreakerOpen = signal<boolean>(false);

  private aiFeatureToggleApi = inject(AiFeatureToggleResourceApi);
  private accountService = inject(AccountService);

  /**
   * Loads the status whenever someone signs in. The endpoint requires a login, and calling it for a
   * visitor ends in a 401 that the auth interceptor treats as an expired session.
   */
  private readonly loadOnSignInEffect = effect(() => {
    if (this.accountService.signedIn()) {
      untracked(() => void this.refresh());
    }
  });

  /**
   * Fetches the current AI feature status from the server.
   * Components can call this after receiving a 503 to update UI state.
   */
  async refresh(): Promise<void> {
    try {
      const status = await firstValueFrom(this.aiFeatureToggleApi.getAiStatus());
      this.aiSystemEnabled.set(status.aiEnabled ?? false);
      this.manuallyDisabled.set(status.manuallyDisabled ?? false);
      this.circuitBreakerOpen.set(status.circuitBreakerOpen ?? false);
    } catch (error) {
      // Only mark AI unavailable on a confirmed 503 from the toggle endpoint.
      // Transient network/auth/other errors keep the previous state so a
      // momentary blip during startup does not disable AI in the UI.
      if (error instanceof HttpErrorResponse && error.status === 503) {
        this.aiSystemEnabled.set(false);
      }
    }
  }

  /**
   * Marks AI as unavailable locally (called when a 503 is received from an AI endpoint).
   * Also triggers a refresh to get the full status from the server.
   */
  markUnavailable(): void {
    this.aiSystemEnabled.set(false);
    void this.refresh();
  }
}
