import { Component } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { AccordionComponent, AccordionItem } from 'app/shared/components/molecules/accordion/accordion.component';

import TranslateDirective from '../../../language/translate.directive';

@Component({
  selector: 'jhi-faq-section',
  standalone: true,
  imports: [AccordionComponent, TranslateDirective, FontAwesomeModule],
  templateUrl: './faq-section.component.html',
})
export class FaqSectionComponent {
  tabs: AccordionItem[] = [
    {
      value: 'login',
      title: 'landingPage.faq.questions.login.title',
      content: 'landingPage.faq.questions.login.content',
    },
    {
      value: 'multiple-applications',
      title: 'landingPage.faq.questions.multipleApplications.title',
      content: 'landingPage.faq.questions.multipleApplications.content',
    },
    {
      value: 'documents',
      title: 'landingPage.faq.questions.documents.title',
      content: 'landingPage.faq.questions.documents.content',
    },
    {
      value: 'status',
      title: 'landingPage.faq.questions.status.title',
      content: 'landingPage.faq.questions.status.content',
    },
    {
      value: 'otherJobs',
      title: 'landingPage.faq.questions.otherJobs.title',
      content: 'landingPage.faq.questions.otherJobs.content',
    },
  ];

  readonly faArrowUpRightFromSquare = faArrowUpRightFromSquare;
}
