import { hasText } from 'app/shared/util/text.util';
import { Component, computed, input, output } from '@angular/core';
import { FontAwesomeModule, IconDefinition } from '@fortawesome/angular-fontawesome';
import { faCircleCheck, faScaleBalanced, faTriangleExclamation, faVenusMars } from '@fortawesome/free-solid-svg-icons';
import { DialogComponent } from 'app/shared/components/atoms/dialog/dialog.component';
import TranslateDirective from 'app/shared/language/translate.directive';
import { BiasedIssueDTO as BiasedIssue } from 'app/generated/model/biased-issue-dto';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { TagColor, TagComponent } from 'app/shared/components/atoms/tag/tag.component';
import { DialogIconHeaderComponent } from 'app/shared/components/molecules/dialog-icon-header/dialog-icon-header.component';
import { IconIntroComponent } from 'app/shared/components/molecules/icon-intro/icon-intro.component';
import { computeCodingStatus } from 'app/shared/gender-bias-analysis/gender-bias-analysis.utils';

/** A found word and how often the posting uses it. */
interface WordCount {
  word: string;
  count: number;
}

/** One bordered panel listing the words of a single bias type. */
interface WordPanel {
  icon: IconDefinition;
  iconClass: string;
  labelKey: string;
  total: number;
  words: WordCount[];
}

/** Shows the result of the gender bias analysis: the overall wording, what it means and the words found per type. */
@Component({
  selector: 'jhi-gender-bias-analysis-dialog',
  standalone: true,
  imports: [
    FontAwesomeModule,
    DialogComponent,
    ButtonComponent,
    TagComponent,
    DialogIconHeaderComponent,
    IconIntroComponent,
    TranslateDirective,
  ],
  templateUrl: './gender-bias-analysis-dialog.html',
})
export class GenderBiasAnalysisDialogComponent {
  visible = input.required<boolean>();
  result = input<BiasedIssue[]>([]);

  visibleChange = output<boolean>();
  closeDialog = output();

  readonly faVenusMars = faVenusMars;

  readonly codingStatus = computed(() => computeCodingStatus(this.result()));

  readonly codingIcon = computed(() => {
    switch (this.codingStatus()) {
      case 'NON_INCLUSIVE':
        return faTriangleExclamation;
      case 'INCLUSIVE':
        return faCircleCheck;
      default:
        return faScaleBalanced;
    }
  });

  readonly codingTagColor = computed<TagColor>(() => {
    switch (this.codingStatus()) {
      case 'NON_INCLUSIVE':
        return 'warn';
      case 'INCLUSIVE':
        return 'success';
      default:
        return 'info';
    }
  });

  readonly codingTranslationKey = computed(() => {
    switch (this.codingStatus()) {
      case 'NON_INCLUSIVE':
        return 'genderDecoder.formulationTexts.nonInclusive';
      case 'INCLUSIVE':
        return 'genderDecoder.formulationTexts.inclusive';
      default:
        return 'genderDecoder.formulationTexts.neutral';
    }
  });

  readonly explanationTranslationKey = computed(() => {
    switch (this.codingStatus()) {
      case 'NON_INCLUSIVE':
        return 'genderDecoder.explanations.nonInclusive';
      case 'INCLUSIVE':
        return 'genderDecoder.explanations.inclusive';
      default:
        return this.result().length === 0 ? 'genderDecoder.explanations.empty' : 'genderDecoder.explanations.neutral';
    }
  });

  readonly nonInclusiveWords = computed(() => {
    return this.result().filter(bias => bias.type === 'NON_INCLUSIVE');
  });

  readonly inclusiveWords = computed(() => {
    return this.result().filter(bias => bias.type === 'INCLUSIVE');
  });

  readonly nonInclusiveWordCounts = computed(() => {
    return this.getWordCounts(this.nonInclusiveWords());
  });

  readonly inclusiveWordCounts = computed(() => {
    return this.getWordCounts(this.inclusiveWords());
  });

  readonly wordPanels = computed<WordPanel[]>(() => [
    {
      icon: faTriangleExclamation,
      iconClass: 'text-warning-default',
      labelKey: 'genderDecoder.nonInclusiveWords',
      total: this.nonInclusiveWords().length,
      words: this.toSortedWordCounts(this.nonInclusiveWordCounts()),
    },
    {
      icon: faCircleCheck,
      iconClass: 'text-positive-default',
      labelKey: 'genderDecoder.inclusiveWords',
      total: this.inclusiveWords().length,
      words: this.toSortedWordCounts(this.inclusiveWordCounts()),
    },
  ]);

  /**
   * Emits the close events once the dialog is hidden.
   *
   * @param isVisible the new visibility of the dialog
   */
  onVisibleChange(isVisible: boolean): void {
    if (!isVisible) {
      this.visibleChange.emit(false);
      this.closeDialog.emit();
    }
  }

  /**
   * Turns word counts into a list sorted alphabetically, for the word panels.
   *
   * @param counts the number of occurrences per word
   * @returns the words with their counts in alphabetical order
   */
  private toSortedWordCounts(counts: Map<string, number>): WordCount[] {
    return Array.from(counts, ([word, count]) => ({ word, count })).sort((first, second) => first.word.localeCompare(second.word));
  }

  /**
   * Counts how often each flagged word occurs. Words that differ only in case, such as a capitalized word at the start
   * of a sentence, count as the same word and are shown in lower case.
   *
   * @param words the flagged words of one category
   * @returns the number of occurrences per word
   */
  private getWordCounts(words: BiasedIssue[]): Map<string, number> {
    const counts = new Map<string, number>();
    words.forEach(bias => {
      if (hasText(bias.word)) {
        const word = bias.word.toLowerCase();
        counts.set(word, (counts.get(word) ?? 0) + 1);
      }
    });
    return counts;
  }
}
