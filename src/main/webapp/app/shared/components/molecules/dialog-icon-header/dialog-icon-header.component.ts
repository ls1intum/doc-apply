import { Component, input } from '@angular/core';
import { FontAwesomeModule, IconDefinition } from '@fortawesome/angular-fontawesome';
import { TranslateDirective } from 'app/shared/language';

/**
 * The title row of a dialog that hides the kit header: a leading icon and the translated title as the dialog's heading.
 * Pass the same title key as `header` to `jhi-dialog`, so that the dialog keeps it as its accessible name.
 */
@Component({
  selector: 'jhi-dialog-icon-header',
  imports: [FontAwesomeModule, TranslateDirective],
  templateUrl: './dialog-icon-header.component.html',
})
export class DialogIconHeaderComponent {
  icon = input.required<IconDefinition>();
  titleKey = input.required<string>();
  titleValues = input<Record<string, unknown>>();
}
