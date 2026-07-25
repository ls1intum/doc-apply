import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTO_SAVE_DELAY_MS, SavingStates } from 'app/shared/constants/saving-states';
import { AutoSaveController } from 'app/shared/util/auto-save-controller';

describe('AutoSaveController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start in the SAVED state with no pending save', () => {
    const controller = new AutoSaveController({ save: vi.fn().mockResolvedValue(true) });
    expect(controller.state()).toBe(SavingStates.SAVED);
  });

  it('should flip to SAVING immediately when notifyChanged is called but defer the save callback', () => {
    const save = vi.fn().mockResolvedValue(true);
    const controller = new AutoSaveController({ save });

    controller.notifyChanged();

    // Badge surfaces the pending save right away so the user can see edits will be persisted.
    expect(controller.state()).toBe(SavingStates.SAVING);
    // The save callback itself is still debounced and has not run yet.
    expect(save).not.toHaveBeenCalled();
  });

  it('should restart the timer when notifyChanged fires inside the debounce window', () => {
    const save = vi.fn().mockResolvedValue(true);
    const controller = new AutoSaveController({ save });

    controller.notifyChanged();
    vi.advanceTimersByTime(AUTO_SAVE_DELAY_MS - 100);

    controller.notifyChanged();
    vi.advanceTimersByTime(AUTO_SAVE_DELAY_MS - 100);

    // The first timer was reset, so the save callback has not been invoked yet.
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(save).toHaveBeenCalledOnce();
  });

  it('should flip to SAVING then SAVED when the save callback succeeds', async () => {
    const save = vi.fn().mockResolvedValue(true);
    const controller = new AutoSaveController({ save });

    controller.notifyChanged();
    vi.advanceTimersByTime(AUTO_SAVE_DELAY_MS);

    expect(controller.state()).toBe(SavingStates.SAVING);
    await vi.runAllTimersAsync();
    expect(controller.state()).toBe(SavingStates.SAVED);
  });

  it('should flip to FAILED when the save callback resolves false', async () => {
    const save = vi.fn().mockResolvedValue(false);
    const controller = new AutoSaveController({ save });

    controller.notifyChanged();
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS);

    expect(controller.state()).toBe(SavingStates.FAILED);
  });

  it('should flip to FAILED when the save callback throws', async () => {
    const save = vi.fn().mockRejectedValue(new Error('boom'));
    const controller = new AutoSaveController({ save });

    controller.notifyChanged();
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS);

    expect(controller.state()).toBe(SavingStates.FAILED);
  });

  it('should run the save callback immediately when flush is called', async () => {
    const save = vi.fn().mockResolvedValue(true);
    const controller = new AutoSaveController({ save });

    controller.notifyChanged();
    await controller.flush();

    expect(save).toHaveBeenCalledOnce();
    expect(controller.state()).toBe(SavingStates.SAVED);

    // The pending timer must be cancelled so the save fires only once.
    vi.advanceTimersByTime(AUTO_SAVE_DELAY_MS * 2);
    expect(save).toHaveBeenCalledOnce();
  });

  it('should report no pending save until notifyChanged is called', () => {
    const controller = new AutoSaveController({ save: vi.fn().mockResolvedValue(true) });
    expect(controller.hasPending()).toBe(false);

    controller.notifyChanged();
    expect(controller.hasPending()).toBe(true);
  });

  it('should clear the pending flag once the debounced save fires', async () => {
    const controller = new AutoSaveController({ save: vi.fn().mockResolvedValue(true) });

    controller.notifyChanged();
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS);

    expect(controller.hasPending()).toBe(false);
  });

  it('should clear the pending flag after flush', async () => {
    const controller = new AutoSaveController({ save: vi.fn().mockResolvedValue(true) });

    controller.notifyChanged();
    await controller.flush();

    expect(controller.hasPending()).toBe(false);
  });

  it('should cancel the pending timer without saving when dispose is called', () => {
    const save = vi.fn().mockResolvedValue(true);
    const controller = new AutoSaveController({ save });

    controller.notifyChanged();
    controller.dispose();
    vi.advanceTimersByTime(AUTO_SAVE_DELAY_MS);

    expect(save).not.toHaveBeenCalled();
  });

  it('should honour a custom delay when provided', () => {
    const save = vi.fn().mockResolvedValue(true);
    const controller = new AutoSaveController({ save, delayMs: 500 });

    controller.notifyChanged();
    vi.advanceTimersByTime(499);
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledOnce();
  });
});
