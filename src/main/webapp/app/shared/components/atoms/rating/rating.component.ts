import { Component, ElementRef, computed, inject, input, model, signal, viewChildren } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { RecommendationDecision } from 'app/generated/model/recommendation-decision';
import { RECOMMENDATION_DECISION_OPTIONS, RecommendationDecisionOption } from 'app/shared/constants/recommendation-decisions';

/**
 * One star of the row, with the state the template needs to render it.
 * A star is filled once the shown decision reaches it, but only the star of the chosen decision is the checked radio.
 * Only one star is tabbable, so the row takes a single tab stop.
 */
interface Star {
  value: RecommendationDecision;
  selected: boolean;
  tabbable: boolean;
  iconClass: string;
  label: string;
}

const EMPTY_STAR_COLOUR_CLASS = 'text-text-tertiary';

/**
 * Shows a recommendation decision as one to five stars, from strong fail to strong pass, with the decision's label beside them.
 * When selectable the stars set the decision and preview the label of the hovered or focused star.
 */
@Component({
  selector: 'jhi-rating',
  imports: [FontAwesomeModule],
  templateUrl: './rating.component.html',
})
export class RatingComponent {
  rating = model<RecommendationDecision | undefined>(undefined);
  selectable = input<boolean>(false);

  readonly stars = computed<Star[]>(() => {
    this.langChange();
    const shownOption = this.shownOption();
    const filledCount = shownOption === undefined ? 0 : RECOMMENDATION_DECISION_OPTIONS.indexOf(shownOption) + 1;
    const filledColourClass = shownOption?.starColourClass ?? EMPTY_STAR_COLOUR_CLASS;
    const sizeClass = this.selectable() ? 'text-lg transition-colors' : 'text-base';
    const focused = this.focusedValue();

    return RECOMMENDATION_DECISION_OPTIONS.map((option, index) => ({
      value: option.value,
      selected: this.rating() === option.value,
      tabbable: option.value === focused,
      iconClass: `${sizeClass} ${index < filledCount ? filledColourClass : EMPTY_STAR_COLOUR_CLASS}`,
      label: this.translateService.instant(option.labelKey),
    }));
  });

  /**
   * The label of the decision being shown, so it fills in while hovering and returns to the chosen decision on leaving.
   * Empty while nothing is chosen or hovered.
   */
  readonly shownLabel = computed<string>(() => {
    this.langChange();
    const option = this.shownOption();
    return option === undefined ? '' : this.translateService.instant(option.labelKey);
  });

  readonly groupLabel = computed<string>(() => {
    this.langChange();
    return this.translateService.instant('evaluation.ratings.groupLabel');
  });

  /**
   * Describes the row for assistive technology when the decision is only being displayed.
   */
  readonly readonlyLabel = computed<string>(() => {
    this.langChange();
    const label = this.shownLabel();
    return label === '' ? this.translateService.instant('evaluation.ratings.notRated') : label;
  });

  private readonly hoveredValue = signal<RecommendationDecision | undefined>(undefined);
  private readonly starButtons = viewChildren<ElementRef<HTMLButtonElement>>('starButton');
  private readonly translateService = inject(TranslateService);
  private readonly langChange = toSignal(this.translateService.onLangChange, { initialValue: undefined });

  /**
   * The hovered decision wins over the chosen one, so the row previews what a click would give.
   */
  private readonly shownOption = computed<RecommendationDecisionOption | undefined>(() => {
    const shown = this.hoveredValue() ?? this.rating();
    return RECOMMENDATION_DECISION_OPTIONS.find(option => option.value === shown);
  });

  /**
   * Which star owns the row's single tab stop: the chosen one, or the first while nothing is chosen.
   */
  private readonly focusedValue = computed<RecommendationDecision>(() => this.rating() ?? RECOMMENDATION_DECISION_OPTIONS[0].value);

  /**
   * Sets the decision, or clears it when the same star is picked again so that "no recommendation yet" stays reachable.
   *
   * @param value the decision of the clicked star
   */
  onStarClick(value: RecommendationDecision): void {
    if (!this.selectable()) {
      return;
    }
    this.rating.set(this.rating() === value ? undefined : value);
  }

  /**
   * Previews the decision under the pointer or focus without changing the chosen one.
   *
   * @param value the decision of the hovered or focused star
   */
  onStarHover(value: RecommendationDecision): void {
    if (!this.selectable()) {
      return;
    }
    this.hoveredValue.set(value);
  }

  /**
   * Drops the preview so the row falls back to the chosen decision.
   */
  onHoverLeave(): void {
    this.hoveredValue.set(undefined);
  }

  /**
   * Moves the decision with the arrow keys as a radio group is expected to, with Home and End jumping to the ends of the scale.
   *
   * @param event the keyboard event raised on a star
   */
  onKeydown(event: KeyboardEvent): void {
    if (!this.selectable()) {
      return;
    }
    const values = RECOMMENDATION_DECISION_OPTIONS.map(option => option.value);
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
