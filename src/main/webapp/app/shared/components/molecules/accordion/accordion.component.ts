import { Component, TemplateRef, contentChild, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { AccordionContent, AccordionGroup, AccordionPanel, AccordionTrigger } from '@angular/aria/accordion';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { TranslateModule } from '@ngx-translate/core';
import { TranslateDirective } from 'app/shared/language';

/** One expandable entry of an accordion. */
export interface AccordionItem {
  value: string;
  title: string;
  content: string;
}

/**
 * A list of entries that expand one at a time to show their content; all start collapsed. An optional `#footer`
 * template renders below each entry's content and receives the entry as its implicit value.
 */
@Component({
  selector: 'jhi-accordion',
  standalone: true,
  imports: [
    AccordionGroup,
    AccordionTrigger,
    AccordionPanel,
    AccordionContent,
    FaIconComponent,
    NgTemplateOutlet,
    TranslateDirective,
    TranslateModule,
  ],
  templateUrl: './accordion.component.html',
})
export class AccordionComponent {
  items = input.required<AccordionItem[]>();

  footerTemplate = contentChild<TemplateRef<{ $implicit: AccordionItem }>>('footer');

  protected readonly chevronIcon = faChevronDown;
}
