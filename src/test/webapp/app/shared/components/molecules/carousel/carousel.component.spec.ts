import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CarouselComponent } from 'app/shared/components/molecules/carousel/carousel.component';
import { provideTranslateMock } from 'util/translate.mock';

@Component({
  imports: [CarouselComponent],
  template: `
    <jhi-carousel [items]="slides" [autoplayInterval]="1000">
      <ng-template #item let-slide>
        <span class="test-slide">{{ slide }}</span>
      </ng-template>
    </jhi-carousel>
  `,
})
class CarouselHostComponent {
  readonly slides = ['first', 'second', 'third'];
}

describe('CarouselComponent', () => {
  let fixture: ComponentFixture<CarouselHostComponent>;
  let element: HTMLElement;

  const dots = (): HTMLButtonElement[] => Array.from(element.querySelectorAll<HTMLButtonElement>('button'));
  const currentDot = (): number => dots().findIndex(dot => dot.getAttribute('aria-current') === 'true');

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ imports: [CarouselHostComponent], providers: [provideTranslateMock()] });
    fixture = TestBed.createComponent(CarouselHostComponent);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should render each item through the item template', () => {
    const slides = Array.from(element.querySelectorAll('.test-slide')).map(slide => slide.textContent);

    expect(slides).toEqual(['first', 'second', 'third']);
  });

  it('should render one labelled dot per item and mark the first as current', () => {
    expect(dots().map(dot => dot.getAttribute('aria-label'))).toEqual([
      'global.carousel.goTo',
      'global.carousel.goTo',
      'global.carousel.goTo',
    ]);
    expect(currentDot()).toBe(0);
  });

  it('should move on to the next item after the interval and wrap around after the last', () => {
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(currentDot()).toBe(1);

    vi.advanceTimersByTime(2000);
    fixture.detectChanges();
    expect(currentDot()).toBe(0);
  });

  it('should show the item whose dot is clicked', () => {
    dots()[2].click();
    fixture.detectChanges();

    expect(currentDot()).toBe(2);
  });

  it('should pause while the pointer is inside', () => {
    const region = element.querySelector<HTMLElement>('[role="region"]');
    region?.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    vi.advanceTimersByTime(3000);
    fixture.detectChanges();
    expect(currentDot()).toBe(0);

    region?.dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(currentDot()).toBe(1);
  });

  it('should not move on by itself for readers who prefer reduced motion', () => {
    vi.stubGlobal(
      'matchMedia',
      vi
        .fn()
        .mockImplementation((query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    const reducedFixture = TestBed.createComponent(CarouselHostComponent);
    reducedFixture.detectChanges();

    vi.advanceTimersByTime(3000);
    reducedFixture.detectChanges();

    const reducedDots = Array.from((reducedFixture.nativeElement as HTMLElement).querySelectorAll('button'));
    expect(reducedDots.findIndex(dot => dot.getAttribute('aria-current') === 'true')).toBe(0);
  });
});
