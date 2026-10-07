import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Location } from '@angular/common';

import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'jhi-back-button',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './back-button.component.html',
})
export class BackButtonComponent {
  private location = inject(Location);

  handleBack(): void {
    this.location.back();
  }
}
