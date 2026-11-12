import { Component, DestroyRef, ElementRef, TemplateRef, computed, contentChild, effect, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Shows one item at a time and moves on to the next by itself, with dots to pick an item. Each item renders
 * through the `#item` template, which receives the item as its implicit value. Autoplay stops while the
 * pointer or focus is inside, and never runs for readers who prefer reduced motion.
 */
@Component({
  selector: 'jhi-carousel',
  standalone: true,
  imports: [NgTemplateOutlet, TranslateModule],
  templateUrl: './carousel.component.html',
  host: { class: 'block' },
})
export class CarouselComponent<T> {
  items = input.required<T[]>();
  /** Milliseconds before moving on to the next item. */
  autoplayInterval = input<number>(8000);

  itemTemplate = contentChild.required<TemplateRef<{ $implicit: T }>>('item');

  protected readonly hovered = signal(false);
  protected readonly focused = signal(false);

  /** The visible item, kept in range when the list of items shrinks. */
  protected readonly currentIndex = computed(() => {
    const count = this.items().length;
    return count === 0 ? 0 : this.activeIndex() % count;
  });

  protected readonly trackTransform = computed(() => `translateX(-${this.currentIndex() * 100}%)`);

  private readonly activeIndex = signal(0);
  private readonly reducedMotion = signal(false);
  private readonly hostElement: HTMLElement = inject(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.watchReducedMotion();

    effect(onCleanup => {
      const count = this.items().length;
      const interval = this.autoplayInterval();
      if (count < 2 || interval <= 0 || this.hovered() || this.focused() || this.reducedMotion()) {
        return;
      }
      const timer = setInterval(() => this.activeIndex.update(index => (index + 1) % count), interval);
      onCleanup(() => clearInterval(timer));
    });
  }

  /**
   * Shows the item the reader picked.
   *
   * @param index the position of the item
   */
  protected goTo(index: number): void {
    this.activeIndex.set(index);
  }

  /**
   * Resumes autoplay once focus has left the carousel, not when it only moves between its dots.
   *
   * @param event the focus event of the element losing focus
   */
  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !this.hostElement.contains(next)) {
      this.focused.set(false);
    }
  }

  /**
   * Follows the reader's reduced-motion preference, also when it changes while the page is open.
   */
  private watchReducedMotion(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    this.reducedMotion.set(query.matches);
    const listener = (event: MediaQueryListEvent): void => this.reducedMotion.set(event.matches);
    query.addEventListener('change', listener);
    this.destroyRef.onDestroy(() => query.removeEventListener('change', listener));
  }
}
