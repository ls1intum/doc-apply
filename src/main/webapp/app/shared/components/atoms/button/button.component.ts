import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, viewChild } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowUpRightFromSquare, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { TumAetUiButtonDirective, TumAetUiButtonSeverity, TumAetUiTooltipDirective } from '@tumaet/ui-angular';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

export type ButtonColor = TumAetUiButtonSeverity;

export type ButtonVariant = 'outlined' | 'text';

type KitVariant = ButtonVariant | 'solid';

export type Button = {
  severity: ButtonColor;
  variant?: ButtonVariant;
  icon?: string;
  isExternalLink?: boolean;
  label?: string;
  numberOfFavorites?: number;
  disabled: boolean;
  disabledReason?: string;
  fullWidth?: boolean;
  onClick: VoidFunction;
  shouldTranslate?: boolean;
};

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export type ButtonRadius = 'md' | 'lg' | 'full';

const RADIUS_CLASSES: Record<ButtonRadius, string> = {
  md: '',
  lg: '[--tumaet-ui-radius-md:var(--border-radius-lg)]',
  full: '[--tumaet-ui-radius-md:9999px]',
};

const SECONDARY_CLASSES: Record<KitVariant, string> = {
  solid: 'bg-secondary-default border-secondary-default text-text-on-secondary',
  outlined: 'border-secondary-default text-secondary-default',
  text: 'text-secondary-default',
};

const ICON_ONLY_SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'w-8 h-8',
  sm: `w-10 h-10 scale-85 ${RADIUS_CLASSES.full}`,
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

export interface ButtonTooltipOptions {
  showDelay?: number;
  hideDelay?: number;
}

const DEFAULT_TOOLTIP_SHOW_DELAY_MS = 150;
const DEFAULT_TOOLTIP_HIDE_DELAY_MS = 100;

let nextDisabledReasonId = 0;

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
  disabledReason = input<string | undefined>(undefined);
  shouldTranslate = input<boolean>(true);
  translationParams = input<Record<string, unknown>>({});
  fullWidth = input<boolean>(false);
  radius = input<ButtonRadius>('md');
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

  readonly kitVariant = computed<KitVariant>(() => this.variant() ?? 'solid');
  readonly kitSize = computed(() => (this.size() === 'xs' ? 'small' : 'default'));
  readonly isDisabled = computed(() => this.disabled() || this.loading());

  readonly iconPrefix = computed<'fas' | 'fab'>(() => {
    const iconName = this.icon();
    return iconName === 'microsoft' || iconName === 'google' || iconName === 'apple' ? 'fab' : 'fas';
  });

  readonly buttonClass = computed(() => {
    const classes: string[] = [];
    if (this.label() === undefined) {
      classes.push(ICON_ONLY_SIZE_CLASSES[this.size()]);
    } else if (this.size() === 'xs') {
      classes.push('py-0 px-2 text-xs h-8');
    }
    if (this.fullWidth()) {
      classes.push('w-full');
    }
    if (this.explainsDisabledState()) {
      classes.push('opacity-60');
    }
    if (this.severity() === 'secondary') {
      classes.push(SECONDARY_CLASSES[this.kitVariant()]);
    }
    classes.push(RADIUS_CLASSES[this.radius()]);
    classes.push(this.classStyling());
    return classes.join(' ').trim();
  });

  readonly tooltipText = computed(() => this.translator.translate(this.tooltip(), this.shouldTranslate(), this.translationParams()));
  readonly disabledReasonText = computed(() =>
    this.translator.translate(this.disabledReason(), this.shouldTranslate(), this.translationParams()),
  );

  /**
   * Whether the button is disabled and tells why in its tooltip. Such a button is marked with aria-disabled instead of
   * the native disabled attribute, because a natively disabled button takes neither hover nor focus, so its tooltip
   * could never open. It stays in the tab order, links the reason as its description and blocks clicks.
   */
  readonly explainsDisabledState = computed(() => this.disabled() && !this.loading() && (this.disabledReasonText() ?? '') !== '');
  readonly displayTooltip = computed(() => (this.explainsDisabledState() ? this.disabledReasonText() : this.tooltipText()));
  readonly displayLabel = computed(() => this.translator.translate(this.label(), this.shouldTranslate(), this.translationParams()));
  readonly resolvedAriaLabel = computed(() => {
    const explicitLabel = this.ariaLabel();
    if (explicitLabel !== undefined) {
      return this.translator.translate(explicitLabel, this.shouldTranslate(), this.translationParams());
    }

    return this.label() === undefined ? this.tooltipText() : undefined;
  });

  readonly tooltipDescribesHost = computed(() => this.ariaLabel() !== undefined || this.label() !== undefined);
  readonly tooltipShowDelay = computed(() => this.tooltipOptions()?.showDelay ?? DEFAULT_TOOLTIP_SHOW_DELAY_MS);
  readonly tooltipHideDelay = computed(() => this.tooltipOptions()?.hideDelay ?? DEFAULT_TOOLTIP_HIDE_DELAY_MS);
  readonly disabledReasonId = `jhi-button-disabled-reason-${nextDisabledReasonId++}`;

  private readonly nativeButton = viewChild.required('nativeButton', { read: ElementRef<HTMLButtonElement> });
  private translator = injectTranslator();
  private readonly hostElement: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    this.blockClicksWhileDisabled();
    afterNextRender(() => {
      if (this.autofocus()) {
        this.nativeButton().nativeElement.focus();
      }
    });
  }
  /**
   * Keeps a click on a disabled button from reaching the click handler a parent binds on this component. The kit's
   * disabled button ignores the pointer, so the click lands on its wrapper and bubbles up to this element, where the
   * parent's listener would run. A capturing listener on this element runs before any bubbling one and stops it there.
   * A button that explains its disabled state is only aria-disabled, so the listener also cancels a form submit.
   */
  private blockClicksWhileDisabled(): void {
    const stopWhileDisabled = (event: MouseEvent): void => {
      if (this.isDisabled()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    this.hostElement.addEventListener('click', stopWhileDisabled, { capture: true });
    inject(DestroyRef).onDestroy(() => {
      this.hostElement.removeEventListener('click', stopWhileDisabled, { capture: true });
    });
  }
}
