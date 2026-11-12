import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import TranslateDirective from '../../../language/translate.directive';

import { WorkflowStepComponent } from './workflow-step/workflow-step.component';

@Component({
  selector: 'jhi-professor-workflow-section',
  standalone: true,
  imports: [WorkflowStepComponent, TranslateModule, TranslateDirective],
  templateUrl: './professor-workflow-section.component.html',
})
export class ProfessorWorkflowSectionComponent {
  readonly translationKey = 'professorLandingPage.workflow.steps';

  steps = [
    {
      icon: 'create-job',
      title: `${this.translationKey}.1.title`,
      description: `${this.translationKey}.1.description`,
    },
    {
      icon: 'application-overview',
      title: `${this.translationKey}.2.title`,
      description: `${this.translationKey}.2.description`,
    },
    {
      icon: 'review-applications',
      title: `${this.translationKey}.3.title`,
      description: `${this.translationKey}.3.description`,
    },
    {
      icon: 'calendar',
      title: `${this.translationKey}.4.title`,
      description: `${this.translationKey}.4.description`,
    },
  ];
}
