import { describe, expect, it } from 'vitest';
import { getUniqueNonInclusiveWords } from 'app/shared/gender-bias-analysis/gender-bias-analysis.utils';

describe('getUniqueNonInclusiveWords', () => {
  it('should return trimmed unique non-inclusive words', () => {
    const result = getUniqueNonInclusiveWords([
      { word: ' dominant ', type: 'non-inclusive' },
      { word: 'collaborative', type: 'inclusive' },
      { word: 'dominant', type: 'non-inclusive' },
      { word: ' ', type: 'non-inclusive' },
    ]);

    expect(result).toEqual(['dominant']);
  });

  it.each([
    ['undefined', undefined],
    ['empty array', []],
  ])('should return an empty array for %s input', (_label, words) => {
    expect(getUniqueNonInclusiveWords(words)).toEqual([]);
  });
});
