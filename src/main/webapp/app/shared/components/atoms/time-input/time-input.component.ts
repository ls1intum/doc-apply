import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputMaskModule } from 'primeng/inputmask';

@Component({
  selector: 'jhi-time-input',
  templateUrl: './time-input.component.html',
  standalone: true,
  imports: [FormsModule, InputMaskModule],
})
export class TimeInputComponent {
  id = input<string>('');
  value = input<string>('');
  disabled = input<boolean>(false);
  classStyling = input<string>('');

  valueChange = output<string>();

  onValueChange(newValue: string): void {
    this.valueChange.emit(newValue);
  }
}
