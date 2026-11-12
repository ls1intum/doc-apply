import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TumAetUiToggleSwitchComponent } from '@tumaet/ui-angular';

@Component({
  selector: 'jhi-toggle-switch',
  standalone: true,
  templateUrl: './toggle-switch.component.html',
  imports: [TumAetUiToggleSwitchComponent, FormsModule],
})
export class ToggleSwitchComponent {
  /**
   * Current on/off state of the toggle.
   */
  model = input<boolean>(false);

  /**
   * Emits whenever the toggle value changes.
   */
  modelChange = output<boolean>();

  /**
   * Whether the toggle is disabled.
   */
  disabled = input<boolean>(false);

  /**
   * Optional classes added to the switch.
   */
  classStyling = input<string>('');

  /**
   * Tells the parent about a toggle made by the user.
   *
   * @param value the new on/off state
   */
  onChange(value: boolean): void {
    this.modelChange.emit(value);
  }
}
