import { Component, ViewEncapsulation, input, output } from '@angular/core';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';

@Component({
  selector: 'jhi-month-navigation',
  imports: [ButtonComponent],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './month-navigation.component.html',
})
export class MonthNavigationComponent {
  currentMonth = input.required<string>();
  isClosed = input<boolean>(false);

  previousMonth = output();
  nextMonth = output();
  addSlots = output();
}
