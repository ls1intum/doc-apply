import { Component, ElementRef, computed, inject, input, model, viewChildren } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

type LikertValue = -2 | -1 | 0 | 1 | 2;

interface LikertEntry {
  value: LikertValue;
  key: string;
}

interface Star {
  /** The stored Likert value this star stands for. */
  value: LikertValue;
  /** Filled once the current rating reaches at least this star. */
  filled: boolean;
  /** Only the exact rating is the checked radio; the stars below it are filled but not checked. */
  selected: boolean;
  /** Roving tabindex, so the row takes one tab stop rather than one per star. */
  tabbable: boolean;
  label: string;
}

@Component({
  selector: 'jhi-rating',
  imports: [FontAwesomeModule],
  templateUrl: './rating.component.html',
})
export class RatingComponent {
  rating = model<number | undefined>(undefined);
  selectable = input<boolean>(false);

  /**
   * The stored scale runs from -2 to +2 and is shown as one to five stars. The mapping is display
   * only, so nothing outside this component changes.
   */
  readonly likertScale: LikertEntry[] = [
    { value: -2, key: 'very_bad' },
    { value: -1, key: 'bad' },
    { value: 0, key: 'neutral' },
    { value: 1, key: 'good' },
    { value: 2, key: 'very_good' },
  ];

  readonly stars = computed<Star[]>(() => {
    this.langChange();
    const current = this.rating();
    const focused = this.focusedValue();

    return this.likertScale.map(entry => ({
      value: entry.value,
      filled: current !== undefined && current >= entry.value,
      selected: current === entry.value,
      tabbable: entry.value === focused,
      label: this.translateService.instant(`evaluation.ratings.${entry.key}`),
    }));
  });

  /** The word for the current rating, empty while nothing is chosen. */
  readonly selectedLabel = computed<string>(() => {
    this.langChange();
    const entry = this.likertScale.find(candidate => candidate.value === this.rating());
    return entry === undefined ? '' : this.translateService.instant(`evaluation.ratings.${entry.key}`);
  });

  readonly groupLabel = computed<string>(() => {
    this.langChange();
    return this.translateService.instant('evaluation.ratings.groupLabel');
  });

  /** Describes the row for assistive technology when the rating is only being displayed. */
  readonly readonlyLabel = computed<string>(() => {
    this.langChange();
    const label = this.selectedLabel();
    return label === '' ? this.translateService.instant('evaluation.ratings.notRated') : label;
  });

  private readonly starButtons = viewChildren<ElementRef<HTMLButtonElement>>('starButton');
  private readonly translateService = inject(TranslateService);
  private readonly langChange = toSignal(this.translateService.onLangChange, { initialValue: undefined });

  /** Which star owns the row's single tab stop: the chosen one, or the first while unrated. */
  private readonly focusedValue = computed<LikertValue>(() => {
    const entry = this.likertScale.find(candidate => candidate.value === this.rating());
    return entry === undefined ? this.likertScale[0].value : entry.value;
  });

  /**
   * Sets the rating, or clears it when the same star is picked again so that "not rated yet" stays
   * reachable.
   *
   * @param value the Likert value of the clicked star
   */
  onStarClick(value: LikertValue): void {
    if (!this.selectable()) {
      return;
    }
    this.rating.set(this.rating() === value ? undefined : value);
  }

  /**
   * Moves the rating with the arrow keys as a radio group is expected to, with Home and End jumping
   * to the ends of the scale.
   *
   * @param event the keyboard event raised on the group
   */
  onKeydown(event: KeyboardEvent): void {
    if (!this.selectable()) {
      return;
    }
    const values = this.likertScale.map(entry => entry.value);
    const currentIndex = values.indexOf(this.focusedValue());
    let nextIndex: number;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        nextIndex = Math.min(currentIndex + 1, values.length - 1);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        nextIndex = Math.max(currentIndex - 1, 0);
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = values.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.rating.set(values[nextIndex]);
    this.starButtons()[nextIndex]?.nativeElement.focus();
  }
}
