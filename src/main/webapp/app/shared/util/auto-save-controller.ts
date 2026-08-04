import { Signal, signal } from '@angular/core';
import { AUTO_SAVE_DELAY_MS, SavingState, SavingStates } from 'app/shared/constants/saving-states';

export interface AutoSaveControllerOptions {
  /**
   * Function invoked when the debounce timer fires.
   * Resolve `true` if the data was persisted, `false` if it failed.
   * Throwing is treated the same as resolving `false`.
   */
  save: () => Promise<boolean> | boolean;
  /** Override the debounce window. Defaults to {@link AUTO_SAVE_DELAY_MS}. */
  delayMs?: number;
}

/**
 * Debounced auto-save state machine shared by the job, application, and email-template forms.
 *
 * 1. Consumers call {@link notifyChanged} on every user edit. The badge flips to `SAVING`
 *    so the user can see that pending changes will be persisted, and the {@link AUTO_SAVE_DELAY_MS}
 *    debounce timer is (re)started.
 * 2. Once the timer fires the `save` callback runs while the badge stays on `SAVING`,
 *    so the state remains visible across the wait window AND the network round-trip.
 * 3. The state settles to `SAVED` or `FAILED` based on the callback result.
 */
export class AutoSaveController {
  /** Read-only signal that components can bind to (e.g. `<jhi-saving-badge [state]="autoSave.state()" />`). */
  readonly state: Signal<SavingState>;

  private readonly _state = signal<SavingState>(SavingStates.SAVED);
  private readonly delayMs: number;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly options: AutoSaveControllerOptions) {
    this.delayMs = options.delayMs ?? AUTO_SAVE_DELAY_MS;
    this.state = this._state.asReadonly();
  }

  /**
   * Flip the badge to `SAVING` and (re)start the debounce timer. Should be called whenever
   * the form's value changes. The badge stays on `SAVING` until the actual save callback
   * settles, so the user can see that pending edits will be persisted.
   */
  notifyChanged(): void {
    this.cancelTimer();
    this._state.set(SavingStates.SAVING);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.runSave();
    }, this.delayMs);
  }

  /**
   * Whether there are debounced edits still waiting to be saved (the timer is
   * armed). Returns `false` while a save is in flight or once it has settled.
   * Callers use this to avoid forcing a redundant save when nothing changed.
   */
  hasPending(): boolean {
    return this.timer !== undefined;
  }

  /**
   * Run the save callback immediately, bypassing the debounce window.
   * Useful for explicit "save now" actions like leaving the page.
   */
  async flush(): Promise<void> {
    this.cancelTimer();
    await this.runSave();
  }

  /** Force the badge into a specific state, e.g. after an external save. */
  setState(state: SavingState): void {
    this._state.set(state);
  }

  /** Cancel any pending save and reset the badge to `SAVED`. */
  reset(): void {
    this.cancelTimer();
    this._state.set(SavingStates.SAVED);
  }

  /** Stop the timer without touching the badge. Call this when the host component is destroyed. */
  dispose(): void {
    this.cancelTimer();
  }

  private cancelTimer(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private async runSave(): Promise<void> {
    this._state.set(SavingStates.SAVING);
    try {
      const saved = await this.options.save();
      this._state.set(saved ? SavingStates.SAVED : SavingStates.FAILED);
    } catch {
      this._state.set(SavingStates.FAILED);
    }
  }
}
