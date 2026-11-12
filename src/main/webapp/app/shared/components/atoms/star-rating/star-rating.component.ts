import { Component, computed, input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateDirective } from 'app/shared/language';
import { EMPTY_STAR_COLOUR_CLASS, ratingStarColourClass } from 'app/shared/util/rating.util';

/**
 * Component that displays a star rating on a 1-5 scale.
 * Shows filled and half-filled stars based on the rating value.
 */
@Component({
  selector: 'jhi-star-rating',
  imports: [FontAwesomeModule, TranslateDirective],
  templateUrl: './star-rating.component.html',
})
export class StarRatingComponent {
  /**
   * The rating value on a 1-5 scale (can include decimals).
   * If undefined or null, no rating is displayed.
   */
  rating = input<number | undefined>(undefined);

  /**
   * Number of stars to display (default: 5)
   */
  maxStars = input<number>(5);

  /**
   * Size of the stars: 'small' | 'medium' | 'large'
   */
  size = input<'small' | 'medium' | 'large'>('medium');

  /**
   * Whether to show the numeric rating value next to the stars
   */
  showValue = input<boolean>(true);

  /**
   * Calculates filled/half state for each star only when rating or maxStars changes.
   */
  starStates = computed(() => {
    const rating = this.rating();
    const maxStars = this.maxStars();

    return Array.from({ length: maxStars }, (_, index) => {
      if (rating === undefined) {
        return { filled: false, half: false, icon: 'star' };
      }

      const diff = rating - index;
      const icon = diff >= 1 ? 'star' : diff >= 0.5 ? 'star-half-stroke' : 'star';
      return {
        filled: diff >= 1,
        half: diff >= 0.5 && diff < 1,
        icon,
      };
    });
  });

  /**
   * Formats the rating value for display
   */
  formattedRating = computed<string | undefined>(() => {
    const rating = this.rating();
    if (rating === undefined) {
      return undefined;
    }

    return rating.toFixed(1);
  });

  /** Text size class for the stars and the numeric value. */
  sizeClass = computed<string>(() => {
    const size = this.size();
    if (size === 'small') {
      return 'text-sm';
    }
    return size === 'large' ? 'text-xl' : 'text-base';
  });

  /** Colour of the filled stars, shared with the rating input so both views use one scale. */
  starColourClass = computed<string>(() => ratingStarColourClass(this.rating()));

  /** Colour of the stars that are not filled. */
  readonly emptyStarColourClass = EMPTY_STAR_COLOUR_CLASS;
}
