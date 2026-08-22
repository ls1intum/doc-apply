import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorComponent } from 'app/shared/components/atoms/editor/editor.component';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { extractTextFromHtml } from 'app/shared/util/text.util';
import { provideHttpClientMock } from 'util/http-client.mock';
import { BiasedIssueDTO as BiasedIssue } from 'app/generated/model/biased-issue-dto';
import { ContentChange, QuillEditorComponent } from 'ngx-quill';
import { TranslateService } from '@ngx-translate/core';
import Quill from 'quill';
import Delta from 'quill-delta';

function makeEditorEvent(html: string, source: ContentChange['source'] = 'user'): ContentChange {
  const plainText = extractTextFromHtml(html);
  const editor = new Quill(document.createElement('div'));
  editor.root.innerHTML = html;
  vi.spyOn(editor, 'setContents').mockImplementation(() => new Delta());
  vi.spyOn(editor, 'setSelection').mockImplementation(() => undefined);
  vi.spyOn(editor, 'getSelection').mockReturnValue({ index: 0, length: 0 });
  return {
    source,
    content: new Delta(),
    delta: new Delta(),
    oldDelta: new Delta(),
    html: html,
    text: plainText,
    editor,
  };
}

describe('EditorComponent', () => {
  function createFixture() {
    const fixture = TestBed.createComponent(EditorComponent);
    fixture.componentRef.setInput('label', 'Description');
    fixture.componentRef.setInput('required', true);
    fixture.componentRef.setInput('characterLimit', 100);
    fixture.componentRef.setInput('helperText', 'editor.helper.text');
    fixture.detectChanges();
    return fixture;
  }

  function setBiasedAnalysis(fixture: ComponentFixture<EditorComponent>, biasedAnalysis: BiasedIssue[] | undefined): void {
    fixture.componentRef.setInput('biasedAnalysis', biasedAnalysis);
    fixture.detectChanges();
  }

  function setEditorValue(fixture: ComponentFixture<EditorComponent>, value: string): void {
    fixture.componentRef.setInput('model', value);
    fixture.detectChanges();
  }

  function emitContentChange(fixture: ComponentFixture<EditorComponent>, event: ContentChange): void {
    fixture.debugElement.query(By.directive(QuillEditorComponent)).triggerEventHandler('onContentChanged', event);
    fixture.detectChanges();
  }

  function blurEditor(fixture: ComponentFixture<EditorComponent>): void {
    fixture.debugElement.query(By.css('.input-wrapper')).triggerEventHandler('focusout', new FocusEvent('focusout'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorComponent, ReactiveFormsModule],
      providers: [provideFontAwesomeTesting(), provideTranslateMock(), provideHttpClientMock()],
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
      setEditorValue(fixture, html);
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

      setEditorValue(fixture, '<p></p>');
      blurEditor(fixture);

      fixture.componentRef.setInput('loading', false);
      expect(comp.isEmpty()).toBe(true);

      fixture.componentRef.setInput('loading', true);
      expect(comp.isEmpty()).toBe(false);
    });

    it('should return required error when input is empty and required is true', () => {
      const translateSpy = vi.spyOn(TestBed.inject(TranslateService), 'instant').mockReturnValue('required-message');
      const fixture = TestBed.createComponent(EditorComponent);
      const comp = fixture.componentInstance;

      fixture.componentRef.setInput('required', true);

      setEditorValue(fixture, '');
      blurEditor(fixture);

      const msg = comp.errorMessage();

      expect(msg).toBe('required-message');
      expect(translateSpy).toHaveBeenCalledWith('global.input.error.required');
    });
  });

  describe('Form control integration', () => {
    it('should patch form control when formControl exists', () => {
      const fixture = createFixture();
      const ctrl = new FormControl('');
      fixture.componentRef.setInput('control', ctrl);
      fixture.detectChanges();

      emitContentChange(fixture, makeEditorEvent('<p>Updated</p>'));
      expect(ctrl.value).toBe('<p>Updated</p>');
      expect(ctrl.dirty).toBe(true);
    });

    it('should keep highlight markup out of the form control when the editor content changes', () => {
      const fixture = createFixture();
      const control = new FormControl('<p>a young team</p>');
      fixture.componentRef.setInput('control', control);
      fixture.detectChanges();
      const highlighted =
        '<p>a <span class="compliance-highlight" data-category="CRITICAL_AGG">young</span>, ' +
        '<span class="gender-bias-highlight" data-gender-bias-highlight="non-inclusive">dominant</span> candidate</p>';
      const editor = fixture.debugElement.query(By.css('quill-editor'));

      expect(editor).not.toBeNull();
      editor.triggerEventHandler('onContentChanged', makeEditorEvent(highlighted));

      expect(control.value).toBe('<p>a young, dominant candidate</p>');
    });

    it('should keep inner formatting when stripping a compliance-highlight span', () => {
      const fixture = createFixture();
      const ctrl = new FormControl('');
      fixture.componentRef.setInput('control', ctrl);
      fixture.detectChanges();

      const highlighted = '<p><span class="compliance-highlight" data-category="TRANSPARENCY"><strong>Bold</strong></span> text</p>';
      emitContentChange(fixture, makeEditorEvent(highlighted));

      expect(ctrl.value).toBe('<p><strong>Bold</strong> text</p>');
    });

    it('should return empty string from editorValue when formControl value is null', () => {
      const fixture = TestBed.createComponent(EditorComponent);
      const comp = fixture.componentInstance;
      fixture.componentRef.setInput('control', new FormControl(null));
      fixture.detectChanges();

      expect(comp.editorValue()).toBe('');
    });

    it('should fall back to model() and emit modelChange when no formControl is present', () => {
      const fixture = TestBed.createComponent(EditorComponent);
      const comp = fixture.componentInstance;

      setEditorValue(fixture, '<p>Model content</p>');
      const emitSpy = vi.spyOn(comp.modelChange, 'emit');

      expect(comp.editorValue()).toBe('<p>Model content</p>');

      emitContentChange(fixture, makeEditorEvent('<p>Standalone test</p>'));
      expect(emitSpy).toHaveBeenCalledWith('<p>Standalone test</p>');
    });
  });

  describe('Text change handling', () => {
    it('should not react when source is not user', () => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;
      const emitSpy = vi.spyOn(comp.modelChange, 'emit');

      emitContentChange(fixture, makeEditorEvent('<p>Ignored</p>', 'api'));

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it.each([
      ['custom characterLimit', 'createFixture' as const, 1000],
      ['default characterLimit', 'default' as const, 900],
    ])('should truncate when text exceeds buffer (%s)', (_desc, fixtureType, charCount) => {
      const fixture = fixtureType === 'createFixture' ? createFixture() : TestBed.createComponent(EditorComponent);
      const event = makeEditorEvent('<p>' + 'x'.repeat(charCount) + '</p>');

      emitContentChange(fixture, event);

      expect(event.editor.setContents).toHaveBeenCalledOnce();
      expect(event.editor.setSelection).toHaveBeenCalledOnce();
    });
  });

  describe('Character limit edge cases', () => {
    it('should not truncate text when characterLimit is undefined', async () => {
      const fixture = TestBed.createComponent(EditorComponent);

      fixture.componentRef.setInput('characterLimit', undefined);
      fixture.detectChanges();
      await fixture.whenStable();

      const event = makeEditorEvent('<p>' + 'x'.repeat(560) + '</p>');

      emitContentChange(fixture, event);

      expect(event.editor.setContents).not.toHaveBeenCalled();
      expect(event.editor.setSelection).not.toHaveBeenCalled();
    });
  });

  describe('codingDisplay computed', () => {
    it.each([
      ['undefined analysis', undefined, undefined],
      ['empty analysis', [], 'genderDecoder.formulationTexts.neutral'],
      [
        'more non-inclusive than inclusive issues',
        [{ type: 'NON_INCLUSIVE' }, { type: 'NON_INCLUSIVE' }, { type: 'INCLUSIVE' }],
        'genderDecoder.formulationTexts.nonInclusive',
      ],
      [
        'more inclusive than non-inclusive issues',
        [{ type: 'INCLUSIVE' }, { type: 'INCLUSIVE' }, { type: 'NON_INCLUSIVE' }],
        'genderDecoder.formulationTexts.inclusive',
      ],
      ['balanced issues', [{ type: 'INCLUSIVE' }, { type: 'NON_INCLUSIVE' }], 'genderDecoder.formulationTexts.neutral'],
    ] as [string, BiasedIssue[] | undefined, string | undefined][])(
      'should return expected text for %s',
      (_label, biasedAnalysis, expected) => {
        const fixture = createFixture();
        const comp = fixture.componentInstance;

        setBiasedAnalysis(fixture, biasedAnalysis);

        expect(comp.codingDisplay()).toBe(expected);
      },
    );
  });

  describe('shouldShowButton computed', () => {
    it.each([
      ['showGenderDecoderButton is false', false, [{ type: 'INCLUSIVE' }], false],
      ['biasedAnalysis is undefined', true, undefined, false],
      ['biasedAnalysis is empty', true, [], true],
      ['showGenderDecoderButton is true and biasedAnalysis exists', true, [{ type: 'INCLUSIVE' }], true],
    ] as [string, boolean, BiasedIssue[] | undefined, boolean][])(
      'should return expected value when %s',
      (_label, showButton, biasedAnalysis, expected) => {
        const fixture = createFixture();
        const comp = fixture.componentInstance;

        fixture.componentRef.setInput('showGenderDecoderButton', showButton);
        setBiasedAnalysis(fixture, biasedAnalysis);

        expect(comp.shouldShowButton()).toBe(expected);
      },
    );
  });

  describe('analysis modal handlers', () => {
    it('should toggle showAnalysisModal when biasedAnalysis exists and reset on close', () => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;

      setBiasedAnalysis(fixture, [{ type: 'NON_INCLUSIVE' }]);

      comp.onGenderDecoderClick();
      expect(comp.showAnalysisModal()).toBe(true);

      comp.closeAnalysisModal();
      expect(comp.showAnalysisModal()).toBe(false);
    });

    it('should not set showAnalysisModal when biasedAnalysis is undefined', () => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;

      setBiasedAnalysis(fixture, undefined);
      comp.showAnalysisModal.set(false);
      comp.onGenderDecoderClick();
      expect(comp.showAnalysisModal()).toBe(false);
    });
  });

  describe('gender decoder editor highlights', () => {
    it('should show received gender highlights and hide them when filtered out', () => {
      const fixture = createFixture();
      const comp = fixture.componentInstance;

      fixture.componentRef.setInput('showGenderDecoderButton', true);
      setBiasedAnalysis(fixture, [{ word: 'dominant', type: 'NON_INCLUSIVE' }]);

      expect(comp.genderBiasHighlights()).toHaveLength(1);

      fixture.componentRef.setInput('showGenderBiasHighlights', false);
      fixture.detectChanges();
      expect(comp.genderBiasHighlights()).toHaveLength(0);
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
