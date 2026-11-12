import { Component, computed, input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { IconName, IconPrefix } from '@fortawesome/fontawesome-svg-core';

import TranslateDirective from '../../../language/translate.directive';

type InfoBoxSeverity = 'primary' | 'secondary' | 'danger' | 'warning' | 'info';

@Component({
  selector: 'jhi-info-box',
  standalone: true,
  imports: [FontAwesomeModule, TranslateDirective],
  templateUrl: './info-box.component.html',
})
export class InfoBoxComponent {
  /**
   * The message to display in the info box.
   * Can be a translation key if shouldTranslate is true.
   */
  message = input<string>('');

  /**
   * The severity/type of the info box.
   * Determines the color scheme and default icon.
   */
  severity = input<InfoBoxSeverity>('primary');

  /**
   * Whether to translate the message using the translation key.
   */
  shouldTranslate = input<boolean>(true);

  /**
   * Custom icon to display. If not provided, uses default based on severity.
   */
  icon = input<IconName | undefined>(undefined);

  /**
   * Icon prefix (e.g., 'fas', 'far', 'fab').
   */
  iconPrefix = input<IconPrefix>('fas');

  /**
   * Get the default icon based on severity.
   */
  defaultIcon = computed(() => {
    const iconMap: Record<InfoBoxSeverity, IconName> = {
      primary: 'info-circle',
      secondary: 'info-circle',
      danger: 'exclamation-triangle',
      warning: 'exclamation-circle',
      info: 'info-circle',
    };
    return this.icon() ?? iconMap[this.severity()];
  });

  /**
   * Get CSS classes for the container based on severity.
   * Uses design token colors for consistency.
   */
  containerClasses = computed(() => {
    const baseClasses = 'flex items-center gap-3 p-4 border-l-4 rounded-sm';
    const severityClasses: Record<InfoBoxSeverity, string> = {
      primary: 'bg-background-surface border-primary',
      secondary: 'bg-border-default border-text-disabled',
      danger: 'bg-background-surface border-negative-default',
      warning: 'bg-[var(--p-warn-hover-color-outlined)] border-warning-default',
      info: 'bg-background-surface border-info-default',
    };
    return `${baseClasses} ${severityClasses[this.severity()]}`;
  });

  /**
   * Get CSS classes for the icon based on severity.
   * Uses design token colors for consistency.
   */
  iconClasses = computed(() => {
    const baseClasses = 'text-xl mt-0.5';
    const severityClasses: Record<InfoBoxSeverity, string> = {
      primary: 'text-primary',
      secondary: 'text-text-disabled',
      danger: 'text-negative-default',
      warning: 'text-warning-default',
      info: 'text-info-default',
    };
    return `${baseClasses} ${severityClasses[this.severity()]}`;
  });
}
