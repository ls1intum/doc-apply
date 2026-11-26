import { EditorHighlight } from 'app/shared/components/atoms/editor/editor.component';
import { ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { JobCreationFormComponent } from 'app/job/job-creation-form/job-creation-form.component';
import {
  ComplianceIssueDTO as ComplianceIssue,
  ComplianceIssueDTOCategoryEnum as ComplianceIssueCategoryEnum,
} from 'app/generated/model/compliance-issue-dto';
import { ComplianceIssueActionEnum } from 'app/generated/model/compliance-issue';
import { unescapeJsonString } from 'app/shared/util/util';
import { createAccountServiceMock } from '../../../util/account.service.mock';
import { createToastServiceMock } from '../../../util/toast-service.mock';
import { createRouterMock } from '../../../util/router.mock';
import { createLocationMock } from '../../../util/location.mock';
import { createActivatedRouteMock } from '../../../util/activated-route.mock';
import { createJobResourceApiMock } from '../../../util/job-resource-api.service.mock';
import { createImageResourceApiMock } from '../../../util/image-resource-api.service.mock';
import { createAiStreamingServiceMock } from '../../../util/ai-streaming.service.mock';
import { createUserResourceApiMock } from '../../../util/user-resource-api.service.mock';
import { createResearchGroupResourceApiMock } from '../../../util/research-group-resource-api.service.mock';

import { fillValidJobForm, getPrivate, setupJobCreationForm } from './job-creation-form.test-setup';

describe('JobCreationFormComponent AI and compliance', () => {
  let fixture: ComponentFixture<JobCreationFormComponent>;
  let component: JobCreationFormComponent;
  let mockJobApi: ReturnType<typeof createJobResourceApiMock>;
  let mockImageApi: ReturnType<typeof createImageResourceApiMock>;
  let mockAccountService: ReturnType<typeof createAccountServiceMock>;
  let mockToastService: ReturnType<typeof createToastServiceMock>;
  let mockRouter: ReturnType<typeof createRouterMock>;
  let mockLocation: ReturnType<typeof createLocationMock>;
  let mockActivatedRoute: ReturnType<typeof createActivatedRouteMock>;
  let mockAiStreamingService: ReturnType<typeof createAiStreamingServiceMock>;
  let mockResearchGroupApi: ReturnType<typeof createResearchGroupResourceApiMock>;
  let mockUserApi: ReturnType<typeof createUserResourceApiMock>;

  beforeEach(async () => {
    const context = await setupJobCreationForm();
    fixture = context.fixture;
    component = context.component;
    mockJobApi = context.mockJobApi;
    mockImageApi = context.mockImageApi;
    mockAccountService = context.mockAccountService;
    mockToastService = context.mockToastService;
    mockRouter = context.mockRouter;
    mockLocation = context.mockLocation;
    mockActivatedRoute = context.mockActivatedRoute;
    mockAiStreamingService = context.mockAiStreamingService;
    mockResearchGroupApi = context.mockResearchGroupApi;
    mockUserApi = context.mockUserApi;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    fixture?.destroy();
  });

  describe('Utility / AI helpers', () => {
    it.each([
      { id: 'issue-1', expectedKey: 'de|issue-1' },
      { id: undefined, expectedKey: 'de|dynamisch' },
    ])('should keep an issue with ID $id dismissed when mapping replaces its object', ({ id, expectedKey }) => {
      const issue: ComplianceIssue = {
        id,
        language: 'de',
        text: 'dynamisch',
        category: ComplianceIssueCategoryEnum.CriticalAgg,
      };
      const mockEditor = { highlightTexts: vi.fn() };
      Object.defineProperty(component, 'jobDescriptionEditor', { value: () => mockEditor, configurable: true });
      component.currentDescriptionLanguage.set('de');
      component.complianceIssues.set([issue]);

      component.onComplianceIssueDismissed(issue);
      component.onComplianceIssueDismissed(issue);
      component.complianceIssues.set([
        {
          id: issue.id,
          language: issue.language,
          text: issue.text,
          category: issue.category,
        },
      ]);
      getPrivate(component).refreshComplianceHighlights();

      expect(component.dismissedComplianceHighlights()).toEqual([expectedKey]);
      expect(mockEditor.highlightTexts).toHaveBeenLastCalledWith([]);
    });

    it.each([
      { filter: undefined, expectedGenderWords: ['dominant'] },
      { filter: ComplianceIssueCategoryEnum.CriticalAgg, expectedGenderWords: [] },
    ])('should add flagged gender words to the highlights only without a category filter ($filter)', ({ filter, expectedGenderWords }) => {
      const issue: ComplianceIssue = { id: 'issue-1', language: 'en', text: 'young', category: ComplianceIssueCategoryEnum.CriticalAgg };
      const mockEditor = { highlightTexts: vi.fn() };
      Object.defineProperty(component, 'jobDescriptionEditor', { value: () => mockEditor, configurable: true });
      component.currentDescriptionLanguage.set('en');
      component.complianceIssues.set([issue]);
      component.biasedIssues.set([{ word: 'dominant', type: 'NON_INCLUSIVE', language: 'en' }]);
      component.activeComplianceFilter.set(filter);

      getPrivate(component).refreshComplianceHighlights();

      const highlights: EditorHighlight[] = mockEditor.highlightTexts.mock.lastCall?.[0] ?? [];
      expect(highlights.filter(highlight => highlight.kind === 'compliance').map(highlight => highlight.text)).toEqual(['young']);
      expect(highlights.filter(highlight => highlight.kind === 'genderBias').map(highlight => highlight.text)).toEqual(expectedGenderWords);
    });

    it('should open the popover for a highlight piece that another highlight split off', () => {
      const issue: ComplianceIssue = {
        id: 'issue-1',
        language: 'en',
        text: 'he should have strong leadership skills',
        category: ComplianceIssueCategoryEnum.CriticalAgg,
      };
      component.currentDescriptionLanguage.set('en');
      component.complianceIssues.set([issue]);

      component.onHighlightHovered({ text: 'he should have strong ', key: 'en|issue-1', x: 10, y: 20 });

      expect(component.activePopoverIssue()).toEqual(issue);
    });

    it('should apply a mapped replacement to both languages without translating again', async () => {
      component.jobId.set('job1');
      component.currentDescriptionLanguage.set('en');
      const englishIssue: ComplianceIssue = {
        id: 'issue-1',
        language: 'en',
        text: 'young, dynamic',
        suggestion: 'experienced, diverse',
        action: ComplianceIssueActionEnum.Replace,
      };
      const germanIssue: ComplianceIssue = {
        id: englishIssue.id,
        action: englishIssue.action,
        language: 'de',
        text: 'jungen, dynamischen',
        suggestion: 'erfahrenen, vielfältigen',
      };
      const updatedEnglish = '<p>We seek an experienced, diverse candidate.</p>';
      const mockEditor = {
        getPlainText: vi.fn().mockReturnValue('We seek a young, dynamic candidate.\n'),
        applyTextEdit: vi.fn().mockReturnValue(updatedEnglish),
        highlightTexts: vi.fn(),
      };
      Object.defineProperty(component, 'jobDescriptionEditor', { value: () => mockEditor, configurable: true });
      component.jobDescriptionEN.set('<p>We seek a young, dynamic candidate.</p>');
      component.jobDescriptionDE.set('<p>Wir suchen einen <strong>jungen, dynamischen</strong> Kandidaten.</p>');
      component.complianceIssues.set([englishIssue, germanIssue]);

      component.onComplianceSuggestionAccepted(englishIssue);
      await getPrivate(component).translateAndStoreOtherLanguage('en', updatedEnglish, Promise.resolve([]));

      expect(component.jobDescriptionEN()).toBe(updatedEnglish);
      expect(component.jobDescriptionDE()).toBe('<p>Wir suchen einen <strong>erfahrenen, vielfältigen</strong> Kandidaten.</p>');
      expect(component.complianceIssues()).toEqual([]);
      expect(mockAiStreamingService.translateJobDescriptionStream).not.toHaveBeenCalled();
    });

    it("should use Quill's index coordinates instead of the HTML signal when computing the edit", () => {
      const issue: ComplianceIssue = {
        text: 'target',
        suggestion: 'replacement',
        action: ComplianceIssueActionEnum.Replace,
        language: 'en',
      };
      const mockEditor = {
        getPlainText: vi.fn().mockReturnValue('First paragraph.\nSecond target paragraph.\n'),
        applyTextEdit: vi.fn().mockReturnValue('<p>First paragraph.</p><p>Second replacement paragraph.</p>'),
        highlightTexts: vi.fn(),
      };
      Object.defineProperty(component, 'jobDescriptionEditor', { value: () => mockEditor, configurable: true });

      component.onComplianceSuggestionAccepted(issue);

      expect(mockEditor.applyTextEdit).toHaveBeenCalledWith({ index: 24, deleteLength: 6, insert: 'replacement' });
    });

    it('should check the description again after a suggestion was applied', async () => {
      const issue: ComplianceIssue = {
        text: 'target',
        suggestion: 'replacement',
        action: ComplianceIssueActionEnum.Replace,
        language: 'en',
      };
      const mockEditor = {
        getPlainText: vi.fn().mockReturnValue('A target text.\n'),
        applyTextEdit: vi.fn().mockReturnValue('<p>A replacement text.</p>'),
        highlightTexts: vi.fn(),
      };
      Object.defineProperty(component, 'jobDescriptionEditor', { value: () => mockEditor, configurable: true });
      const reanalyze = vi.spyOn(component, 'reanalyze').mockResolvedValue();

      component.onComplianceSuggestionAccepted(issue);

      await vi.waitFor(() => expect(reanalyze).toHaveBeenCalledOnce());
    });

    it('should not apply an ADD suggestion when its snippet is missing', () => {
      const issue: ComplianceIssue = {
        text: 'missing',
        suggestion: 'addition',
        action: ComplianceIssueActionEnum.Add,
        language: 'en',
      };
      const mockEditor = {
        getPlainText: vi.fn().mockReturnValue('Existing text.\n'),
        applyTextEdit: vi.fn(),
      };
      Object.defineProperty(component, 'jobDescriptionEditor', { value: () => mockEditor, configurable: true });

      component.onComplianceSuggestionAccepted(issue);

      expect(mockEditor.applyTextEdit).not.toHaveBeenCalled();
    });

    it.each([
      { options: [{ value: 'x' }], search: 'y', expected: undefined },
      { options: [{ value: 'a' }, { value: 'b' }], search: 'b', expected: { value: 'b' } },
    ])('findDropdownOption returns $expected', ({ options, search, expected }) => {
      expect(getPrivate(component).findDropdownOption(options, search)).toEqual(expected);
    });

    it.each([
      ['', null],
      ['   ', null],
      ['{"jobDescription":"<p>Test content</p>"}', '<p>Test content</p>'],
      ['{"jobDescription":"Line1\\nLine2\\tTabbed"}', 'Line1\nLine2\tTabbed'],
      ['{"jobDescription":"He said \\"Hello\\""}', 'He said "Hello"'],
      ['{"jobDescription":"<p>Partial content', '<p>Partial content'],
      ['<p>Plain HTML content</p>', '<p>Plain HTML content</p>'],
    ])('extractJobDescriptionFromStream(%j) -> %j', (input, expected) => {
      expect(getPrivate(component).extractJobDescriptionFromStream(input as string)).toBe(expected as string | null);
    });

    it.each([
      ['Line1\\nLine2', 'Line1\nLine2'],
      ['Line1\\rLine2', 'Line1\rLine2'],
      ['Col1\\tCol2', 'Col1\tCol2'],
      ['He said \\"Hi\\"', 'He said "Hi"'],
      ['Plain text', 'Plain text'],
    ])('unescapeJsonString(%j) -> %j', (input, expected) => {
      expect(unescapeJsonString(input)).toBe(expected);
    });
  });

  describe('generateJobApplicationDraft', () => {
    function setupGen() {
      component.jobId.set('job123');
      fillValidJobForm(component);
      const mockEditor = {
        forceUpdate: vi.fn((_content: string, onComplete?: () => void) => onComplete?.()),
        forceStreamingUpdate: vi.fn((_content: string, onComplete?: () => void) => onComplete?.()),
      };
      Object.defineProperty(component, 'jobDescriptionEditor', {
        value: () => mockEditor,
        configurable: true,
      });
      return mockEditor;
    }

    it('should toast error on failure and restore content', async () => {
      const editor = setupGen();
      const original = '<p>Original content</p>';
      component.basicInfoForm.get('jobDescription')?.setValue(original);
      mockAiStreamingService.generateJobApplicationDraftStream.mockRejectedValue(new Error('Generic error'));

      await component.generateJobApplicationDraft();

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('jobCreationForm.toastMessages.saveFailed');
      const lastCall = editor.forceUpdate.mock.calls[editor.forceUpdate.mock.calls.length - 1];
      expect(lastCall[0]).toBe(original);
      expect(component.rewriteButtonSignal()).toBe(true);
    });

    it('should cancel translation when in flight', async () => {
      setupGen();
      component.isTranslating.set(true);
      const cancelSpy = vi.spyOn(component as unknown as { cancelTranslation: () => void }, 'cancelTranslation');
      mockAiStreamingService.generateJobApplicationDraftStream.mockRejectedValue(new Error('fail'));
      await component.generateJobApplicationDraft();
      expect(cancelSpy).toHaveBeenCalledOnce();
    });

    it('should reset the AI workflow even when no translation is in flight', async () => {
      setupGen();
      component.isTranslating.set(false);
      const cancelSpy = vi.spyOn(component as unknown as { cancelTranslation: () => void }, 'cancelTranslation');
      mockAiStreamingService.generateJobApplicationDraftStream.mockRejectedValue(new Error('fail'));
      await component.generateJobApplicationDraft();
      expect(cancelSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Language switching', () => {
    it('should not run a save when switching languages with no pending edits', () => {
      getPrivate(component).autoSaveInitialized = true;
      component.autoSave.reset();
      component.currentDescriptionLanguage.set('en');
      const flushSpy = vi.spyOn(component.autoSave, 'flush');

      component.changeDescriptionLanguage('de');

      expect(flushSpy).not.toHaveBeenCalled();
      expect(component.currentDescriptionLanguage()).toBe('de');
    });

    it('should flush pending edits before switching languages', () => {
      getPrivate(component).autoSaveInitialized = true;
      component.currentDescriptionLanguage.set('en');
      component.autoSave.notifyChanged();
      const flushSpy = vi.spyOn(component.autoSave, 'flush').mockResolvedValue();

      component.changeDescriptionLanguage('de');

      expect(flushSpy).toHaveBeenCalledOnce();
      expect(component.currentDescriptionLanguage()).toBe('de');
    });
  });

  describe('Translation and compliance', () => {
    it('should apply an accepted source action after target mapping finishes', async () => {
      component.jobId.set('job1');
      component.currentDescriptionLanguage.set('en');
      component.lastTranslatedEN.set('');
      let resolveTranslation: (translation: string) => void = () => undefined;
      mockAiStreamingService.translateJobDescriptionStream.mockReturnValue(
        new Promise(resolve => {
          resolveTranslation = resolve;
        }),
      );

      const sourceIssue: ComplianceIssue = {
        id: 'issue-1',
        text: 'young candidate',
        suggestion: 'experienced candidate',
        action: ComplianceIssueActionEnum.Replace,
        language: 'en',
      };
      const mappedIssue: ComplianceIssue = {
        id: sourceIssue.id,
        action: sourceIssue.action,
        text: 'jungen Kandidaten',
        suggestion: 'erfahrenen Kandidaten',
        language: 'de',
      };
      vi.spyOn(getPrivate(component).aiApi, 'mapComplianceIssues').mockReturnValue(of([mappedIssue]));
      vi.spyOn(component.autoSave, 'notifyChanged').mockImplementation(() => undefined);
      const mockEditor = {
        getPlainText: vi.fn().mockReturnValue('We seek a young candidate.\n'),
        applyTextEdit: vi.fn().mockReturnValue('<p>We seek an experienced candidate.</p>'),
        highlightTexts: vi.fn(),
        forceUpdate: vi.fn(),
      };
      Object.defineProperty(component, 'jobDescriptionEditor', { value: () => mockEditor, configurable: true });
      component.jobDescriptionEN.set('<p>We seek a young candidate.</p>');
      component.jobDescriptionDE.set('');
      component.complianceIssues.set([sourceIssue]);

      const mapping = getPrivate(component).translateAndStoreOtherLanguage(
        'en',
        '<p>We seek a young candidate.</p>',
        Promise.resolve([sourceIssue]),
      );
      await new Promise(resolve => setTimeout(resolve, 0));
      component.onComplianceSuggestionAccepted(sourceIssue);
      resolveTranslation('{"translatedText":"<p>Wir suchen einen jungen Kandidaten.</p>"}');
      await mapping;

      expect(component.jobDescriptionEN()).toBe('<p>We seek an experienced candidate.</p>');
      expect(component.jobDescriptionDE()).toBe('<p>Wir suchen einen erfahrenen Kandidaten.</p>');
      expect(component.complianceIssues()).toEqual([]);
      expect(mockAiStreamingService.translateJobDescriptionStream).toHaveBeenCalledOnce();
    });
    it('should map source issues after translation without running target compliance analysis', async () => {
      component.jobId.set('job1');
      component.currentDescriptionLanguage.set('en');
      component.lastTranslatedEN.set('');
      mockAiStreamingService.translateJobDescriptionStream.mockResolvedValue('{"translatedText":"<p>Hallo</p>"}');

      const sourceIssue: ComplianceIssue = { text: 'Hello', language: 'en' };
      const mappedIssue: ComplianceIssue = { text: 'Hallo', language: 'de' };
      let resolveAnalysis: (issues: ComplianceIssue[]) => void = () => undefined;
      const sourceIssues = new Promise<ComplianceIssue[]>(resolve => {
        resolveAnalysis = resolve;
      });
      const mapSpy = vi.spyOn(getPrivate(component).aiApi, 'mapComplianceIssues').mockReturnValue(of([mappedIssue]));

      const promise = getPrivate(component).translateAndStoreOtherLanguage('en', '<p>Hello</p>', sourceIssues);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(component.isTranslating()).toBe(false);
      expect(mapSpy).not.toHaveBeenCalled();

      resolveAnalysis([sourceIssue]);
      await promise;

      expect(mapSpy).toHaveBeenCalledWith({
        toLang: 'de',
        jobId: 'job1',
        text: 'Hello',
        translatedText: 'Hallo',
        complianceIssues: [sourceIssue],
      });
      expect(component.complianceIssues()).toEqual([mappedIssue]);
    });

    it('should skip translation when the source text matches the last translated baseline', async () => {
      component.jobId.set('job1');
      component.currentDescriptionLanguage.set('en');
      component.lastTranslatedEN.set('Hello EN');

      await getPrivate(component).translateAndStoreOtherLanguage('en', 'Hello EN', Promise.resolve([]));

      expect(mockAiStreamingService.translateJobDescriptionStream).not.toHaveBeenCalled();
      expect(component.isTranslating()).toBe(false);
    });

    it('should ignore a compliance result after a newer AI workflow starts', async () => {
      component.jobId.set('job1');
      fillValidJobForm(component);
      component.aiScore.set(100);
      const pendingAnalysis = new Subject<never>();
      vi.spyOn(getPrivate(component).aiApi, 'analyzeJobDescriptionForCompliance').mockReturnValue(pendingAnalysis.asObservable());

      const analysis = getPrivate(component).analyzeAndUpdateScore('en');
      getPrivate(component).startAiRun();
      await analysis;

      expect(component.aiScore()).toBe(100);
      expect(mockToastService.showErrorKey).not.toHaveBeenCalledWith('jobCreationForm.toastMessages.aiComplianceFailed');
    });

    it('should not show an error when translation is cancelled by a newer workflow', async () => {
      component.jobId.set('job1');
      component.currentDescriptionLanguage.set('en');
      mockAiStreamingService.translateJobDescriptionStream.mockImplementation(
        (_targetLang: string, _text: string, _jobId: string | undefined, _onChunk: (content: string) => void, signal: AbortSignal) =>
          new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new TypeError('cancelled')))),
      );

      const translation = getPrivate(component).translateAndStoreOtherLanguage('en', 'Hello', Promise.resolve([]));
      getPrivate(component).startAiRun();
      await translation;

      expect(mockToastService.showErrorKey).not.toHaveBeenCalledWith('jobCreationForm.toastMessages.aiTranslationFailed');
    });

    it('should not show an error when the server reports superseded analysis', async () => {
      component.jobId.set('job1');
      fillValidJobForm(component);
      vi.spyOn(getPrivate(component).aiApi, 'analyzeJobDescriptionForCompliance').mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 409, statusText: 'Conflict' })),
      );

      await getPrivate(component).analyzeAndUpdateScore('en');

      expect(mockToastService.showErrorKey).not.toHaveBeenCalledWith('jobCreationForm.toastMessages.aiComplianceFailed');
    });

    it('should not show an error when the form is left while the analysis runs', async () => {
      component.jobId.set('job1');
      fillValidJobForm(component);
      const pendingAnalysis = new Subject<never>();
      vi.spyOn(getPrivate(component).aiApi, 'analyzeJobDescriptionForCompliance').mockReturnValue(pendingAnalysis.asObservable());

      const analysis = getPrivate(component).analyzeAndUpdateScore('en');
      fixture.destroy();
      await analysis;

      expect(mockToastService.showErrorKey).not.toHaveBeenCalledWith('jobCreationForm.toastMessages.aiComplianceFailed');
    });

    it('should show an error when the analysis fails on the server', async () => {
      component.jobId.set('job1');
      fillValidJobForm(component);
      vi.spyOn(getPrivate(component).aiApi, 'analyzeJobDescriptionForCompliance').mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' })),
      );

      await getPrivate(component).analyzeAndUpdateScore('en');

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('jobCreationForm.toastMessages.aiComplianceFailed');
    });

    it.each(['templateEN', 'templateDE'])('should not analyze a description that is only the default %s', async templateKey => {
      component.jobId.set('job1');
      fillValidJobForm(component);
      const template = `jobCreationForm.positionDetailsSection.jobDescription.${templateKey}`;
      component.jobDescriptionEN.set(`<p>${template}</p>`);
      component.basicInfoForm.patchValue({ jobDescription: `<p>${template}</p>` });
      component.jobDescriptionSignal.set(`<p>${template}</p>`);
      const analyze = vi.spyOn(getPrivate(component).aiApi, 'analyzeJobDescriptionForCompliance');

      await getPrivate(component).analyzeAndUpdateScore('en');

      expect(analyze).not.toHaveBeenCalled();
    });

    it('should map newly analyzed issues without translating synchronized descriptions again', async () => {
      component.jobId.set('job1');
      component.currentDescriptionLanguage.set('en');
      component.jobDescriptionEN.set('<p>Hello dynamic team.</p>');
      component.jobDescriptionDE.set('<p>Hallo dynamisches Team.</p>');
      component.lastTranslatedEN.set('<p>Hello dynamic team.</p>');
      const sourceIssue: ComplianceIssue = { id: 'new-issue', text: 'dynamic', language: 'en' };
      const mappedIssue: ComplianceIssue = { id: 'new-issue', text: 'dynamisches', language: 'de' };
      component.complianceIssues.set([sourceIssue]);
      const mapSpy = vi.spyOn(getPrivate(component).aiApi, 'mapComplianceIssues').mockReturnValue(of([mappedIssue]));

      await getPrivate(component).translateAndStoreOtherLanguage('en', '<p>Hello dynamic team.</p>', Promise.resolve([sourceIssue]));

      expect(mockAiStreamingService.translateJobDescriptionStream).not.toHaveBeenCalled();
      expect(mapSpy).toHaveBeenCalledWith({
        toLang: 'de',
        jobId: 'job1',
        text: 'Hello dynamic team.',
        translatedText: 'Hallo dynamisches Team.',
        complianceIssues: [sourceIssue],
      });
      expect(component.complianceIssues()).toEqual([sourceIssue, mappedIssue]);
    });
  });
});
