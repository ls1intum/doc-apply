import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProgressStepperComponent, StepData } from 'app/shared/components/molecules/progress-stepper/progress-stepper.component';
import { CommonModule } from '@angular/common';
import { StepperModule } from 'primeng/stepper';
import ButtonGroupComponent from 'app/shared/components/molecules/button-group/button-group.component';
import { TranslateModule } from '@ngx-translate/core';
import { Component, TemplateRef, viewChild } from '@angular/core';

// Test host component with real ng-templates
@Component({
  template: `
    <ng-template #template1>
      <div class="step-1-content">Step 1 Content</div>
    </ng-template>
    <ng-template #template2>
      <div class="step-2-content">Step 2 Content</div>
    </ng-template>
    <ng-template #statusTemplate>
      <div class="status">Status</div>
    </ng-template>

    <jhi-progress-stepper [steps]="steps" [shouldTranslate]="shouldTranslate"> </jhi-progress-stepper>
  `,
  standalone: true,
  imports: [ProgressStepperComponent],
})
class TestHostComponent {
  template1 = viewChild<TemplateRef<any>>('template1');
  template2 = viewChild<TemplateRef<any>>('template2');
  statusTemplate = viewChild<TemplateRef<any>>('statusTemplate');

  shouldTranslate = false;
  steps: StepData[] = [];
}

describe('ProgressStepperComponent', () => {
  let hostComponent: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;
  let component: ProgressStepperComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, StepperModule, ButtonGroupComponent, TranslateModule.forRoot(), TestHostComponent, ProgressStepperComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;

    hostComponent.steps = [
      {
        name: 'Step 1',
        panelTemplate: hostComponent.template1()!,
        buttonGroupPrev: [],
        buttonGroupNext: [
          {
            changePanel: true,
            onClick: vi.fn(),
            label: 'Next',
            severity: 'primary',
            disabled: false,
          },
        ],
        shouldTranslate: false,
      },
      {
        name: 'Step 2',
        panelTemplate: hostComponent.template2()!,
        buttonGroupPrev: [
          {
            changePanel: true,
            onClick: vi.fn(),
            label: 'Previous',
            severity: 'secondary',
            disabled: false,
          },
        ],
        buttonGroupNext: [
          {
            changePanel: false,
            onClick: vi.fn(),
            label: 'Submit',
            severity: 'primary',
            disabled: false,
          },
        ],
        status: hostComponent.statusTemplate()!,
        shouldTranslate: false,
      },
    ];

    fixture.detectChanges();

    const stepperDebugElement = fixture.debugElement.query(de => de.componentInstance instanceof ProgressStepperComponent);
    component = stepperDebugElement.componentInstance;
  });

  describe('Navigation', () => {
    it('should navigate to next then previous step', () => {
      component.goToStep(2);
      fixture.detectChanges();
      expect(component.currentStep()).toBe(2);

      component.goToStep(1);
      fixture.detectChanges();
      expect(component.currentStep()).toBe(1);
    });

    it.each([0, 999])('should clamp out-of-range step %i to first step', step => {
      component.goToStep(step);
      expect(component.currentStep()).toBe(1);
    });
  });

  describe('Button Group Functionality', () => {
    it('should call button onClick and change panel when changePanel is true', () => {
      const nextButton = hostComponent.steps[0].buttonGroupNext[0];
      const onClickSpy = vi.mocked(nextButton.onClick);

      const buttonGroupData = component.buildButtonGroupData(hostComponent.steps[0].buttonGroupNext, 'next', 1);

      buttonGroupData.buttons[0].onClick();

      expect(onClickSpy).toHaveBeenCalledOnce();
      expect(component.currentStep()).toBe(2);
    });

    it('should call button onClick but not change panel when changePanel is false', () => {
      component.goToStep(2);
      const submitButton = hostComponent.steps[1].buttonGroupNext[0];
      const onClickSpy = vi.mocked(submitButton.onClick);

      const buttonGroupData = component.buildButtonGroupData(hostComponent.steps[1].buttonGroupNext, 'next', 2);

      buttonGroupData.buttons[0].onClick();

      expect(onClickSpy).toHaveBeenCalledOnce();
      expect(component.currentStep()).toBe(2); // Should stay on step 2
    });

    it('should navigate to previous step when prev button with changePanel is clicked', () => {
      // First go to step 2
      component.goToStep(2);
      fixture.detectChanges();
      expect(component.currentStep()).toBe(2);

      const prevButton = hostComponent.steps[1].buttonGroupPrev[0];
      const onClickSpy = vi.mocked(prevButton.onClick);

      const buttonGroupData = component.buildButtonGroupData(hostComponent.steps[1].buttonGroupPrev, 'prev', 2);

      buttonGroupData.buttons[0].onClick();

      expect(onClickSpy).toHaveBeenCalledOnce();
      expect(component.currentStep()).toBe(1); // Should go back to step 1
    });
  });

  describe('Scroll Reset', () => {
    it('should scroll the nearest scrollable ancestor to top when changing step', () => {
      vi.useFakeTimers();
      try {
        // Build a scrollable ancestor around the stepper host element.
        const stepperHost = fixture.debugElement.query(de => de.componentInstance instanceof ProgressStepperComponent)
          .nativeElement as HTMLElement;
        const scrollable = document.createElement('div');
        scrollable.style.overflowY = 'auto';
        Object.defineProperty(scrollable, 'scrollHeight', { configurable: true, value: 1000 });
        Object.defineProperty(scrollable, 'clientHeight', { configurable: true, value: 400 });
        const scrollSpy = vi.fn();
        Object.defineProperty(scrollable, 'scrollTo', { configurable: true, value: scrollSpy });
        stepperHost.parentElement?.insertBefore(scrollable, stepperHost);
        scrollable.appendChild(stepperHost);

        component.goToStep(2);
        vi.runAllTimers();

        expect(scrollSpy).toHaveBeenCalledOnce();
        expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
