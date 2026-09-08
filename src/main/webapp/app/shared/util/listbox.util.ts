/**
 * Works out which option a key press moves to inside a listbox.
 *
 * Lists that are a single tab stop need the arrow keys to do the moving, so that a long list does not
 * stand between the reader and the rest of the form. Movement stops at the ends rather than wrapping,
 * which keeps the edges of the list findable without watching the focus ring.
 *
 * @param key the value of the pressed key
 * @param currentIndex the option that currently holds focus
 * @param optionCount how many options the list has
 * @returns the option to move to, or {@code undefined} if the key does not move focus
 */
export function nextOptionIndex(key: string, currentIndex: number, optionCount: number): number | undefined {
  if (optionCount <= 0) {
    return undefined;
  }

  const lastIndex = optionCount - 1;
  const clamped = Math.min(Math.max(currentIndex, 0), lastIndex);

  switch (key) {
    case 'ArrowDown':
      return Math.min(clamped + 1, lastIndex);
    case 'ArrowUp':
      return Math.max(clamped - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return lastIndex;
    default:
      return undefined;
  }
}
