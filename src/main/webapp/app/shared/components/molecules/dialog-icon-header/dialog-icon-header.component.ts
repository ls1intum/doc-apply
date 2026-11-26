import { Component, input, output } from '@angular/core';
import { FontAwesomeModule, IconDefinition } from '@fortawesome/angular-fontawesome';
import { TranslateDirective } from 'app/shared/language';
import { TranslateModule } from '@ngx-translate/core';
import { faXmark } from '@fortawesome/free-solid-svg-icons';

/**
 * The title row of a dialog that hides the kit header: a leading icon and the translated title as the dialog's heading.
 * Pass the same title key as `header` to `jhi-dialog`, so that the dialog keeps it as its accessible name.
 * Set `closable` for a dialog whose only action is closing, so a close button in the corner replaces a lone Close button.
 */
@Component({
  selector: 'jhi-dialog-icon-header',
  imports: [FontAwesomeModule, TranslateDirective, TranslateModule],
  templateUrl: './dialog-icon-header.component.html',
})
export class DialogIconHeaderComponent {
  icon = input.required<IconDefinition>();
  titleKey = input.required<string>();
  titleValues = input<Record<string, unknown>>();
  closable = input<boolean>(false);

  closed = output();

  readonly faXmark = faXmark;
}
