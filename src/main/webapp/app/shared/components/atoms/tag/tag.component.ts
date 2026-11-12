import { Component, computed, input } from '@angular/core';
import { FontAwesomeModule, IconDefinition } from '@fortawesome/angular-fontawesome';
import { TumAetUiTagComponent, TumAetUiTooltipDirective } from '@tumaet/ui-angular';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

@Component({
  selector: 'jhi-tag',
  imports: [TumAetUiTagComponent, TumAetUiTooltipDirective, FontAwesomeModule],
  templateUrl: './tag.component.html',
  standalone: true,
})
export class TagComponent {
  text = input<string>('');
  color = input<'primary' | 'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'contrast' | 'neutral'>('primary');
  icon = input<IconDefinition | undefined>(undefined);
  round = input<boolean>(false);
  iconRight = input<boolean>(false);
  tooltipText = input<string | undefined>(undefined);
  width = input<string | undefined>(undefined);
  shouldTranslate = input<boolean>(true);
  translationParams = input<Record<string, unknown>>({});

  readonly severity = computed(() => {
    const colorValue = this.color();
    if (colorValue === 'primary') return 'info';
    if (colorValue === 'neutral') return 'secondary';
    return colorValue;
  });

  /** A fixed width stretches the tag's pill across it and centres the content, as a column of status tags expects. */
  readonly tagClass = computed(() => (this.width() === undefined ? 'w-fit' : 'grid [&>span]:justify-center'));

  displayText = computed(() => this.translator.translate(this.text(), this.shouldTranslate(), this.translationParams()) ?? '');
  displayTooltipText = computed(
    () => this.translator.translate(this.tooltipText(), this.shouldTranslate(), this.translationParams()) ?? '',
  );

  private translator = injectTranslator();
}
