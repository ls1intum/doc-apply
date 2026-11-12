import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, TemplateRef, afterNextRender, inject, input, signal, viewChild } from '@angular/core';

@Component({
  selector: 'jhi-sticky-footer-shell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sticky-footer-shell.component.html',
})
export class StickyFooterShellComponent {
  leftTemplate = input<TemplateRef<unknown> | undefined>(undefined);
  rightTemplate = input<TemplateRef<unknown> | undefined>(undefined);
  statusTemplate = input<TemplateRef<unknown> | undefined>(undefined);

  isAtBottom = signal(false);
  bottomSentinel = viewChild<ElementRef<HTMLDivElement>>('bottomSentinel');

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const sentinel = this.bottomSentinel()?.nativeElement;
      if (!sentinel) {
        return;
      }

      const observer = new IntersectionObserver(
        entries => {
          this.isAtBottom.set(entries[0].isIntersecting);
        },
        { threshold: 0 },
      );

      observer.observe(sentinel);
      this.destroyRef.onDestroy(() => {
        observer.disconnect();
      });
    });
  }
}
