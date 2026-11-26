import { Component, input } from '@angular/core';
import { FontAwesomeModule, IconDefinition } from '@fortawesome/angular-fontawesome';
import { TranslateDirective } from 'app/shared/language';

/**
 * The lead of a dialog: a rounded tinted tile with an icon next to a translated heading. Content projected into the
 * component, such as a description or tags, appears below that row across the full width.
 */
@Component({
  selector: 'jhi-icon-intro',
  imports: [FontAwesomeModule, TranslateDirective],
  templateUrl: './icon-intro.component.html',
})
export class IconIntroComponent {
  icon = input.required<IconDefinition>();
  titleKey = input.required<string>();
  titleValues = input<Record<string, unknown>>();
}
