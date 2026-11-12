import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { injectTranslator } from 'app/shared/util/translate-signal.util';
import { TooltipOptions } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { TooltipModule } from 'primeng/tooltip';

export type ButtonColor = 'primary' | 'secondary' | 'contrast' | 'success' | 'warn' | 'danger' | 'info';

export type ButtonVariant = 'outlined' | 'text';

export type Button = {
  severity: ButtonColor;
  variant?: ButtonVariant;
  icon?: string;
  isExternalLink?: boolean;
  label?: string;
  numberOfFavorites?: number;
  disabled: boolean;
  fullWidth?: boolean;
  onClick: VoidFunction;
  shouldTranslate?: boolean;
};

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

@Component({
  selector: 'jhi-button',
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
  standalone: true,
  imports: [CommonModule, ButtonModule, FontAwesomeModule, OverlayBadgeModule, NgTemplateOutlet, TooltipModule],
  encapsulation: ViewEncapsulation.None,
})
export class ButtonComponent {
  severity = input<ButtonColor>('primary');
  variant = input<ButtonVariant>();
  icon = input<string | undefined>(undefined);
  isExternalLink = input<boolean | undefined>(false);
  label = input<string | undefined>(undefined);
  ariaLabel = input<string | undefined>(undefined);
  numberOfFavorites = input<number | undefined>(undefined);
  disabled = input<boolean>(false);
  shouldTranslate = input<boolean>(true);
  translationParams = input<Record<string, unknown>>({});
  fullWidth = input<boolean>(false);
  type = input<'button' | 'submit' | 'reset'>('button');
  loading = input<boolean>(false);
  autofocus = input<boolean>(false);
  size = input<ButtonSize>('lg');
  tooltip = input<string | undefined>(undefined);
  tooltipPosition = input<'top' | 'bottom' | 'left' | 'right'>('top');
  tooltipOptions = input<TooltipOptions>();

  readonly faArrowUpRightFromSquare = faArrowUpRightFromSquare;
  classStyling = input<string>('');

  displayTooltip = computed(() => this.translator.translate(this.tooltip(), this.shouldTranslate(), this.translationParams()));
  displayLabel = computed(() => this.translator.translate(this.label(), this.shouldTranslate(), this.translationParams()));
  resolvedAriaLabel = computed(() => {
    const explicitLabel = this.ariaLabel();
    if (explicitLabel !== undefined) {
      return this.translator.translate(explicitLabel, this.shouldTranslate(), this.translationParams());
    }

    return this.label() === undefined ? this.displayTooltip() : undefined;
  });

  private translator = injectTranslator();

  iconPrefix(): 'fas' | 'fab' {
    if (this.icon() === 'microsoft' || this.icon() === 'google' || this.icon() === 'apple') {
      return 'fab';
    }
    return 'fas';
  }

  buttonClass(): string {
    let sizeClass = '';
    if (this.label() === undefined) {
      sizeClass = `rounded-md ${this.size() === 'sm' ? 'rounded-full w-10 h-10 scale-85' : this.size() === 'md' ? 'w-10 h-10' : 'w-12 h-12'}`;
    }

    if (this.size() === 'xs') {
      sizeClass += ' !py-0 !px-2 !text-xs !h-8';
    }

    return `${sizeClass} ${this.classStyling()}`;
  }
}
