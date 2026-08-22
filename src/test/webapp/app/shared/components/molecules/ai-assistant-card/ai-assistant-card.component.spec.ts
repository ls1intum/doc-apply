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
    ['missing analysis', undefined, 'left-1/2'],
    ['non-inclusive wording', [{ type: 'NON_INCLUSIVE' }], 'left-[14%]'],
    ['balanced wording', [{ type: 'NON_INCLUSIVE' }, { type: 'INCLUSIVE' }], 'left-1/2'],
    ['empty analysis', [], 'left-1/2'],
    ['inclusive wording', [{ type: 'INCLUSIVE' }], 'left-[86%]'],
  ])('should map %s to the sidebar scale', (_case, analysis, pointerClass) => {
    fixture.componentRef.setInput('genderBiasAnalysis', analysis);
    fixture.detectChanges();

    const pointer = fixture.debugElement.query(By.css('[data-testid="gender-decoder-pointer"]'));
    expect(pointer).not.toBeNull();
    expect(pointer?.nativeElement.classList).toContain(pointerClass);
  });

  it('should wire the gender decoder pill to the fix label and review count', () => {
    fixture.componentRef.setInput('genderBiasAnalysis', [
      { type: 'NON_INCLUSIVE', word: 'driven' },
      { type: 'NON_INCLUSIVE', word: 'dominant' },
      { type: 'INCLUSIVE', word: 'collaborative' },
    ]);
    fixture.detectChanges();

    const genderPill = fixture.debugElement.query(By.css('[data-testid="gender-decoder-pill"]'));

    expect(genderPill).not.toBeNull();
    expect(genderPill?.componentInstance.labelKey()).toBe('jobCreationForm.aiSidebar.genderDecoder.pill.fix');
    expect(genderPill?.componentInstance.count()).toBe(2);
  });

  it.each([true, false])('should show the gender decoder spinner while an analysis is in flight: %s', analyzing => {
    fixture.componentRef.setInput('genderBiasAnalysis', []);
    fixture.componentRef.setInput('isGenderAnalyzing', analyzing);
    fixture.detectChanges();

    const genderPill = fixture.debugElement.query(By.css('[data-testid="gender-decoder-pill"]'));

    expect(genderPill).not.toBeNull();
    expect(genderPill.componentInstance.loading()).toBe(analyzing);
  });
});
