/** Owns cancellation and stale-state detection for one AI workflow. */
export class AiRun {
  private cancelled = false;
  private readonly abortController = new AbortController();

  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  isStale(): boolean {
    return this.cancelled;
  }

  cancel(): void {
    this.cancelled = true;
    this.abortController.abort();
  }
}
