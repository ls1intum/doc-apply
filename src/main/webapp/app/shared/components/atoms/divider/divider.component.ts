import { Component, computed, input } from '@angular/core';

const HORIZONTAL_CLASSES =
  'relative flex w-full items-center my-4 px-4 before:absolute before:top-1/2 before:left-0 before:w-full before:border-t before:border-divider-default';
const VERTICAL_CLASSES =
  'relative flex min-h-full items-center justify-center mx-4 py-2 before:absolute before:top-0 before:left-1/2 before:h-full before:border-l before:border-divider-default';
const ALIGN_CLASSES = { left: 'justify-start', center: 'justify-center', right: 'justify-end' };

@Component({
  selector: 'jhi-divider',
  template: '<div class="z-1 bg-background-default text-text-primary" [class]="contentClasses()"><ng-content /></div>',
  host: {
    role: 'separator',
    '[attr.aria-orientation]': 'layout()',
    '[class]': 'hostClasses()',
  },
})
export class DividerComponent {
  /**
   * Whether the line runs across the content or beside it.
   */
  layout = input<'horizontal' | 'vertical'>('horizontal');

  /**
   * Where projected content sits on a horizontal divider.
   */
  align = input<'left' | 'center' | 'right'>('center');

  readonly hostClasses = computed(() =>
    this.layout() === 'horizontal' ? `${HORIZONTAL_CLASSES} ${ALIGN_CLASSES[this.align()]}` : VERTICAL_CLASSES,
  );

  readonly contentClasses = computed(() => (this.layout() === 'horizontal' ? 'px-2' : 'py-2'));
}
