import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorComponent } from 'app/shared/components/atoms/editor/editor.component';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { extractTextFromHtml } from 'app/shared/util/text.util';
import { provideHttpClientMock } from 'util/http-client.mock';
import {
  createGenderBiasAnalysisServiceMock,
  GenderBiasAnalysisServiceMock,
  provideGenderBiasAnalysisServiceMock,
} from 'util/gender-bias-analysis.service.mock';
import { BehaviorSubject } from 'rxjs';
import { GenderBiasAnalysisResponse } from 'app/generated/model/gender-bias-analysis-response';
import { ContentChange } from 'ngx-quill';

function makeEditorEvent(html: string, overrides: Partial<unknown> = {}): ContentChange {
  const plainText = extractTextFromHtml(html);
  return {
    source: 'user',
    content: { ops: [] },
    delta: { ops: [] },
    oldDelta: { ops: [] },
    html: html,
    text: plainText,
    editor: Object.assign(
      {
        root: { innerHTML: html },
        getSelection: () => ({ index: 0, length: 0 }),
        setContents: vi.fn(),
        setSelection: vi.fn(),
        getText: () => plainText,
        getLength: () => plainText.length,
      },
      overrides,
    ),
  } as unknown as ContentChange;
}

describe('EditorComponent', () => {
  let genderBiasService: GenderBiasAnalysisServiceMock;
  let analysisSubject: BehaviorSubject<GenderBiasAnalysisResponse | undefined>;

  function createFixture() {
    const fixture = TestBed.createComponent(EditorComponent);
    fixture.componentRef.setInput('label', 'Description');
    fixture.componentRef.setInput('required', true);
    fixture.componentRef.setInput('characterLimit', 100);
    fixture.componentRef.setInput('helperText', 'editor.helper.text');
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    analysisSubject = new BehaviorSubject<GenderBiasAnalysisResponse | undefined>(undefined);
    genderBiasService = createGenderBiasAnalysisServiceMock();
    vi.mocked(genderBiasService.getAnalysisForField).mockReturnValue(analysisSubject.asObservable());

    await TestBed.configureTestingModule({
      imports: [EditorComponent, ReactiveFormsModule],
      providers: [
        provideFontAwesomeTesting(),
        provideTranslateMock(),
        provideHttpClientMock(),
        provideGenderBiasAnalysisServiceMock(genderBiasService),
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic functionality', () => {
    it.each([
      ['<p>ABC</p>', 3, '', false],
      ['<p>' + 'x'.repeat(500) + '</p>', 500, 'text-negative', true],
      ['<p>' + 'x'.repeat(120) + '</p>', 120, 'text-warning', false],
      ['<p>short text</p>', 'short text'.length, '', false],
    ])('should compute character count, color and over-limit state for %s', async (html, count, color, over) => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;
      const htmlSignal = (comp as unknown as { htmlValue: { set: (v: string) => void } }).htmlValue;
      htmlSignal.set(html);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(comp.characterCount()).toBe(count);
      expect(comp.charCounterColor()).toBe(color);
      expect(comp.isOverCharLimit()).toBe(over);
    });
  });

  describe('Error handling', () => {
    it('should not flag empty content as an error while loading (AI streaming)', () => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;

      (comp as unknown as { htmlValue: { set: (v: string) => void } }).htmlValue.set('<p></p>');
      vi.spyOn(comp, 'isFocused').mockReturnValue(false);
      vi.spyOn(comp, 'isTouched').mockReturnValue(true);

      fixture.componentRef.setInput('loading', false);
      expect(comp.isEmpty()).toBe(true);

      fixture.componentRef.setInput('loading', true);
      expect(comp.isEmpty()).toBe(false);
    });

    it('should return required error when input is empty and required is true', () => {
      const fixture = TestBed.createComponent(EditorComponent);
      const comp = fixture.componentInstance;

      fixture.componentRef.setInput('required', true);

      (comp as unknown as { htmlValue: { set: (v: string) => void } }).htmlValue.set('');

      vi.spyOn(comp, 'isFocused').mockReturnValue(false);
      vi.spyOn(comp, 'isTouched').mockReturnValue(true);

      const translateSpy = vi.spyOn(comp['translate'], 'instant').mockReturnValue('required-message');

      const msg = comp.errorMessage();

      expect(msg).toBe('required-message');
      expect(translateSpy).toHaveBeenCalledWith('global.input.error.required');
    });
  });

  describe('Form control integration', () => {
    it('should patch form control when formControl exists', () => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;
      const ctrl = new FormControl('');
      vi.spyOn(comp, 'formControl').mockReturnValue(ctrl);
      vi.spyOn(comp as unknown as { hasFormControl: () => boolean }, 'hasFormControl').mockReturnValue(true);

      (comp as unknown as { textChanged: (e: unknown) => void }).textChanged(makeEditorEvent('<p>Updated</p>'));
      expect(ctrl.value).toBe('<p>Updated</p>');
      expect(ctrl.dirty).toBe(true);
    });

    it('should strip compliance-highlight spans before writing to the form control', () => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;
      const ctrl = new FormControl('');
      vi.spyOn(comp, 'formControl').mockReturnValue(ctrl);
      vi.spyOn(comp as unknown as { hasFormControl: () => boolean }, 'hasFormControl').mockReturnValue(true);

      const highlighted = '<p>Hello <span class="compliance-highlight border-b-2" data-category="CRITICAL_AGG">young</span> world</p>';
      (comp as unknown as { textChanged: (e: unknown) => void }).textChanged(makeEditorEvent(highlighted));

      expect(ctrl.value).toBe('<p>Hello young world</p>');
    });

    it('should keep inner formatting when stripping a compliance-highlight span', () => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;
      const ctrl = new FormControl('');
      vi.spyOn(comp, 'formControl').mockReturnValue(ctrl);
      vi.spyOn(comp as unknown as { hasFormControl: () => boolean }, 'hasFormControl').mockReturnValue(true);

      const highlighted = '<p><span class="compliance-highlight" data-category="TRANSPARENCY"><strong>Bold</strong></span> text</p>';
      (comp as unknown as { textChanged: (e: unknown) => void }).textChanged(makeEditorEvent(highlighted));

      expect(ctrl.value).toBe('<p><strong>Bold</strong> text</p>');
    });

    it('should return empty string from editorValue when formControl value is null', () => {
      const fixture = TestBed.createComponent(EditorComponent);
      const comp = fixture.componentInstance;
      vi.spyOn(comp, 'formControl').mockReturnValue(new FormControl(null));

      expect(comp.editorValue()).toBe('');
    });

    it('should fall back to model() and emit modelChange when no formControl is present', () => {
      const fixture = TestBed.createComponent(EditorComponent);
      const comp = fixture.componentInstance;

      vi.spyOn(comp as unknown as { hasFormControl: () => boolean }, 'hasFormControl').mockReturnValue(false);
      vi.spyOn(comp, 'model').mockReturnValue('<p>Model content</p>');
      const emitSpy = vi.spyOn(comp.modelChange, 'emit');

      expect(comp.editorValue()).toBe('<p>Model content</p>');

      (comp as unknown as { textChanged: (e: unknown) => void }).textChanged(makeEditorEvent('<p>Standalone test</p>'));
      expect(emitSpy).toHaveBeenCalledWith('<p>Standalone test</p>');
    });
  });

  describe('Text change handling', () => {
    it('should not react when source is not user', () => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;
      const emitSpy = vi.spyOn(comp.modelChange, 'emit');

      (comp as unknown as { textChanged: (e: unknown) => void }).textChanged({
        source: 'api',
        oldDelta: {},
        editor: { root: { innerHTML: '<p>Ignored</p>' } },
      });

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it.each([
      ['custom characterLimit', 'createFixture' as const, 1000],
      ['default characterLimit', 'default' as const, 900],
    ])('should truncate when text exceeds buffer (%s)', (_desc, fixtureType, charCount) => {
      const fixture = fixtureType === 'createFixture' ? createFixture() : TestBed.createComponent(EditorComponent);
      const comp = fixture.componentInstance;
      const event = makeEditorEvent('<p>' + 'x'.repeat(charCount) + '</p>');

      (comp as unknown as { textChanged: (e: unknown) => void }).textChanged(event);

      expect(event.editor.setContents).toHaveBeenCalledOnce();
      expect(event.editor.setSelection).toHaveBeenCalledOnce();
    });
  });

  describe('Character limit edge cases', () => {
    it('should not truncate text when characterLimit is undefined', async () => {
      const fixture = TestBed.createComponent(EditorComponent);
      const comp = fixture.componentInstance;

      fixture.componentRef.setInput('characterLimit', undefined);
      fixture.detectChanges();
      await fixture.whenStable();

      const event = makeEditorEvent('<p>' + 'x'.repeat(560) + '</p>');

      (comp as unknown as { textChanged: (e: unknown) => void }).textChanged(event);

      expect(event.editor.setContents).not.toHaveBeenCalled();
      expect(event.editor.setSelection).not.toHaveBeenCalled();
    });
  });

  describe('codingDisplay computed', () => {
    it.each([
      [undefined, null],
      [{} as GenderBiasAnalysisResponse, null],
      [{ coding: 'non-inclusive-coded', words: [] } as GenderBiasAnalysisResponse, 'genderDecoder.formulationTexts.nonInclusive'],
      [{ coding: 'inclusive-coded', words: [] } as GenderBiasAnalysisResponse, 'genderDecoder.formulationTexts.inclusive'],
      [{ coding: 'neutral', words: [] } as GenderBiasAnalysisResponse, 'genderDecoder.formulationTexts.neutral'],
      [{ coding: 'empty', words: [] } as GenderBiasAnalysisResponse, 'genderDecoder.formulationTexts.neutral'],
    ])('should map %o to %s', (analysisResult, expected) => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;

      vi.spyOn(comp, 'analysisResult').mockReturnValue(analysisResult);
      fixture.detectChanges();

      expect(comp.codingDisplay()).toBe(expected);
    });
  });

  describe('shouldShowButton computed', () => {
    it.each([
      [false, { coding: 'neutral', words: [] } as GenderBiasAnalysisResponse, false],
      [true, undefined, false],
      [true, { coding: 'neutral', words: [] } as GenderBiasAnalysisResponse, true],
    ])('should derive shouldShowButton from input=%s and analysisResult=%o', (input, analysisResult, expected) => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;

      fixture.componentRef.setInput('showGenderDecoderButton', input);
      vi.spyOn(comp, 'analysisResult').mockReturnValue(analysisResult);
      fixture.detectChanges();

      expect(comp.shouldShowButton()).toBe(expected);
    });
  });

  describe('analysis modal handlers', () => {
    it('should toggle showAnalysisModal when analysisResult exists, ignore click when undefined, and reset on close', () => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;

      vi.spyOn(comp, 'analysisResult').mockReturnValue({ coding: 'non-inclusive-coded', words: [] } as GenderBiasAnalysisResponse);
      comp.onGenderDecoderClick();
      expect(comp.showAnalysisModal()).toBe(true);

      comp.closeAnalysisModal();
      expect(comp.showAnalysisModal()).toBe(false);

      vi.mocked(comp.analysisResult).mockReturnValue(undefined);
      comp.onGenderDecoderClick();
      expect(comp.showAnalysisModal()).toBe(false);
    });
  });

  describe('mapToLanguageCode', () => {
    it.each([
      ['deu', 'de'],
      ['eng', 'en'],
      ['und', 'en'],
      ['spa', 'en'],
    ])('should map franc code %s to %s', (code, expected) => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;

      expect(comp['mapToLanguageCode'](code)).toBe(expected);
    });

    it('should hit default case in switch statement', () => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;

      const originalIncludes = Array.prototype.includes;
      const patchedIncludes = function (this: unknown[], searchElement: unknown): boolean {
        if (this === Array.prototype) {
          return originalIncludes.call(this, searchElement);
        }
        if (this.length === 3 && searchElement === 'xyz') {
          return true;
        }
        return originalIncludes.call(this, searchElement);
      };
      Object.defineProperty(Array.prototype, 'includes', { value: patchedIncludes, configurable: true, writable: true });

      const result = comp['mapToLanguageCode']('xyz');
      expect(result).toBe('en');

      Object.defineProperty(Array.prototype, 'includes', { value: originalIncludes, configurable: true, writable: true });
    });
  });

  describe('analyzeEffect', () => {
    it('should not trigger analysis when showGenderDecoderButton is false', async () => {
      const fixture = createFixture();

      fixture.componentRef.setInput('showGenderDecoderButton', false);
      fixture.detectChanges();
      await fixture.whenStable();

      const event = makeEditorEvent('<p>Some text</p>');
      (fixture.componentInstance as unknown as { textChanged: (e: unknown) => void }).textChanged(event);
      await fixture.whenStable();

      expect(genderBiasService.triggerAnalysis).not.toHaveBeenCalled();
    });
  });

  describe('Clipboard Text Styling', () => {
    it.each([
      {
        name: 'filter attributes to the allowed list',
        input: {
          ops: [
            { insert: 'x', attributes: { bold: true, italic: false, color: 'red', unknown: 1, align: 'center', background: '#fff' } },
            { insert: 'Click Me', attributes: { link: 'https://vitest.dev', header: 1, bad: 'style' } },
          ],
        },
        expected: [
          { insert: 'x', attributes: { bold: true, italic: false, align: 'center' } },
          { insert: 'Click Me', attributes: { link: 'https://vitest.dev', header: 1 } },
        ],
      },
      {
        name: 'remove attributes when none are allowed',
        input: { ops: [{ insert: 'x', attributes: { color: 'red', style: 'foo' } }] },
        expected: [{ insert: 'x', attributes: undefined }],
      },
      {
        name: 'return the same if no attributes present',
        input: { ops: [{ insert: 'plain text' }] },
        expected: [{ insert: 'plain text' }],
      },
    ])('should $name', ({ input, expected }) => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;

      const matcherFn = comp.quillModules.clipboard.matchers[0][1];
      if (typeof matcherFn !== 'function') {
        throw new Error('Expected clipboard matcher to be a function');
      }
      const result = matcherFn(document.createElement('div'), input);

      expect(result.ops).toEqual(expected);
    });
  });
});
