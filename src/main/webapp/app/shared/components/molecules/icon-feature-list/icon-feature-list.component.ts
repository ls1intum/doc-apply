import { Component, input } from '@angular/core';
import { FontAwesomeModule, IconDefinition } from '@fortawesome/angular-fontawesome';
import { TranslateDirective } from 'app/shared/language';

/** One row of an icon feature list: an icon badge, a bold label and a muted description, both as translation keys. */
export interface IconFeatureItem {
  icon: IconDefinition;
  labelKey: string;
  descriptionKey: string;
  descriptionValues?: Record<string, unknown>;
}

/** A bordered, rounded list in which each item shows a circular icon badge with a bold label, and a muted description below. */
@Component({
  selector: 'jhi-icon-feature-list',
  imports: [FontAwesomeModule, TranslateDirective],
  templateUrl: './icon-feature-list.component.html',
})
export class IconFeatureListComponent {
  items = input.required<IconFeatureItem[]>();
}
