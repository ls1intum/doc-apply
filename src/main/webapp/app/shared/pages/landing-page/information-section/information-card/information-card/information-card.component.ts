import { Component, input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'jhi-information-card',
  imports: [FontAwesomeModule],
  templateUrl: './information-card.component.html',
})
export class InformationCardComponent {
  imageSrc = input<string>('');
  text = input<string>('');
  link = input<string>('');

  readonly faArrowUpRightFromSquare = faArrowUpRightFromSquare;
}
