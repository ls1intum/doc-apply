/**
 * Utility functions for rating conversions
 */

/**
 * Converts a Likert scale rating (-2 to +2) to a standard 1-5 rating scale.
 * This is used for displaying ratings to users in a more familiar format.
 *
 * Mapping:
 * -2 → 1 (Poor)
 * -1 → 2 (Fair)
 *  0 → 3 (Satisfactory)
 *  1 → 4 (Good)
 *  2 → 5 (Excellent)
 *
 * @param likertRating - The rating on the Likert scale (-2 to +2), can be null/undefined
 * @returns The converted rating on a 1-5 scale, or undefined if input is null/undefined
 */
export function convertLikertToStandardRating(likertRating: number | undefined): number | undefined {
  if (likertRating === undefined) {
    return undefined;
  }

  // Convert -2 to +2 scale to 1-5 scale by adding 3
  return likertRating + 3;
}

/** Tailwind class per step of the rating scale, indexed by how many stars that step fills. */
const STAR_COLOUR_CLASSES: Record<number, string> = {
  1: 'text-rating-star-1',
  2: 'text-rating-star-2',
  3: 'text-rating-star-3',
  4: 'text-rating-star-4',
  5: 'text-rating-star-5',
};

/** Colour of a star that is not filled, shared so both rating views look alike. */
export const EMPTY_STAR_COLOUR_CLASS = 'text-text-tertiary';

/**
 * Returns the colour class for the filled stars of a rating on the 1-5 scale.
 *
 * Shared between the rating input, which moves in whole steps, and the average shown on application
 * cards, which can be fractional. Rounding to the nearest whole star keeps an average of 3.6 on the
 * same colour as the four star rating it sits closest to, so the two views never disagree.
 *
 * @param stars - How many stars are filled, on the 1-5 scale
 * @returns The Tailwind text colour class, or an empty string when there is nothing to colour
 */
export function ratingStarColourClass(stars: number | undefined): string {
  if (stars === undefined || stars <= 0) {
    return '';
  }

  const step = Math.min(5, Math.max(1, Math.round(stars)));
  return STAR_COLOUR_CLASSES[step];
}

/**
 * Formats a rating value for display, showing one decimal place.
 *
 * @param rating - The rating value to format
 * @returns Formatted rating string (e.g., "4.5") or undefined
 */
export function formatRating(rating: number | undefined): string | undefined {
  if (rating === undefined) {
    return undefined;
  }

  return rating.toFixed(1);
}
