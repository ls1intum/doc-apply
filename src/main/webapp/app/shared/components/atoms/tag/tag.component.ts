import { Component, computed, input } from '@angular/core';
import { FontAwesomeModule, IconDefinition } from '@fortawesome/angular-fontawesome';
import { TumAetUiTooltipDirective } from '@tumaet/ui-angular';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

export type TagColor = 'primary' | 'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'contrast' | 'neutral';

/** Fill, border and text of each tag colour; `primary` shares the info colours. */
const COLOR_CLASSES: Record<TagColor, string> = {
  primary: 'border-tag-info-border bg-tag-info-bg text-tag-info-text',
  info: 'border-tag-info-border bg-tag-info-bg text-tag-info-text',
  secondary: 'border-tag-secondary-border bg-tag-secondary-bg text-tag-secondary-text',
  success: 'border-tag-success-border bg-tag-success-bg text-tag-success-text',
  warn: 'border-tag-warn-border bg-tag-warn-bg text-tag-warn-text',
  danger: 'border-tag-danger-border bg-tag-danger-bg text-tag-danger-text',
  contrast: 'border-tag-contrast-border bg-tag-contrast-bg text-tag-contrast-text',
  neutral: 'border-tag-neutral-border bg-tag-neutral-bg text-tag-neutral-text',
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

  /** Without a fixed width the tag fits its text; with one, the text is centred across it. */
  readonly tagClass = computed(() => `${COLOR_CLASSES[this.color()]} ${this.width() === undefined ? 'w-fit' : ''}`);

  displayText = computed(() => this.translator.translate(this.text(), this.shouldTranslate(), this.translationParams()) ?? '');
  displayTooltipText = computed(
    () => this.translator.translate(this.tooltipText(), this.shouldTranslate(), this.translationParams()) ?? '',
  );

  private translator = injectTranslator();
}
