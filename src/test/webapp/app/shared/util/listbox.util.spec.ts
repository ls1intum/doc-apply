import { describe, expect, it } from 'vitest';
import { nextOptionIndex } from 'app/shared/util/listbox.util';

describe('nextOptionIndex', () => {
  it.each<[string, number, number]>([
    ['ArrowDown', 0, 1],
    ['ArrowUp', 2, 1],
    ['Home', 3, 0],
    ['End', 1, 4],
  ])('should move from %s at %s', (key, current, expected) => {
    expect(nextOptionIndex(key, current, 5)).toBe(expected);
  });

  it('should stop at the last option rather than wrapping to the first', () => {
    expect(nextOptionIndex('ArrowDown', 4, 5)).toBe(4);
  });

  it('should stop at the first option rather than wrapping to the last', () => {
    expect(nextOptionIndex('ArrowUp', 0, 5)).toBe(0);
  });

  it.each<[string]>([['Enter'], [' '], ['Tab'], ['a']])('should not move for %s', key => {
    expect(nextOptionIndex(key, 1, 5)).toBeUndefined();
  });

  it.each<[number]>([[0], [-1]])('should not move when the list has %s options', count => {
    expect(nextOptionIndex('ArrowDown', 0, count)).toBeUndefined();
  });

  it('should recover when the remembered option no longer exists', () => {
    expect(nextOptionIndex('ArrowDown', 9, 3)).toBe(2);
    expect(nextOptionIndex('ArrowUp', -4, 3)).toBe(0);
  });
});
