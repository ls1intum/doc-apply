import { describe, expect, it } from 'vitest';
import { formatJobTitle } from 'app/shared/util/job-title.util';

describe('formatJobTitle', () => {
  it.each([
    ['Research Assistant', '(m/w/d)', 'Research Assistant (m/w/d)'],
    ['Research Assistant', '(m/f/d)', 'Research Assistant (m/f/d)'],
    ['Research Assistant (m/w/d)', '(m/f/d)', 'Research Assistant (m/f/d)'],
    ['', '(m/w/d)', ''],
  ])('formats %s with %s', (title, suffix, expected) => {
    expect(formatJobTitle(title, suffix)).toBe(expected);
  });
});
