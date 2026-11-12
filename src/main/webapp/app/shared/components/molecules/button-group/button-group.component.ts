import { Component, input } from '@angular/core';

import { Button, ButtonComponent } from '../../atoms/button/button.component';

export type ButtonGroupDirection = 'vertical' | 'horizontal';

/**
 * Defines the data structure for a group of buttons.
 *
 * @property direction - Layout direction of the button group:
 * - `'vertical'`: Buttons are stacked vertically.
 * - `'horizontal'`: Buttons are aligned side by side.
 *
 * @property buttons - Array of `Button` objects to render.
 */
export type ButtonGroupData = {
  direction: ButtonGroupDirection;
  fullWidth?: boolean;
  buttons: Button[];
};

/**
 * A UI component that displays a group of buttons arranged
 * vertically or horizontally based on the provided input data.
 */
@Component({
  selector: 'jhi-button-group',
  imports: [ButtonComponent],
  templateUrl: './button-group.component.html',
  standalone: true,
})
export default class ButtonGroupComponent {
  data = input.required<ButtonGroupData>();
  shouldTranslate = input<boolean>(false);
}
