import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateService } from '@ngx-translate/core';
import { TooltipModule } from 'primeng/tooltip';
import { ContentChange, QuillEditorComponent } from 'ngx-quill';
import { FormsModule } from '@angular/forms';
import { extractTextFromHtml } from 'app/shared/util/text.util';
import { GenderBiasAnalysisService } from 'app/shared/gender-bias-analysis/gender-bias-analysis';
import { GenderBiasAnalysisResponse } from 'app/generated/model/gender-bias-analysis-response';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { franc } from 'franc-min';
import Quill from 'quill';
import { GenderBiasAnalysisDialogComponent } from 'app/shared/gender-bias-analysis/gender-bias-analysis-dialog/gender-bias-analysis-dialog';
import { InfoIconComponent } from 'app/shared/components/atoms/info-icon/info-icon.component';
import { ChangeDetectorRef } from '@angular/core';
import { viewChild } from '@angular/core';
import { TranslateDirective } from 'app/shared/language';
import { ComplianceIssueCategoryEnum, ComplianceIssueCategoryEnumValues } from 'app/generated/model/compliance-issue';

import { BaseInputDirective } from '../base-input/base-input.component';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Quill.import() returns unknown; no public type for inline blots
const Inline = Quill.import('blots/inline') as any;

/**
 * Custom Quill Blot for highlighting text with Tailwind utility classes.
 * This teaches Quill how to render our custom compliance highlights safely
 * without destroying the classes when the user types in the editor.
 */
class HighlightBlot extends Inline {
  // unique ID used to trigger editor.formatText()
  static blotName = 'customHighlight';
  // HTML tag that will wrap the highlighted text
  static tagName = 'span';
  // CSS class that allows Quill to identify elements in DOM
  static className = 'compliance-highlight';

  // Tailwind classes applied to every highlighted text span
  static baseClasses = [
    'border-b-2',
    '[border-bottom-style:solid]',
    'rounded-[var(--border-radius-xs)]',
    '[box-decoration-break:clone]',
    '[-webkit-box-decoration-break:clone]',
    'transition-colors',
    'duration-150',
    'cursor-pointer',
  ];

  // Fixed color classes for each compliance issue category.
  private static readonly categoryStyles: Record<ComplianceIssueCategoryEnum, string[]> = {
    CRITICAL_AGG: [
      '[border-bottom-color:var(--color-compliance-critical-border)]',
      'hover:[background-color:var(--color-compliance-critical-bg)]',
    ],
    TRANSPARENCY: [
      '[border-bottom-color:var(--color-compliance-transparency-border)]',
      'hover:[background-color:var(--color-compliance-transparency-bg)]',
    ],
    DSGVO_MINIMIZATION: [
      '[border-bottom-color:var(--color-compliance-dsgvo-border)]',
      'hover:[background-color:var(--color-compliance-dsgvo-bg)]',
    ],
    PUBLIC_SECTOR: [
      '[border-bottom-color:var(--color-compliance-public-sector-border)]',
      'hover:[background-color:var(--color-compliance-public-sector-bg)]',
    ],
  };

  /**
   * Factory method called by Quill to create the DOM node.
   * Applies base classes and category-specific styling, and stores
   * the category on the dataset for later retrieval by formats()
   * @param value The highlight's color scheme
   */
  static create(value: { category: ComplianceIssueCategoryEnum }): HTMLElement {
    const node = super.create() as HTMLElement;
    const classes = HighlightBlot.baseClasses.concat(HighlightBlot.categoryStyles[value.category]);
    classes.forEach((cls: string) => node.classList.add(cls));
    node.dataset['category'] = value.category;
    return node;
  }

  static formats(node: HTMLElement): { category: ComplianceIssueCategoryEnum } | undefined {
    const data = node.dataset['category'];
    const category = ComplianceIssueCategoryEnumValues.find(value => value === data);
    if (category === undefined) return undefined;
    return { category };
  }
}

// Register in Quill so the editor recognizes it
Quill.register(HighlightBlot);

const STANDARD_CHARACTER_LIMIT = 500;
const STANDARD_CHARACTER_BUFFER = 300;

@Component({
  selector: 'jhi-editor',
  imports: [
    CommonModule,
    QuillEditorComponent,
    FontAwesomeModule,
    FormsModule,
    TooltipModule,
    GenderBiasAnalysisDialogComponent,
    InfoIconComponent,
    TranslateDirective,
  ],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.scss',
})
export class EditorComponent extends BaseInputDirective<string> {
  characterCount = computed(() => extractTextFromHtml(this.htmlValue()).length);
  fieldId = input<string>('default');
  characterLimit = input<number | undefined>(STANDARD_CHARACTER_LIMIT); // Optionally set maximum character limit
  height = input<string>('12.5rem');
  helperText = input<string | undefined>(undefined); // Optional helper text to display below the editor field
  showGenderDecoderButton = input<boolean>(false);
  // When true the editor is showing externally-streamed content (e.g. an AI
  // translation); the empty/required error is suppressed so it does not flash
  // while the first chunks arrive.
  loading = input<boolean>(false);
  genderDecoderClick = output<string>();
  openAnalysisDialog = output<GenderBiasAnalysisResponse>();
  quillEditorComponent = viewChild(QuillEditorComponent);
  highlightHovered = output<{ text: string; x: number; y: number } | undefined>();
  pendingHighlights = signal<{ text: string; category: ComplianceIssueCategoryEnum }[]>([]);

  readonly genderBiasService = inject(GenderBiasAnalysisService);
  readonly translateService = inject(TranslateService);
  readonly cdRef = inject(ChangeDetectorRef);

  readonly fieldIdChanges$ = toObservable(this.fieldId);

  readonly analysisResult = toSignal(this.fieldIdChanges$.pipe(switchMap(fieldId => this.genderBiasService.getAnalysisForField(fieldId))), {
    initialValue: undefined,
  });

  showAnalysisModal = signal(false);

  displayHelperText = computed(() => {
    this.langChange();
    const value = this.helperText();
    return value === undefined ? '' : this.translate.instant(value);
  });

  readonly shouldShowButton = computed(() => {
    return this.showGenderDecoderButton() && this.analysisResult() !== undefined;
  });

  // Check if error message should be displayed
  isOverCharLimit = computed(() => {
    const limit = this.characterLimit();
    if (limit === undefined) {
      return false;
    }
    const count = this.characterCount();
    return count - limit >= STANDARD_CHARACTER_BUFFER;
  });
  isEmpty = computed(() => !this.loading() && extractTextFromHtml(this.htmlValue()) === '' && !this.isFocused() && this.isTouched());

  errorMessage = computed(() => {
    this.langChange();

    if (this.isEmpty() && this.required()) {
      return this.translate.instant('global.input.error.required');
    }
    if (this.isOverCharLimit() && this.characterLimit() !== undefined) {
      return this.translate.instant('global.input.error.maxLength', { max: this.characterLimit() });
    }
    return null;
  });

  charCounterColor = computed(() => {
    const limit = this.characterLimit();
    if (limit === undefined) {
      return '';
    }

    const count = this.characterCount();
    const over = count - limit;

    if (over > 0 && over < STANDARD_CHARACTER_BUFFER) {
      return 'text-warning';
    } else if (over >= STANDARD_CHARACTER_BUFFER) {
      return 'text-negative';
    }
    return ''; // default character count color
  });

  editorValue = computed(() => {
    if (this.hasFormControl()) {
      return this.formControl().value ?? '';
    } else {
      return this.model();
    }
  });

  readonly codingDisplay = computed(() => {
    this.langChange();
    const result = this.analysisResult();
    if (result?.coding === undefined) return null;

    const coding = result.coding;
    const key = this.getCodingTranslationKey(coding);
    return this.translateService.instant(key);
  });

  public quillModules = {
    clipboard: {
      matchers: [
        [
          Node.ELEMENT_NODE,
          (_node: HTMLElement, delta: { ops: { insert?: string | object; attributes?: Record<string, unknown> }[] }) => {
            delta.ops.forEach(op => {
              if (op.attributes) {
                const oldAttrs = op.attributes;
                const newAttrs: Record<string, unknown> = {};

                // List of formatting keys we explicitly allow
                const allowed = ['bold', 'italic', 'underline', 'link', 'list', 'header', 'align'];

                for (const key of allowed) {
                  if (Object.prototype.hasOwnProperty.call(oldAttrs, key)) {
                    newAttrs[key] = oldAttrs[key];
                  }
                }

                // Reassign the filtered object or remove attributes entirely
                if (Object.keys(newAttrs).length > 0) {
                  op.attributes = newAttrs;
                } else {
                  op.attributes = undefined;
                }
              }
            });
            return delta;
          },
        ],
      ],
    },
  };

  protected currentLang = toSignal(this.translate.onLangChange.pipe(map(e => e.lang)), { initialValue: this.translate.getCurrentLang() });

  private htmlValue = signal('');
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  private hasFormControl = computed(() => !!this.formControl());

  private syncHtmlValueEffect = effect(() => {
    const currentEditorValue = this.editorValue();
    this.htmlValue.set(currentEditorValue);
  });

  private analyzeEffect = effect(() => {
    if (!this.showGenderDecoderButton()) return;

    const html = this.htmlValue();
    const plainText = extractTextFromHtml(html);

    const detectedLangCode = franc(plainText);
    const lang = this.mapToLanguageCode(detectedLangCode);

    const id = this.fieldId();

    this.genderBiasService.triggerAnalysis(id, html, lang);
  });

  /**
   * Re-runs highlight application whenever:
   * - the QuillEditor view child becomes available
   * - forceUpdate pushes new content (via editorReady)
   * - new highlights are requested via highlightTexts()
   */
  private reapplyHighlightsEffect = effect(() => {
    this.quillEditorComponent();
    this.pendingHighlights();
    requestAnimationFrame(() => this.applyPendingHighlights());
  });

  textChanged(event: ContentChange): void {
    const { source, oldDelta, editor } = event;

    const limit = this.characterLimit();
    // Only check limit if it is defined
    if (limit !== undefined) {
      const maxChars = limit + STANDARD_CHARACTER_BUFFER;
      if (source !== 'user') {
        // Allow programmatic changes but still update htmlValue
        const html = this.stripHighlightMarkup(editor.root.innerHTML);
        this.htmlValue.set(html);
        return;
      }
      const oldTextLength = extractTextFromHtml(this.htmlValue()).length;
      const newTextLength = extractTextFromHtml(editor.root.innerHTML).length;
      // Only block if user is adding text and exceeds limit
      // Always allow deletions (newTextLength < oldTextLength)
      if (newTextLength > maxChars && newTextLength > oldTextLength) {
        const range = editor.getSelection();
        editor.setContents(oldDelta, 'silent');
        if (range) {
          editor.setSelection(range.index, range.length, 'silent');
        }
        return;
      }
    }

    const html = this.stripHighlightMarkup(editor.root.innerHTML);
    this.htmlValue.set(html);

    const ctrl = this.formControl();
    if (this.hasFormControl()) {
      if (ctrl.value !== html) {
        ctrl.patchValue(html, { emitEvent: false });
      }
      ctrl.markAsDirty();
      ctrl.updateValueAndValidity();
    } else {
      this.modelChange.emit(html);
    }
    this.isTouched.set(true);
  }

  onGenderDecoderClick(): void {
    const result = this.analysisResult();
    if (result) {
      this.showAnalysisModal.set(true);
    }
  }

  closeAnalysisModal(): void {
    this.showAnalysisModal.set(false);
  }

  /**
   * Forces the editor to display new HTML content.
   *
   * Quill doesn't update when you change the form value directly,
   * so this method manually converts the HTML and pushes it into the editor.
   *
   * @param newValue The HTML content to display in editor
   * @param onComplete Optional callback fired after Quill finishes updating the DOM.
   *
   */
  public forceUpdate(newValue: string, onComplete?: () => void): void {
    this.htmlValue.set(newValue);

    const editor = this.quillEditorComponent()?.quillEditor;
    if (!editor) {
      // Quill instance isn't created yet, retry on next frame
      requestAnimationFrame(() => this.forceUpdate(newValue, onComplete));
      return;
    }

    // Preserve cursor/selection if editor currently focused
    const hadFocus = editor.hasFocus();
    const range = hadFocus ? editor.getSelection() : null;

    const content = editor.clipboard.convert({ html: newValue });
    editor.setContents(content, 'api');

    // Restore selection (clamp to doc length)
    if (hadFocus && range) {
      const len = editor.getLength();
      const index = Math.min(range.index, Math.max(0, len - 1));
      editor.setSelection(index, range.length, 'silent');
    }

    this.cdRef.markForCheck();

    if (onComplete) {
      requestAnimationFrame(() => onComplete());
    }
  }

  /**
   * Stores highlights to be applied to the editor.
   *
   * @param highlights Array of {text, category} to highlight
   */
  public highlightTexts(highlights: { text: string; category: ComplianceIssueCategoryEnum }[]): void {
    this.pendingHighlights.set(highlights);
  }

  /**
   * Applies the currently pending highlights to the Quill editor.
   */
  public applyPendingHighlights(): void {
    const editor = this.quillEditorComponent()?.quillEditor;
    // Retry next frame if editor not ready and highlights pending
    if (!editor) {
      if (this.pendingHighlights().length > 0) {
        requestAnimationFrame(() => this.applyPendingHighlights());
      }
      return;
    }
    const highlights = this.pendingHighlights();

    // Clear all existing highlights first
    editor.formatText(0, editor.getLength(), 'background', false);
    editor.formatText(0, editor.getLength(), 'customHighlight', false);

    const fullText = editor.getText().toLowerCase();

    for (const { text, category } of highlights) {
      const searchText = text.toLowerCase();
      let startIndex = 0;

      // Find and highlight all occurrences of the snippet in the editor
      while (startIndex < fullText.length) {
        const index = fullText.indexOf(searchText, startIndex);
        if (index === -1) break;
        editor.formatText(index, text.length, 'customHighlight', { category });
        startIndex = index + text.length;
      }
    }
  }

  /**
   * Sends the text and position of a highlighted item
   * when the mouse hovers over it, so a popover can be shown.
   *
   * @param e - mouse event from the editor. e.target should be the highlighted span.
   */
  onEditorMouseOver(e: Event): void {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.classList.contains('compliance-highlight')) {
      const rect = target.getBoundingClientRect();
      this.highlightHovered.emit({
        text: target.innerText,
        x: rect.left,
        y: rect.bottom + 1,
      });
    }
  }

  /**
   * Clears the active popover when cursor leaves a highlighted span.
   *
   * @param e - mouse event from the editor. Only handled if e.target has the "compliance-highlight" class.
   */
  onEditorMouseOut(e: Event): void {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.classList.contains('compliance-highlight')) {
      this.highlightHovered.emit(undefined);
    }
  }

  /**
   * Removes compliance-highlight span wrappers from serialized editor HTML while
   * keeping their inner content. Highlights are a visual-only overlay, so their
   * markup must never reach the form control or model value.
   *
   * @param html - The raw editor HTML, possibly containing highlight spans
   * @returns The HTML with all compliance-highlight wrappers unwrapped
   */
  private stripHighlightMarkup(html: string): string {
    if (!html.includes(HighlightBlot.className)) return html;
    const container = document.createElement('div');
    container.innerHTML = html;
    container.querySelectorAll(`span.${HighlightBlot.className}`).forEach(span => {
      const parent = span.parentNode;
      if (!parent) return;
      // Unwrap the highlight span: move each child out in place, then drop the span.
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
    });
    return container.innerHTML;
  }

  private mapToLanguageCode(francCode: string): string {
    const validCodes = ['deu', 'eng', 'und'] as const;

    if (!validCodes.includes(francCode as 'deu' | 'eng' | 'und')) {
      return this.currentLang();
    }

    switch (francCode) {
      case 'deu':
        return 'de';
      case 'eng':
        return 'en';
      case 'und':
        return this.currentLang();
      default:
        return this.currentLang();
    }
  }

  private getCodingTranslationKey(coding: string): string {
    switch (coding) {
      case 'non-inclusive-coded':
        return 'genderDecoder.formulationTexts.nonInclusive';
      case 'inclusive-coded':
        return 'genderDecoder.formulationTexts.inclusive';
      case 'neutral':
        return 'genderDecoder.formulationTexts.neutral';
      case 'empty':
        return 'genderDecoder.formulationTexts.neutral';
      default:
        return 'genderDecoder.formulationTexts.neutral';
    }
  }
}

// TODO: implement placeholder text as HTML
