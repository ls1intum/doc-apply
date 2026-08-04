import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTranslateServiceMock, provideTranslateMock, TranslateServiceMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { BiasedIssue } from 'app/generated/model/biased-issue';
import { GenderBiasAnalysisDialogComponent } from 'app/shared/gender-bias-analysis/gender-bias-analysis-dialog/gender-bias-analysis-dialog';

describe('GenderBiasAnalysisDialogComponent', () => {
  let translateService: TranslateServiceMock;

  beforeEach(async () => {
    translateService = createTranslateServiceMock();
    await TestBed.configureTestingModule({
      imports: [GenderBiasAnalysisDialogComponent],
      providers: [provideTranslateMock(translateService), provideFontAwesomeTesting(), provideNoopAnimations()],
    }).compileComponents();
  });

  function createComponentWithInputs(
    visible: boolean,
    result: BiasedIssue[] | undefined = undefined,
  ): {
    fixture: ComponentFixture<GenderBiasAnalysisDialogComponent>;
    component: GenderBiasAnalysisDialogComponent;
  } {
    const fixture = TestBed.createComponent(GenderBiasAnalysisDialogComponent);
    const componentRef = fixture.componentRef as ComponentRef<GenderBiasAnalysisDialogComponent>;
    componentRef.setInput('visible', visible);
    if (result !== undefined) {
      componentRef.setInput('result', result);
    }
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  describe('onVisibleChange', () => {
    it('should emit visibleChange and closeDialog when visibility is set to false', () => {
      const { component } = createComponentWithInputs(true);
      const visibleChangeSpy = vi.fn();
      const closeDialogSpy = vi.fn();
      component.visibleChange.subscribe(visibleChangeSpy);
      component.closeDialog.subscribe(closeDialogSpy);

      component.onVisibleChange(false);

      expect(visibleChangeSpy).toHaveBeenCalledWith(false);
      expect(closeDialogSpy).toHaveBeenCalledOnce();
    });

    it('should not emit when visibility is set to true', () => {
      const { component } = createComponentWithInputs(true);
      const visibleChangeSpy = vi.fn();
      const closeDialogSpy = vi.fn();
      component.visibleChange.subscribe(visibleChangeSpy);
      component.closeDialog.subscribe(closeDialogSpy);

      component.onVisibleChange(true);

      expect(visibleChangeSpy).not.toHaveBeenCalled();
      expect(closeDialogSpy).not.toHaveBeenCalled();
    });
  });

  describe('formulation status', () => {
    it.each([
      [
        'non-inclusive',
        [
          { word: 'leader', type: 'NON_INCLUSIVE' },
          { word: 'decisive', type: 'NON_INCLUSIVE' },
          { word: 'supportive', type: 'INCLUSIVE' },
        ],
        'NON_INCLUSIVE',
        'genderDecoder.formulationTexts.nonInclusive',
        'genderDecoder.explanations.nonInclusive',
      ],
      [
        'inclusive',
        [
          { word: 'supportive', type: 'INCLUSIVE' },
          { word: 'caring', type: 'INCLUSIVE' },
          { word: 'leader', type: 'NON_INCLUSIVE' },
        ],
        'INCLUSIVE',
        'genderDecoder.formulationTexts.inclusive',
        'genderDecoder.explanations.inclusive',
      ],
      [
        'balanced',
        [
          { word: 'leader', type: 'NON_INCLUSIVE' },
          { word: 'supportive', type: 'INCLUSIVE' },
        ],
        'NEUTRAL',
        'genderDecoder.formulationTexts.neutral',
        'genderDecoder.explanations.neutral',
      ],
      ['empty', [], undefined, 'genderDecoder.formulationTexts.neutral', 'genderDecoder.explanations.empty'],
    ])('should derive %s formulation from issue types', (_label, result, status, formulationKey, explanationKey) => {
      const { component } = createComponentWithInputs(true, result as BiasedIssue[]);

      expect(component.codingStatus()).toBe(status);
      expect(component.codingTranslationKey()).toBe(formulationKey);
      expect(component.explanationTranslationKey()).toBe(explanationKey);
    });
  });

  describe('word filters and counts', () => {
    it('should filter biased words by inclusive vs non-inclusive type', () => {
      const { component } = createComponentWithInputs(true, [
        { word: 'leader', type: 'NON_INCLUSIVE' },
        { word: 'supportive', type: 'INCLUSIVE' },
        { word: 'decisive', type: 'NON_INCLUSIVE' },
      ]);

      expect(component.nonInclusiveWords().map(issue => issue.word)).toEqual(['leader', 'decisive']);
      expect(component.inclusiveWords().map(issue => issue.word)).toEqual(['supportive']);
    });

    it('should return word counts for each type', () => {
      const { component } = createComponentWithInputs(true, [
        { word: 'leader', type: 'NON_INCLUSIVE' },
        { word: 'supportive', type: 'INCLUSIVE' },
        { word: 'leader', type: 'NON_INCLUSIVE' },
        { word: 'supportive', type: 'INCLUSIVE' },
        { word: 'caring', type: 'INCLUSIVE' },
      ]);

      expect(component.nonInclusiveWordCounts().get('leader')).toBe(2);
      expect(component.inclusiveWordCounts().get('supportive')).toBe(2);
      expect(component.inclusiveWordCounts().get('caring')).toBe(1);
    });

    it('should ignore undefined and empty words when counting', () => {
      const { component } = createComponentWithInputs(true, [
        { word: undefined, type: 'NON_INCLUSIVE' },
        { word: '', type: 'NON_INCLUSIVE' },
        { word: 'leader', type: 'NON_INCLUSIVE' },
      ]);

      const counts = component.nonInclusiveWordCounts();

      expect(counts.get(undefined as unknown as string)).toBeUndefined();
      expect(counts.get('')).toBeUndefined();
      expect(counts.get('leader')).toBe(1);
    });
  });

  describe('component inputs', () => {
    it('should accept visible input', () => {
      const { component } = createComponentWithInputs(true);
      expect(component.visible()).toBe(true);
    });

    it('should default result to an empty array', () => {
      const { component } = createComponentWithInputs(true, undefined);
      expect(component.result()).toEqual([]);
    });

    it('should change visible input value', () => {
      const { fixture, component } = createComponentWithInputs(true);
      expect(component.visible()).toBe(true);

      const componentRef = fixture.componentRef as ComponentRef<GenderBiasAnalysisDialogComponent>;
      componentRef.setInput('visible', false);
      fixture.detectChanges();

      expect(component.visible()).toBe(false);
    });
  });
});
