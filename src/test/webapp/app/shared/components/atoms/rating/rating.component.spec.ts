import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideTranslateMock } from 'util/translate.mock';
import { RatingComponent } from 'app/shared/components/atoms/rating/rating.component';

describe('RatingComponent', () => {
  let fixture: ComponentFixture<RatingComponent>;
  let component: RatingComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RatingComponent],
      providers: [provideTranslateMock()],
    }).compileComponents();

    fixture = TestBed.createComponent(RatingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ---------------- ON SECTION CLICK ----------------
  it('should do nothing when not selectable', () => {
    fixture.componentRef.setInput('selectable', false);
    fixture.detectChanges();

    component.onSectionClick(2);
    expect(component.rating()).toBeUndefined();
  });

  it('should select and toggle off when selectable', () => {
    fixture.componentRef.setInput('selectable', true);
    fixture.detectChanges();

    component.onSectionClick(0); // -2
    expect(component.rating()).toBe(-2);

    // clicking again toggles off
    component.onSectionClick(0);
    expect(component.rating()).toBeUndefined();
  });

  it('should change rating when selecting different value', () => {
    fixture.componentRef.setInput('selectable', true);
    fixture.detectChanges();

    component.onSectionClick(1);
    expect(component.rating()).toBe(-1);

    component.onSectionClick(4);
    expect(component.rating()).toBe(2);
  });

  // ---------------- BUTTON STATES ----------------
  it.each<[number | undefined, number, string, string | undefined]>([
    [undefined, 0, 'hover:bg-negative-active/15', undefined],
    [-2, 0, 'bg-negative-active', 'text-base-white'],
    [-1, 1, 'bg-negative-hover', 'text-base-white'],
    [0, 2, 'bg-warning-default', 'text-base-black'],
    [1, 3, 'bg-positive-hover', 'text-base-black'],
    [2, 4, 'bg-positive-active', 'text-base-white'],
    [2, 0, 'hover:bg-negative-active/15', undefined],
  ])('should compute classes for rating=%s at index=%i', (rating, index, expectedClass, expectedTextClass) => {
    fixture.componentRef.setInput('rating', rating);
    fixture.detectChanges();
    const classes: string | undefined = component.buttonStates().find((_, i) => i === index)?.classes;
    expect(classes).toContain(expectedClass);
    if (expectedTextClass !== undefined) {
      expect(classes).toContain(expectedTextClass);
    } else {
      expect(classes).not.toContain('text-base-');
    }
  });

  // ---------------- SELECTED BADGE ----------------
  it.each<[number | undefined, string | undefined]>([
    [undefined, undefined],
    [-2, 'evaluation.ratings.very_bad'],
    [-1, 'evaluation.ratings.bad'],
    [0, 'evaluation.ratings.neutral'],
    [1, 'evaluation.ratings.good'],
    [2, 'evaluation.ratings.very_good'],
  ])('should return selectedBadge label %s when rating=%s', (rating, expected) => {
    fixture.componentRef.setInput('rating', rating);
    fixture.detectChanges();
    expect(component.selectedBadge()?.label).toBe(expected);
  });
});
