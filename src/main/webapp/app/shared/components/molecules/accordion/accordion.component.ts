import { Component, TemplateRef, contentChild, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AccordionModule } from 'primeng/accordion';

/** One expandable entry of an accordion. */
export interface AccordionItem {
  value: string;
  /** Translation key of the always visible title. */
  title: string;
  /** Translation key of the HTML content shown when the entry is expanded. */
  content: string;
}

/**
 * A list of entries that expand one at a time to show their content. An optional `#footer` template renders
 * below each entry's content and receives the entry as its implicit value.
 */
@Component({
  selector: 'jhi-accordion',
  standalone: true,
  imports: [AccordionModule, NgTemplateOutlet, TranslateModule],
  templateUrl: './accordion.component.html',
  host: { class: 'block' },
})
export class AccordionComponent {
  items = input.required<AccordionItem[]>();

  footerTemplate = contentChild<TemplateRef<{ $implicit: AccordionItem }>>('footer');
}
