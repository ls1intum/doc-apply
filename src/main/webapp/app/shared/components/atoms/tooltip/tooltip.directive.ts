import { Directive } from '@angular/core';
import { TumAetUiTooltipDirective } from '@tumaet/ui-angular';

/**
 * Shows a plain-text tooltip on the host element. Pages use this instead of the UI library's tooltip, so the library can be swapped here without touching them.
 */
@Directive({
  selector: '[jhiTooltip]',
  hostDirectives: [
    {
      directive: TumAetUiTooltipDirective,
      inputs: ['tumAetUiTooltip: jhiTooltip', 'tumAetUiTooltipPlacement: tooltipPosition'],
    },
  ],
})
export class TooltipDirective {}
