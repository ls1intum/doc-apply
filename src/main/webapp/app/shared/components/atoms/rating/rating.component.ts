import { Component, computed, inject, input, model } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';

type LikertValue = -2 | -1 | 0 | 1 | 2;

interface LikertEntry {
  value: LikertValue;
  key: string;
}

interface VariantClasses {
  bg: string;
  hoverBg: string;
  textOn: string;
}

/**
 * The rating scale uses its own fills rather than the default/hover/active triad, because those are
 * dark enough that a black label fails on them and a white label fails on the yellow. The lighter
 * scale below carries a black label on every step at 5.68:1 or better, so the label stays one colour
 * across the whole row and does not have to flip with the colour scheme.
 */
const VARIANT_CLASSES: Record<LikertValue, VariantClasses> = {
  [-2]: { bg: 'bg-rating-very-negative', hoverBg: 'hover:bg-rating-very-negative/15', textOn: 'text-base-black' },
  [-1]: { bg: 'bg-rating-negative', hoverBg: 'hover:bg-rating-negative/15', textOn: 'text-base-black' },
  [0]: { bg: 'bg-rating-neutral', hoverBg: 'hover:bg-rating-neutral/15', textOn: 'text-base-black' },
  [1]: { bg: 'bg-rating-positive', hoverBg: 'hover:bg-rating-positive/15', textOn: 'text-base-black' },
  [2]: { bg: 'bg-rating-very-positive', hoverBg: 'hover:bg-rating-very-positive/15', textOn: 'text-base-black' },
};

@Component({
  selector: 'jhi-rating',
  templateUrl: './rating.component.html',
})
export class RatingComponent {
  rating = model<number | undefined>(undefined);
  selectable = input<boolean>(false);

  readonly likertScale: LikertEntry[] = [
    { value: -2, key: 'very_bad' },
    { value: -1, key: 'bad' },
    { value: 0, key: 'neutral' },
    { value: 1, key: 'good' },
    { value: 2, key: 'very_good' },
  ];

  readonly buttonStates = computed(() => {
    this.langChange();
    const currentRating = this.rating();

    return this.likertScale.map((entry, index) => {
      const label: string = this.translateService.instant(`evaluation.ratings.${entry.key}`);
      const isSelected = currentRating === entry.value;
      const variant = VARIANT_CLASSES[entry.value];
      const classes: string = isSelected ? `${variant.bg} ${variant.textOn}` : variant.hoverBg;

      return { entry, index, label, classes };
    });
  });

  readonly selectedBadge = computed(() => {
    this.langChange();
    const r = this.rating();
    if (r === undefined) return undefined;
    const entry = this.likertScale.find(s => s.value === r);
    if (entry === undefined) return undefined;
    const label: string = this.translateService.instant(`evaluation.ratings.${entry.key}`);
    const variant = VARIANT_CLASSES[entry.value];
    return { classes: `${variant.bg} ${variant.textOn}`, label };
  });

  private translateService = inject(TranslateService);
  private langChange = toSignal(this.translateService.onLangChange, { initialValue: undefined });

  onSectionClick(index: number): void {
    if (!this.selectable()) return;
    const entry = this.likertScale.find((_, i) => i === index);
    if (entry === undefined) return;
    this.rating.set(this.rating() === entry.value ? undefined : entry.value);
  }
}
