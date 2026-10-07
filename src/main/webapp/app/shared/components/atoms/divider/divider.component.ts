import { Component, input } from '@angular/core';

@Component({
  selector: 'jhi-divider',
  standalone: true,
  template: '<div class="divider-content"><ng-content /></div>',
  styleUrl: './divider.component.scss',
  host: {
    role: 'separator',
    '[attr.aria-orientation]': 'layout()',
    '[class.divider-horizontal]': "layout() === 'horizontal'",
    '[class.divider-vertical]': "layout() === 'vertical'",
    '[class.divider-align-center]': "align() === 'center'",
    '[class.divider-align-right]': "align() === 'right'",
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
  align = input<'left' | 'center' | 'right'>('left');
}
