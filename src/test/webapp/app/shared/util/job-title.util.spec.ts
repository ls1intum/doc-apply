import { describe, expect, it } from 'vitest';
import { hasGenderNote } from 'app/shared/util/job-title.util';

describe('hasGenderNote', () => {
  it.each([
    ['Doctoral Researcher (m/w/d)', true],
    ['Doktorand (w/m/d) in Robotik', true],
    ['Doctoral Researcher (M/F/D)', true],
    ['Doctoral Researcher ( m / w / x )', true],
    ['Doctoral Researcher', false],
    ['Doctoral Researcher (Robotics)', false],
    [undefined, false],
  ])('should tell whether "%s" already contains a gender note', (title, expected) => {
    expect(hasGenderNote(title)).toBe(expected);
  });
});
