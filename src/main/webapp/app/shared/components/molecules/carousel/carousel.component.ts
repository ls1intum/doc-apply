import { Component, TemplateRef, contentChild, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Carousel } from 'primeng/carousel';

/**
 * Shows one item at a time and moves on to the next by itself, with dots to pick an item. Each item renders
 * through the `#item` template, which receives the item as its implicit value.
 */
@Component({
  selector: 'jhi-carousel',
  standalone: true,
  imports: [Carousel, NgTemplateOutlet],
  templateUrl: './carousel.component.html',
  host: { class: 'block' },
})
export class CarouselComponent<T> {
  items = input.required<T[]>();
  /** Milliseconds before moving on to the next item. */
  autoplayInterval = input<number>(8000);

  itemTemplate = contentChild.required<TemplateRef<{ $implicit: T }>>('item');
}
