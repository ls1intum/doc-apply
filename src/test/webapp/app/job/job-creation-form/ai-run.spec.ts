import { describe, expect, it } from 'vitest';

import { AiRun } from 'app/job/job-creation-form/ai-run';

describe('AiRun', () => {
  it('should expose an active signal before it is cancelled', () => {
    const run = new AiRun();

    expect(run.isStale()).toBe(false);
    expect(run.signal.aborted).toBe(false);
  });

  it('should be stale and aborted after it is cancelled', () => {
    const run = new AiRun();

    run.cancel();

    expect(run.isStale()).toBe(true);
    expect(run.signal.aborted).toBe(true);
  });
});
