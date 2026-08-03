import { hasText } from 'app/shared/util/text.util';
import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { BiasedIssue } from 'app/generated/model/biased-issue';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TooltipModule } from 'primeng/tooltip';
import { InfoBoxComponent } from 'app/shared/components/atoms/info-box/info-box.component';
import { computeCodingStatus } from 'app/shared/gender-bias-analysis/gender-bias-analysis.utils';

@Component({
  selector: 'jhi-gender-bias-analysis-dialog',
  standalone: true,
  imports: [CommonModule, TranslateModule, DialogModule, FontAwesomeModule, TooltipModule, InfoBoxComponent],
  templateUrl: './gender-bias-analysis-dialog.html',
  encapsulation: ViewEncapsulation.None,
})
export class GenderBiasAnalysisDialogComponent {
  visible = input.required<boolean>();
  result = input<BiasedIssue[]>([]);

  visibleChange = output<boolean>();
  closeDialog = output();

  readonly codingStatus = computed(() => computeCodingStatus(this.result()));

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

  onVisibleChange(isVisible: boolean): void {
    if (!isVisible) {
      this.visibleChange.emit(false);
      this.closeDialog.emit();
    }
  }

  private getWordCounts(words: BiasedIssue[]): Map<string, number> {
    const counts = new Map<string, number>();
    words.forEach(bias => {
      if (bias.word) {
        const current = counts.get(bias.word) ?? 0;
        counts.set(bias.word, current + 1);
      }
    });
    return counts;
  }
}
