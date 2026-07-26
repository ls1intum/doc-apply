import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideTranslateMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { StarRatingComponent } from 'app/shared/components/atoms/star-rating/star-rating.component';

describe('StarRatingComponent', () => {
  let fixture: ComponentFixture<StarRatingComponent>;
  let component: StarRatingComponent;

  const setRating = (rating: number | undefined): void => {
    fixture.componentRef.setInput('rating', rating);
    fixture.detectChanges();
  };

  const stars = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('fa-icon'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StarRatingComponent],
      providers: [provideTranslateMock(), provideFontAwesomeTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(StarRatingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ---------------- STAR STATES ----------------
  it.each<[number, number, number]>([
    [1, 1, 0],
    [2, 2, 0],
    [4, 4, 0],
    [5, 5, 0],
    [3.5, 3, 1],
    [2.5, 2, 1],
    [4.9, 4, 1],
  ])('should show %s as %s filled and %s half stars', (rating, expectedFilled, expectedHalf) => {
    setRating(rating);

    expect(component.starStates().filter(star => star.filled)).toHaveLength(expectedFilled);
    expect(component.starStates().filter(star => star.half)).toHaveLength(expectedHalf);
  });

  it('should treat a value just under the half point as empty rather than half', () => {
    setRating(3.4);

    expect(component.starStates().filter(star => star.filled)).toHaveLength(3);
    expect(component.starStates().filter(star => star.half)).toHaveLength(0);
  });

  it('should render neither filled nor half stars while unrated', () => {
    setRating(undefined);

    expect(component.starStates().every(star => !star.filled && !star.half)).toBe(true);
  });

  it('should render as many stars as maxStars asks for', () => {
    fixture.componentRef.setInput('maxStars', 3);
    setRating(2);

    expect(component.starStates()).toHaveLength(3);
    expect(stars()).toHaveLength(3);
  });

  // ---------------- COLOURS ----------------
  it.each<[number, string]>([
    [1, 'text-rating-star-1'],
    [3, 'text-rating-star-3'],
    [5, 'text-rating-star-5'],
  ])('should colour the filled stars for rating %s', (rating, expectedClass) => {
    setRating(rating);

    expect(component.starColourClass()).toBe(expectedClass);
    expect(stars()[0].className).toContain(expectedClass);
  });

  it('should give an average the colour of the nearest whole step', () => {
    setRating(4.0);

    expect(component.starColourClass()).toBe('text-rating-star-4');
  });

  it('should colour the unfilled stars with the shared empty colour', () => {
    setRating(1);

    expect(stars()[4].className).toContain(component.emptyStarColourClass);
  });

  // ---------------- VALUE ----------------
  it('should format the rating to one decimal place', () => {
    setRating(4);

    expect(component.formattedRating()).toBe('4.0');
  });

  it('should have no formatted value while unrated', () => {
    setRating(undefined);

    expect(component.formattedRating()).toBeUndefined();
  });

  it('should show the numeric value by default', () => {
    setRating(4);

    expect(fixture.nativeElement.textContent).toContain('4.0');
  });

  it('should hide the numeric value when showValue is false', () => {
    fixture.componentRef.setInput('showValue', false);
    setRating(4);

    expect(fixture.nativeElement.textContent).not.toContain('4.0');
  });

  // ---------------- EMPTY STATE ----------------
  it('should show the no-ratings message instead of stars while unrated', () => {
    setRating(undefined);

    expect(stars()).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('evaluation.noRatingsYet');
  });

  // ---------------- SIZE ----------------
  it.each<[string, string]>([
    ['small', 'text-sm'],
    ['medium', 'text-base'],
    ['large', 'text-xl'],
  ])('should size the stars for %s', (size, expectedClass) => {
    fixture.componentRef.setInput('size', size);
    setRating(3);

    expect(component.sizeClass()).toBe(expectedClass);
    expect(stars()[0].className).toContain(expectedClass);
  });
});
