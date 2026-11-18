import { Component, computed, input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TumAetUiPopoverComponent, TumAetUiPopoverTriggerDirective } from '@tumaet/ui-angular';
import { TranslateDirective } from 'app/shared/language';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

/**
 * An info icon that opens a popover on click. Unlike a tooltip, the popover stays open, so its text can hold links.
 */
@Component({
  selector: 'jhi-info-popover',
  imports: [FontAwesomeModule, TranslateDirective, TumAetUiPopoverComponent, TumAetUiPopoverTriggerDirective],
  templateUrl: './info-popover.component.html',
})
export class InfoPopoverComponent {
  /** Translation key of the popover text; it may contain HTML such as links. */
  content = input.required<string>();
  /** Translation key naming the icon and the popover for screen readers. */
  ariaLabel = input.required<string>();

  readonly displayAriaLabel = computed(() => this.translator.translate(this.ariaLabel()) ?? '');

  private readonly translator = injectTranslator();
}
