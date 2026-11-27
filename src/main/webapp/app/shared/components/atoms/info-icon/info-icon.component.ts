import { Component, computed, input, output } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { TumAetUiPopoverComponent, TumAetUiPopoverTriggerDirective, TumAetUiTooltipDirective } from '@tumaet/ui-angular';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

/**
 * The info icon shown next to labels and headings. A clickable icon (one that emits `clicked` or opens a popover) is a solid primary
 * button; an icon that only explains something on hover or focus is a grey outline. Both scale with the surrounding font size.
 */
@Component({
  selector: 'jhi-info-icon',
  imports: [FontAwesomeModule, TumAetUiPopoverComponent, TumAetUiPopoverTriggerDirective, TumAetUiTooltipDirective],
  templateUrl: './info-icon.component.html',
})
export class InfoIconComponent {
  tooltip = input<string | undefined>(undefined);
  tooltipPosition = input<'top' | 'bottom' | 'left' | 'right'>('top');
  ariaLabel = input<string | undefined>(undefined);
  popover = input<string | undefined>(undefined);
  clickable = input<boolean>(false);
  shouldTranslate = input<boolean>(false);

  clicked = output();

  readonly solidIcon = faCircleInfo;

  readonly buttonClass =
    'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent p-0 align-middle leading-none text-primary-default transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default';

  readonly displayTooltip = computed(() => this.translator.translate(this.tooltip(), this.shouldTranslate()));
  readonly displayAriaLabel = computed(() => this.translator.translate(this.ariaLabel(), this.shouldTranslate()) ?? this.displayTooltip());
  readonly displayPopover = computed(() => this.translator.translate(this.popover(), this.shouldTranslate()));

  private readonly translator = injectTranslator();

  /**
   * Emits `clicked` without letting the click reach a surrounding label or card.
   *
   * @param event the click on the icon button
   */
  onClick(event: Event): void {
    event.stopPropagation();
    this.clicked.emit();
  }
}
