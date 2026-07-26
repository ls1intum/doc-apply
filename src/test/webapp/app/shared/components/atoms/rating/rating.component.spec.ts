import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideTranslateMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { RatingComponent } from 'app/shared/components/atoms/rating/rating.component';

describe('RatingComponent', () => {
  let fixture: ComponentFixture<RatingComponent>;
  let component: RatingComponent;

  const starButtons = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('button[role="radio"]'));

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

  // ---------------- SELECTION ----------------
  it('should ignore clicks when not selectable', () => {
    fixture.componentRef.setInput('selectable', false);
    fixture.detectChanges();

    component.onStarClick(0);
    expect(component.rating()).toBeUndefined();
  });

  it('should set the rating to the clicked star when selectable', () => {
    fixture.componentRef.setInput('selectable', true);
    fixture.detectChanges();

    component.onStarClick(-2);
    expect(component.rating()).toBe(-2);

    component.onStarClick(2);
    expect(component.rating()).toBe(2);
  });

  it('should clear the rating when the selected star is clicked again', () => {
    fixture.componentRef.setInput('selectable', true);
    fixture.detectChanges();

    component.onStarClick(1);
    expect(component.rating()).toBe(1);

    component.onStarClick(1);
    expect(component.rating()).toBeUndefined();
  });

  // ---------------- STAR FILLING ----------------
  it.each<[number | undefined, number]>([
    [undefined, 0],
    [-2, 1],
    [-1, 2],
    [0, 3],
    [1, 4],
    [2, 5],
  ])('should fill %s stars for rating %s', (rating, expectedFilled) => {
    fixture.componentRef.setInput('rating', rating);
    fixture.detectChanges();

    expect(component.stars().filter(star => star.filled)).toHaveLength(expectedFilled);
  });

  it('should mark only the exact rating as the checked radio', () => {
    fixture.componentRef.setInput('selectable', true);
    fixture.componentRef.setInput('rating', 0);
    fixture.detectChanges();

    const checked = component.stars().filter(star => star.selected);
    expect(checked).toHaveLength(1);
    expect(checked[0].value).toBe(0);
  });

  // ---------------- LABEL ----------------
  it('should show the label of the chosen rating', () => {
    fixture.componentRef.setInput('rating', 2);
    fixture.detectChanges();

    expect(component.selectedLabel()).toBe('evaluation.ratings.very_good');
  });

  it('should show no label while the rating is unset', () => {
    expect(component.selectedLabel()).toBe('');
  });

  // ---------------- KEYBOARD ----------------
  it('should raise the rating with the right arrow key', () => {
    fixture.componentRef.setInput('selectable', true);
    fixture.componentRef.setInput('rating', 0);
    fixture.detectChanges();

    pressKey('ArrowRight');
    expect(component.rating()).toBe(1);
  });

  it('should lower the rating with the left arrow key', () => {
    fixture.componentRef.setInput('selectable', true);
    fixture.componentRef.setInput('rating', 0);
    fixture.detectChanges();

    pressKey('ArrowLeft');
    expect(component.rating()).toBe(-1);
  });

  it.each<[string, number]>([
    ['Home', -2],
    ['End', 2],
  ])('should jump to the end of the scale on %s', (key, expected) => {
    fixture.componentRef.setInput('selectable', true);
    fixture.componentRef.setInput('rating', 0);
    fixture.detectChanges();

    pressKey(key);
    expect(component.rating()).toBe(expected);
  });

  it('should stay at the top of the scale when arrowing past it', () => {
    fixture.componentRef.setInput('selectable', true);
    fixture.componentRef.setInput('rating', 2);
    fixture.detectChanges();

    pressKey('ArrowRight');
    expect(component.rating()).toBe(2);
  });

  it('should ignore arrow keys when not selectable', () => {
    fixture.componentRef.setInput('selectable', true);
    fixture.componentRef.setInput('rating', 0);
    fixture.detectChanges();
    fixture.componentRef.setInput('selectable', false);
    fixture.detectChanges();

    component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(component.rating()).toBe(0);
  });

  // ---------------- TAB STOPS ----------------
  it('should expose a single tab stop for the whole row', () => {
    fixture.componentRef.setInput('selectable', true);
    fixture.componentRef.setInput('rating', 1);
    fixture.detectChanges();

    const tabbable = starButtons().filter(button => button.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
  });

  // ---------------- READ-ONLY ----------------
  it('should render stars without radio buttons when not selectable', () => {
    fixture.componentRef.setInput('selectable', false);
    fixture.componentRef.setInput('rating', 1);
    fixture.detectChanges();

    expect(starButtons()).toHaveLength(0);
    expect(component.stars().filter(star => star.filled)).toHaveLength(4);
  });
});
