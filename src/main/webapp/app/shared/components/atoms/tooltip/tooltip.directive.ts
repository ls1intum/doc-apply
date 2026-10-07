import { Directive } from '@angular/core';
import { Tooltip } from 'primeng/tooltip';

/**
 * Shows a tooltip on the host element. Pages use this instead of the UI library's tooltip, so the library can be swapped here without touching them.
 */
@Directive({
  selector: '[jhiTooltip]',
  standalone: true,
  hostDirectives: [{ directive: Tooltip, inputs: ['pTooltip: jhiTooltip', 'tooltipPosition', 'escape', 'autoHide'] }],
})
export class TooltipDirective {}
