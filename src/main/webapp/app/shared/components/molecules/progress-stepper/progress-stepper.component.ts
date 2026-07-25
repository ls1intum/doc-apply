import { Component, ElementRef, Signal, TemplateRef, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StepperModule } from 'primeng/stepper';
import { TooltipModule } from 'primeng/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateDirective } from 'app/shared/language';
import { StickyFooterShellComponent } from 'app/shared/components/molecules/sticky-footer-shell/sticky-footer-shell.component';

import { Button } from '../../atoms/button/button.component';
import ButtonGroupComponent, { ButtonGroupData } from '../button-group/button-group.component';

/**
 * Represents a button used in the stepper, extending the base Button type.
 * Optionally includes a flag to indicate whether the panel should change.
 */
export type StepButton = Button & {
  changePanel: boolean;
};

export type StepData = {
  name: string;
  panelTemplate: TemplateRef<any>;
  buttonGroupPrev: StepButton[];
  buttonGroupNext: StepButton[];
  status?: TemplateRef<HTMLDivElement>;
  shouldTranslate?: boolean;
  disabled?: boolean;
};

@Component({
  selector: 'jhi-progress-stepper',
  imports: [
    CommonModule,
    StepperModule,
    ButtonGroupComponent,
    TranslateModule,
    TranslateDirective,
    TooltipModule,
    StickyFooterShellComponent,
  ],
  templateUrl: './progress-stepper.component.html',
  standalone: true,
})
export class ProgressStepperComponent {
  currentStep = signal<number>(1);
  steps = input<StepData[]>([]);

  shouldTranslate = input<boolean | undefined>(undefined);

  buttonGroupPrev: Signal<ButtonGroupData> = computed(() =>
    this.buildButtonGroupData(this.steps()[this.currentStep() - 1].buttonGroupPrev, 'prev', this.currentStep()),
  );

  statusDiv: Signal<TemplateRef<HTMLDivElement> | undefined> = computed(() => this.steps()[this.currentStep() - 1].status);

  buttonGroupNext: Signal<ButtonGroupData> = computed(() =>
    this.buildButtonGroupData(this.steps()[this.currentStep() - 1].buttonGroupNext, 'next', this.currentStep()),
  );

  stepTooltips: Signal<string[]> = computed(() => {
    this.langChange();
    return this.steps().map(step => ((step.shouldTranslate ?? false) ? this.translateService.instant(step.name) : step.name));
  });

  private translateService = inject(TranslateService);
  private hostElement = inject(ElementRef<HTMLElement>);
  private langChange = toSignal(this.translateService.onLangChange, { initialValue: undefined });
  goToStep(index: number): void {
    if (index > 0 && index <= this.steps().length) {
      this.currentStep.set(index);
      this.scrollToTop();
    }
  }

  buildButtonGroupData(steps: StepButton[], action: 'prev' | 'next', index: number): ButtonGroupData {
    return {
      direction: 'horizontal',
      buttons: steps.map(button => {
        return {
          ...button,
          onClick: () => {
            button.onClick();
            if (button.changePanel) {
              if (action === 'next') {
                this.goToStep(index + 1);
              } else {
                this.goToStep(index - 1);
              }
            }
          },
        };
      }),
    };
  }

  private scrollToTop(): void {
    // Defer so the next step's content is rendered before we measure the scroll container.
    setTimeout(() => {
      const scrollable = this.findScrollableAncestor(this.hostElement.nativeElement);
      scrollable?.scrollTo({ top: 0, behavior: 'instant' });
    }, 0);
  }

  private findScrollableAncestor(element: HTMLElement): HTMLElement | undefined {
    let current: HTMLElement | undefined = element.parentElement ?? undefined;
    while (current) {
      const { overflowY } = getComputedStyle(current);
      if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight) {
        return current;
      }
      current = current.parentElement ?? undefined;
    }
    return undefined;
  }
}
