import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    [[{ type: 'NON_INCLUSIVE', word: 'dominant' }], 14],
    [[], 50],
    [[{ type: 'INCLUSIVE', word: 'collaborative' }], 86],
  ])('should map server-side biased issues to the sidebar scale', (issues, pointerPosition) => {
    fixture.componentRef.setInput('genderBiasAnalysis', issues);
    fixture.detectChanges();

    expect(component.genderDecoderPointerPosition()).toBe(pointerPosition);
    expect(component.genderDecoderPillLabelKey()).toBe('jobCreationForm.aiSidebar.genderDecoder.pill.fix');
  });

  it('should expose unique non-inclusive words as improvement candidates', () => {
    fixture.componentRef.setInput('genderBiasAnalysis', [
      { word: 'dominant', type: 'NON_INCLUSIVE' },
      { word: 'collaborative', type: 'INCLUSIVE' },
      { word: 'dominant', type: 'NON_INCLUSIVE' },
    ]);
    fixture.detectChanges();

    expect(component.genderDecoderWordsToImprove()).toEqual(['dominant']);
    expect(component.genderDecoderReviewCount()).toBe(1);
    expect(component.hasGenderDecoderReview()).toBe(true);
  });
});
