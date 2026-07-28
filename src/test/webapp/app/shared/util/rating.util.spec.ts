import { describe, expect, it } from 'vitest';
import { ratingStarColourClass } from 'app/shared/util/rating.util';

describe('ratingStarColourClass', () => {
  it.each<[number, string]>([
    [1, 'text-rating-star-1'],
    [2, 'text-rating-star-2'],
    [3, 'text-rating-star-3'],
    [4, 'text-rating-star-4'],
    [5, 'text-rating-star-5'],
  ])('should return the colour of step %s', (stars, expected) => {
    expect(ratingStarColourClass(stars)).toBe(expected);
  });

  it.each<[number, string]>([
    [1.4, 'text-rating-star-1'],
    [1.5, 'text-rating-star-2'],
    [3.6, 'text-rating-star-4'],
    [4.9, 'text-rating-star-5'],
  ])('should round an average of %s to the nearest step', (average, expected) => {
    expect(ratingStarColourClass(average)).toBe(expected);
  });

  it.each<[number | undefined]>([[undefined], [0], [-1]])('should return no colour for %s', value => {
    expect(ratingStarColourClass(value)).toBe('');
  });

  it('should clamp a value above the scale to the top step', () => {
    expect(ratingStarColourClass(9)).toBe('text-rating-star-5');
  });
});
