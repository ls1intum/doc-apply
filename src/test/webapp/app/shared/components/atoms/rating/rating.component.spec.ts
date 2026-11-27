import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideTranslateMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { RatingComponent } from 'app/shared/components/atoms/rating/rating.component';
import { RecommendationDecision } from 'app/generated/model/recommendation-decision';

describe('RatingComponent', () => {
  let fixture: ComponentFixture<RatingComponent>;
  let component: RatingComponent;

  const starButtons = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('button[role="radio"]'));

  const filledStarCount = (): number =>
    Array.from<Element>(fixture.nativeElement.querySelectorAll('fa-icon')).filter(icon => !icon.classList.contains('text-text-tertiary'))
      .length;

  const render = (selectable: boolean, rating: RecommendationDecision | undefined): void => {
    fixture.componentRef.setInput('selectable', selectable);
    fixture.componentRef.setInput('rating', rating);
    fixture.detectChanges();
  };

  const pressKey = (key: string): void => {
    const focused = starButtons().find(button => button.getAttribute('tabindex') === '0');
    focused?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RatingComponent],
      providers: [provideTranslateMock(), provideFontAwesomeTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(RatingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should offer one star per decision from strong fail to strong pass when selectable', () => {
    render(true, undefined);

    expect(starButtons().map(button => button.getAttribute('aria-label'))).toEqual([
      'evaluation.ratings.STRONG_FAIL',
      'evaluation.ratings.SOFT_FAIL',
      'evaluation.ratings.NEUTRAL',
      'evaluation.ratings.SOFT_PASS',
      'evaluation.ratings.STRONG_PASS',
    ]);
  });

  it('should set the decision of the clicked star and mark only that star as checked', () => {
    render(true, undefined);

    starButtons()[2].click();
    fixture.detectChanges();

    expect(component.rating()).toBe(RecommendationDecision.Neutral);
    expect(starButtons().map(button => button.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true', 'false', 'false']);
  });

  it('should clear the decision when the chosen star is clicked again', () => {
    render(true, RecommendationDecision.StrongPass);

    starButtons()[4].click();

    expect(component.rating()).toBeUndefined();
  });

  it('should ignore clicks, hovering and keys when the decision is only displayed', () => {
    render(false, RecommendationDecision.SoftPass);

    component.onStarClick(RecommendationDecision.StrongFail);
    component.onStarHover(RecommendationDecision.StrongFail);
    component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();

    expect(component.rating()).toBe(RecommendationDecision.SoftPass);
    expect(component.shownLabel()).toBe('evaluation.ratings.SOFT_PASS');
  });

  it('should preview the hovered star and fall back to the chosen decision on leaving', () => {
    render(true, RecommendationDecision.SoftFail);

    starButtons()[4].dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    expect(component.shownLabel()).toBe('evaluation.ratings.STRONG_PASS');
    expect(filledStarCount()).toBe(5);
    expect(component.rating()).toBe(RecommendationDecision.SoftFail);

    component.onHoverLeave();
    fixture.detectChanges();

    expect(component.shownLabel()).toBe('evaluation.ratings.SOFT_FAIL');
    expect(filledStarCount()).toBe(2);
  });

  it.each<[string, RecommendationDecision, RecommendationDecision]>([
    ['ArrowRight', RecommendationDecision.SoftFail, RecommendationDecision.Neutral],
    ['ArrowUp', RecommendationDecision.Neutral, RecommendationDecision.SoftPass],
    ['ArrowLeft', RecommendationDecision.SoftPass, RecommendationDecision.Neutral],
    ['ArrowDown', RecommendationDecision.Neutral, RecommendationDecision.SoftFail],
    ['ArrowRight', RecommendationDecision.StrongPass, RecommendationDecision.StrongPass],
    ['Home', RecommendationDecision.SoftPass, RecommendationDecision.StrongFail],
    ['End', RecommendationDecision.SoftFail, RecommendationDecision.StrongPass],
  ])('should move the decision with %s from %s to %s', (key, start, expected) => {
    render(true, start);

    pressKey(key);

    expect(component.rating()).toBe(expected);
  });

  it.each<[RecommendationDecision | undefined, number, string]>([
    [undefined, 0, 'evaluation.ratings.notRated'],
    [RecommendationDecision.StrongFail, 1, 'evaluation.ratings.STRONG_FAIL'],
    [RecommendationDecision.SoftFail, 2, 'evaluation.ratings.SOFT_FAIL'],
    [RecommendationDecision.Neutral, 3, 'evaluation.ratings.NEUTRAL'],
    [RecommendationDecision.SoftPass, 4, 'evaluation.ratings.SOFT_PASS'],
    [RecommendationDecision.StrongPass, 5, 'evaluation.ratings.STRONG_PASS'],
  ])('should show %s as %s filled stars described as %s when read-only', (rating, filled, label) => {
    render(false, rating);

    expect(starButtons()).toHaveLength(0);
    expect(filledStarCount()).toBe(filled);
    expect(fixture.nativeElement.querySelector('[role="img"]').getAttribute('aria-label')).toBe(label);
  });
});
