import { Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import TranslateDirective from 'app/shared/language/translate.directive';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';

@Component({
  selector: 'jhi-application-step',
  imports: [FontAwesomeModule, TranslateModule, ButtonComponent, TranslateDirective],
  templateUrl: './application-step.component.html',
})
export class ApplicationStepComponent {
  icon = input<string>('search');
  title = input<string>('');
  description = input<string>('');
  index = input<number>(0);
}
