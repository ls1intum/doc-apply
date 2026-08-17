import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';
import { AiAssistantCardComponent } from 'app/shared/components/molecules/ai-assistant-card/ai-assistant-card.component';

describe('AiAssistantCardComponent', () => {
  let fixture: ComponentFixture<AiAssistantCardComponent>;
  let component: AiAssistantCardComponent;
  const feedbackKeyPrefix = 'jobCreationForm.positionDetailsSection.jobDescription.aiScoreFeedback.';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiAssistantCardComponent],
      providers: [provideFontAwesomeTesting(), provideTranslateMock()],
    }).compileComponents();

    fixture = TestBed.createComponent(AiAssistantCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['critical', (cmp: AiAssistantCardComponent) => cmp.DANGER_THRESHOLD, 'critical'],
    ['warning lower bound', (cmp: AiAssistantCardComponent) => cmp.DANGER_THRESHOLD + 1, 'warning'],
    ['warning upper bound', (cmp: AiAssistantCardComponent) => cmp.WARNING_THRESHOLD, 'warning'],
    ['good', (cmp: AiAssistantCardComponent) => cmp.WARNING_THRESHOLD + 1, 'good'],
    ['excellent', (cmp: AiAssistantCardComponent) => cmp.EXCELLENCE_THRESHOLD, 'excellent'],
  ])('should map %s score to the correct feedback key', (_caseLabel, getScore, feedbackKeySuffix) => {
    fixture.componentRef.setInput('score', getScore(component));
    fixture.detectChanges();

    expect(component.scoreFeedback()).toBe(`${feedbackKeyPrefix}${feedbackKeySuffix}`);
  });

  it('should keep displaying the previous score during generation and update afterwards', () => {
    fixture.componentRef.setInput('score', 42);
    fixture.detectChanges();
    expect(component.displayedScore()).toBe(42);

    fixture.componentRef.setInput('isGenerating', true);
    fixture.componentRef.setInput('score', 84);
    fixture.detectChanges();
    expect(component.displayedScore()).toBe(42);

    fixture.componentRef.setInput('isGenerating', false);
    fixture.detectChanges();
    expect(component.displayedScore()).toBe(84);
  });

  it.each([
    [undefined, 'left-1/2'],
    ['non-inclusive-coded', 'left-[14%]'],
    ['neutral', 'left-1/2'],
    ['empty', 'left-1/2'],
    ['inclusive-coded', 'left-[86%]'],
  ])('should map %s gender decoder coding to the sidebar scale', (coding, pointerClass) => {
    fixture.componentRef.setInput('genderBiasAnalysis', coding === undefined ? undefined : { coding });
    fixture.detectChanges();

    const pointer = fixture.debugElement.query(By.css('[data-testid="gender-decoder-pointer"]'));
    expect(pointer).not.toBeNull();
    expect(pointer?.nativeElement.classList).toContain(pointerClass);
  });

  it('should wire the gender decoder pill to the fix label', () => {
    const genderPill = fixture.debugElement.query(By.css('[data-testid="gender-decoder-pill"]'));

    expect(genderPill).not.toBeNull();
    expect(genderPill?.componentInstance.labelKey()).toBe('jobCreationForm.aiSidebar.genderDecoder.pill.fix');
  });
});
