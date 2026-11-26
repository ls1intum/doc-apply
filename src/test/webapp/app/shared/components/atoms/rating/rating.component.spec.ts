import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideTranslateMock } from 'util/translate.mock';
import { RatingComponent } from 'app/shared/components/atoms/rating/rating.component';
import { RecommendationDecision } from 'app/generated/model/recommendation-decision';

describe('RatingComponent', () => {
  let fixture: ComponentFixture<RatingComponent>;
  let component: RatingComponent;

  const segmentButtons = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('button[role="radio"]'));

  const render = (selectable: boolean, rating: RecommendationDecision | undefined): void => {
    fixture.componentRef.setInput('selectable', selectable);
    fixture.componentRef.setInput('rating', rating);
    fixture.detectChanges();
  };

  const pressKey = (key: string): void => {
    const focused = segmentButtons().find(button => button.getAttribute('tabindex') === '0');
    focused?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RatingComponent],
      providers: [provideTranslateMock()],
    }).compileComponents();

    fixture = TestBed.createComponent(RatingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should offer the four decisions from strong fail to strong pass when selectable', () => {
    render(true, undefined);

    expect(segmentButtons().map(button => (button.textContent ?? '').trim())).toEqual([
      'evaluation.ratings.STRONG_FAIL',
      'evaluation.ratings.SOFT_FAIL',
      'evaluation.ratings.SOFT_PASS',
      'evaluation.ratings.STRONG_PASS',
    ]);
  });

  it('should set the decision of the clicked option and mark it as checked', () => {
    render(true, undefined);

    segmentButtons()[1].click();
    fixture.detectChanges();

    expect(component.rating()).toBe(RecommendationDecision.SoftFail);
    expect(segmentButtons().map(button => button.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false']);
  });

  it('should clear the decision when the chosen option is clicked again', () => {
    render(true, RecommendationDecision.StrongPass);

    segmentButtons()[3].click();

    expect(component.rating()).toBeUndefined();
  });

  it('should ignore selection when the decision is only displayed', () => {
    render(false, RecommendationDecision.SoftPass);

    component.onSelect(RecommendationDecision.StrongFail);
    component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));

    expect(component.rating()).toBe(RecommendationDecision.SoftPass);
  });

  it.each<[string, RecommendationDecision, RecommendationDecision]>([
    ['ArrowRight', RecommendationDecision.SoftFail, RecommendationDecision.SoftPass],
    ['ArrowLeft', RecommendationDecision.SoftPass, RecommendationDecision.SoftFail],
    ['ArrowRight', RecommendationDecision.StrongPass, RecommendationDecision.StrongPass],
    ['Home', RecommendationDecision.SoftPass, RecommendationDecision.StrongFail],
    ['End', RecommendationDecision.SoftFail, RecommendationDecision.StrongPass],
  ])('should move the decision with %s from %s to %s', (key, start, expected) => {
    render(true, start);

    pressKey(key);

    expect(component.rating()).toBe(expected);
  });

  it('should show the label of the decision without options when read-only', () => {
    render(false, RecommendationDecision.StrongFail);

    expect(segmentButtons()).toHaveLength(0);
    expect(fixture.nativeElement.textContent.trim()).toBe('evaluation.ratings.STRONG_FAIL');
  });

  it('should say that nobody has decided yet when read-only without a decision', () => {
    render(false, undefined);

    expect(fixture.nativeElement.textContent.trim()).toBe('evaluation.ratings.notRated');
  });
});
