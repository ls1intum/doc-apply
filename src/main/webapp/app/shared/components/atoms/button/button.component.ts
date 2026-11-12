import { Component, ElementRef, afterNextRender, computed, input, viewChild } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowUpRightFromSquare, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { TumAetUiButtonDirective, TumAetUiTooltipDirective } from '@tumaet/ui-angular';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

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

export type ButtonTooltipOptions = {
  showDelay?: number;
  hideDelay?: number;
};

const DEFAULT_TOOLTIP_SHOW_DELAY_MS = 150;
const DEFAULT_TOOLTIP_HIDE_DELAY_MS = 100;

@Component({
  selector: 'jhi-button',
  templateUrl: './button.component.html',
  standalone: true,
  imports: [FontAwesomeModule, TumAetUiButtonDirective, TumAetUiTooltipDirective],
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
  tooltipOptions = input<ButtonTooltipOptions>();
  classStyling = input<string>('');

  readonly faArrowUpRightFromSquare = faArrowUpRightFromSquare;
  readonly faSpinner = faSpinner;

  readonly kitVariant = computed(() => this.variant() ?? 'solid');
  readonly kitSize = computed(() => (this.size() === 'xs' ? 'small' : 'default'));
  readonly isDisabled = computed(() => this.disabled() || this.loading());

  readonly iconPrefix = computed<'fas' | 'fab'>(() => {
    const iconName = this.icon();
    return iconName === 'microsoft' || iconName === 'google' || iconName === 'apple' ? 'fab' : 'fas';
  });

  readonly buttonClass = computed(() => {
    const classes: string[] = [];
    if (this.label() === undefined) {
      classes.push(
        this.size() === 'sm' ? 'rounded-full w-10 h-10 scale-85' : this.size() === 'md' ? 'rounded-md w-10 h-10' : 'rounded-md w-12 h-12',
      );
    }
    if (this.size() === 'xs') {
      classes.push('!py-0 !px-2 !text-xs !h-8');
    }
    if (this.fullWidth()) {
      classes.push('w-full');
    }
    classes.push(this.classStyling());
    return classes.join(' ').trim();
  });

  readonly displayTooltip = computed(() => this.translator.translate(this.tooltip(), this.shouldTranslate(), this.translationParams()));
  readonly displayLabel = computed(() => this.translator.translate(this.label(), this.shouldTranslate(), this.translationParams()));
  readonly resolvedAriaLabel = computed(() => {
    const explicitLabel = this.ariaLabel();
    if (explicitLabel !== undefined) {
      return this.translator.translate(explicitLabel, this.shouldTranslate(), this.translationParams());
    }

    return this.label() === undefined ? this.displayTooltip() : undefined;
  });

  /** An icon-only button already uses its tooltip as accessible name, so it must not also be described by it. */
  readonly tooltipDescribesHost = computed(() => this.ariaLabel() !== undefined || this.label() !== undefined);
  readonly tooltipShowDelay = computed(() => this.tooltipOptions()?.showDelay ?? DEFAULT_TOOLTIP_SHOW_DELAY_MS);
  readonly tooltipHideDelay = computed(() => this.tooltipOptions()?.hideDelay ?? DEFAULT_TOOLTIP_HIDE_DELAY_MS);

  private readonly nativeButton = viewChild.required('nativeButton', { read: ElementRef<HTMLButtonElement> });
  private translator = injectTranslator();

  constructor() {
    afterNextRender(() => {
      if (this.autofocus()) {
        this.nativeButton().nativeElement.focus();
      }
    });
  }
}
