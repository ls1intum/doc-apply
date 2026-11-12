import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { TooltipModule } from 'primeng/tooltip';

export type InfoIconSize = 'sm' | 'md';

@Component({
  selector: 'jhi-info-icon',
  standalone: true,
  imports: [NgTemplateOutlet, TooltipModule],
  templateUrl: './info-icon.component.html',
})
export class InfoIconComponent {
  tooltip = input<string | undefined>(undefined);
  tooltipPosition = input<'top' | 'bottom' | 'left' | 'right'>('top');
  ariaLabel = input<string | undefined>(undefined);
  size = input<InfoIconSize>('md');
  clickable = input<boolean>(false);
  disabled = input<boolean>(false);
  shouldTranslate = input<boolean>(false);

  clicked = output();

  iconSizeClass = computed(() => (this.size() === 'sm' ? 'text-base' : 'text-xl'));

  buttonClass = computed(() => {
    const base =
      'group inline-flex shrink-0 items-center justify-center p-0 m-0 border-0 leading-none rounded-md bg-transparent text-text-secondary transition-colors duration-150';
    const interactive = this.disabled()
      ? 'cursor-not-allowed opacity-50'
      : 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default focus-visible:ring-offset-1';
    return `${base} ${interactive}`;
  });

  displayTooltip = computed(() => {
    this.langChange();
    const value = this.tooltip();
    if (value === undefined) {
      return undefined;
    }
    return this.shouldTranslate() ? this.translateService.instant(value) : value;
  });

  displayAriaLabel = computed(() => {
    this.langChange();
    const value = this.ariaLabel();
    if (value === undefined) {
      return undefined;
    }
    return this.shouldTranslate() ? this.translateService.instant(value) : value;
  });

  private translateService = inject(TranslateService);
  private langChange = toSignal(this.translateService.onLangChange, { initialValue: undefined });

  onClick(event: Event): void {
    if (this.disabled()) {
      return;
    }
    event.stopPropagation();
    this.clicked.emit();
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.disabled()) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.clicked.emit();
    }
  }
}
