import { Component, computed, input } from '@angular/core';
import { FontAwesomeModule, IconDefinition } from '@fortawesome/angular-fontawesome';
import { TumAetUiTooltipDirective } from '@tumaet/ui-angular';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

export type TagColor = 'primary' | 'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'contrast' | 'neutral';

const COLOR_CLASSES: Record<TagColor, string> = {
  primary: 'border-info-default bg-info-default/20',
  info: 'border-info-default bg-info-default/20',
  secondary: 'border-info-default bg-info-default/20',
  success: 'border-positive-default bg-positive-default/20',
  warn: 'border-warning-default bg-warning-default/20',
  danger: 'border-negative-default bg-negative-default/20',
  contrast: 'border-accent-default bg-accent-default/20',
  neutral: 'border-text-disabled bg-background-disabled',
};

@Component({
  selector: 'jhi-tag',
  imports: [TumAetUiTooltipDirective, FontAwesomeModule],
  templateUrl: './tag.component.html',
  standalone: true,
})
export class TagComponent {
  text = input<string>('');
  color = input<TagColor>('primary');
  icon = input<IconDefinition | undefined>(undefined);
  iconRight = input<boolean>(false);
  tooltipText = input<string | undefined>(undefined);
  width = input<string | undefined>(undefined);
  shouldTranslate = input<boolean>(true);
  translationParams = input<Record<string, unknown>>({});

  readonly tagClass = computed(() => `${COLOR_CLASSES[this.color()]} ${this.width() === undefined ? 'w-fit' : ''}`);

  displayText = computed(() => this.translator.translate(this.text(), this.shouldTranslate(), this.translationParams()) ?? '');
  displayTooltipText = computed(
    () => this.translator.translate(this.tooltipText(), this.shouldTranslate(), this.translationParams()) ?? '',
  );

  private translator = injectTranslator();
}
