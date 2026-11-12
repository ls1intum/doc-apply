import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, expect, it } from 'vitest';
import { CarouselComponent } from 'app/shared/components/molecules/carousel/carousel.component';

@Component({
  imports: [CarouselComponent],
  template: `
    <jhi-carousel [items]="slides">
      <ng-template #item let-slide>
        <span class="test-slide">{{ slide }}</span>
      </ng-template>
    </jhi-carousel>
  `,
})
class CarouselHostComponent {
  readonly slides = ['first', 'second'];
}

describe('CarouselComponent', () => {
  it('should render each item through the item template', () => {
    TestBed.configureTestingModule({ imports: [CarouselHostComponent], providers: [provideNoopAnimations()] });
    const fixture = TestBed.createComponent(CarouselHostComponent);
    fixture.detectChanges();

    const slides = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.test-slide')).map(slide => slide.textContent);

    expect(slides).toEqual(expect.arrayContaining(['first', 'second']));
  });
});
