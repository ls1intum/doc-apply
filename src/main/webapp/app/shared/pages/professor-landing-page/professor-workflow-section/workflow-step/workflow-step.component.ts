import { Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

import { ButtonComponent } from '../../../../components/atoms/button/button.component';

@Component({
  selector: 'jhi-workflow-step',
  imports: [FontAwesomeModule, TranslateModule, ButtonComponent],
  templateUrl: './workflow-step.component.html',
})
export class WorkflowStepComponent {
  icon = input<string>('file-pen');
  title = input<string>('');
  description = input<string>('');
}
