import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AiScoreRingComponent } from 'app/shared/components/atoms/ai-score-ring/ai-score-ring.component';

describe('AiScoreRingComponent', () => {
  let fixture: ComponentFixture<AiScoreRingComponent>;
  let component: AiScoreRingComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiScoreRingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AiScoreRingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it.each([
    ['value above upper bound', 150, 100],
    ['value below lower bound', -12, 0],
  ])('should clamp score when %s', (_caseLabel, inputScore, expectedBoundedScore) => {
    fixture.componentRef.setInput('score', inputScore);
    fixture.detectChanges();

    expect(component.boundedScore()).toBe(expectedBoundedScore);
  });

  it.each([
    ['danger range', () => 10, 'var(--color-negative-default)'],
    ['warning threshold', (cmp: AiScoreRingComponent) => cmp.WARNING_THRESHOLD, 'var(--color-warning-default)'],
    ['primary range', (cmp: AiScoreRingComponent) => cmp.WARNING_THRESHOLD + 1, 'var(--color-primary-default)'],
  ])('should map animated score to %s color', (_caseLabel, getAnimatedScore, expectedColor) => {
    component.animatedScore.set(getAnimatedScore(component));

    expect(component.scoreColor()).toBe(expectedColor);
  });

  it.each([
    ['0%', 0, (cmp: AiScoreRingComponent) => cmp.NORMALIZED_PATH_LENGTH],
    ['100%', 100, () => 0],
    ['50%', 50, (cmp: AiScoreRingComponent) => cmp.NORMALIZED_PATH_LENGTH / 2],
  ])('should calculate stroke offset for %s score', (_caseLabel, animatedScore, getExpectedOffset) => {
    component.animatedScore.set(animatedScore);

    expect(component.strokeOffset()).toBeCloseTo(getExpectedOffset(component), 5);
  });

  it('should show the loading state instead of the previous score while a new one is calculated', () => {
    fixture.componentRef.setInput('score', 80);
    fixture.componentRef.setInput('isLoading', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('...');
    expect(fixture.nativeElement.textContent).not.toContain('80');
    expect(component.strokeOffset()).toBe(component.NORMALIZED_PATH_LENGTH);
    expect(component.scoreColor()).toBe('var(--color-text-tertiary)');
  });
});
