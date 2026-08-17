import { CommonModule } from '@angular/common';
import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateDirective } from 'app/shared/language';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { ProgressSpinnerComponent } from 'app/shared/components/atoms/progress-spinner/progress-spinner.component';
import { AiScoreRingComponent } from 'app/shared/components/atoms/ai-score-ring/ai-score-ring.component';
import { DialogComponent } from 'app/shared/components/atoms/dialog/dialog.component';
import { TooltipModule } from 'primeng/tooltip';
import { ComplianceIssue, ComplianceIssueCategoryEnum } from 'app/generated/model/compliance-issue';
import { GenderBiasAnalysisResponse } from 'app/generated/model/gender-bias-analysis-response';
import { StatusPillComponent } from 'app/shared/components/atoms/status-pill/status-pill.component';
import { InfoBoxComponent } from 'app/shared/components/atoms/info-box/info-box.component';
import { InfoIconComponent } from 'app/shared/components/atoms/info-icon/info-icon.component';
import { getUniqueNonInclusiveWords } from 'app/shared/gender-bias-analysis/gender-bias-analysis.utils';

@Component({
  selector: 'jhi-ai-assistant-card',
  standalone: true,
  imports: [
    CommonModule,
    FontAwesomeModule,
    TranslateDirective,
    DialogComponent,
    TooltipModule,
    ButtonComponent,
    ProgressSpinnerComponent,
    AiScoreRingComponent,
    StatusPillComponent,
    InfoBoxComponent,
    InfoIconComponent,
  ],
  templateUrl: './ai-assistant-card.component.html',
})
export class AiAssistantCardComponent {
  // ═══════════════════════════════════════════════════════════════════════════
  // INPUTS
  // ═══════════════════════════════════════════════════════════════════════════
  score = input<number | undefined>(undefined);
  isGenerating = input<boolean>(false);
  isAnalyzing = input<boolean>(false);
  isRewriteMode = input<boolean>(false);
  buttonIcon = input<string>('custom-sparkle');
  complianceIssues = input<ComplianceIssue[]>([]);
  currentLang = input<string>('en');
  genderBiasAnalysis = input<GenderBiasAnalysisResponse | undefined>(undefined);

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════

  readonly WARNING_THRESHOLD = 50;
  readonly DANGER_THRESHOLD = 29;
  readonly EXCELLENCE_THRESHOLD = 90;

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTPUTS
  // ═══════════════════════════════════════════════════════════════════════════

  generate = output();
  filterComplianceCat = output<string | undefined>();

  // ═══════════════════════════════════════════════════════════════════════════
  // SIGNALS
  // ═══════════════════════════════════════════════════════════════════════════

  readonly activeFilter = signal<string | undefined>(undefined);
  readonly displayedScore = signal<number | undefined>(undefined);
  readonly scoreDialogVisible = signal(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED
  // ═══════════════════════════════════════════════════════════════════════════

  /** Whether the score ring should appear greyed out (generating or analyzing) */
  readonly isScoreLoading = computed(() => this.isGenerating() || this.isAnalyzing());

  readonly boundedScore = computed(() => {
    const value = this.score();
    if (value === undefined || !Number.isFinite(value)) {
      return undefined;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
  });

  readonly scoreFeedback = computed(() => {
    const score = this.displayedScore();
    const loading = this.isScoreLoading();

    // No score yet: show "calculating..." or "pending" depending on loading state
    if (score === undefined) {
      return loading
        ? 'jobCreationForm.positionDetailsSection.jobDescription.aiScoreFeedback.calculating'
        : 'jobCreationForm.positionDetailsSection.jobDescription.aiScoreFeedback.pending';
    }

    // Score exists but re-analysis is running: show "calculating..." alongside greyed-out score
    if (loading) {
      return 'jobCreationForm.positionDetailsSection.jobDescription.aiScoreFeedback.calculating';
    }

    if (score <= this.DANGER_THRESHOLD) {
      return 'jobCreationForm.positionDetailsSection.jobDescription.aiScoreFeedback.critical';
    }

    if (score <= this.WARNING_THRESHOLD) {
      return 'jobCreationForm.positionDetailsSection.jobDescription.aiScoreFeedback.warning';
    }

    if (score >= this.EXCELLENCE_THRESHOLD) {
      return 'jobCreationForm.positionDetailsSection.jobDescription.aiScoreFeedback.excellent';
    }

    return 'jobCreationForm.positionDetailsSection.jobDescription.aiScoreFeedback.good';
  });

  /** Compliance issues filtered to the language currently active in the editor. */
  readonly issueCountForLang = computed(() => this.complianceIssues().filter(i => i.language === this.currentLang()));

  /** Number of CRITICAL_AGG issues for the current language. */
  readonly criticalCount = computed(
    () => this.issueCountForLang().filter(i => i.category === ComplianceIssueCategoryEnum.CriticalAgg).length,
  );

  /** Number of TRANSPARENCY issues for the current language. */
  readonly transparencyCount = computed(
    () => this.issueCountForLang().filter(i => i.category === ComplianceIssueCategoryEnum.Transparency).length,
  );

  /** Number of DSGVO_MINIMIZATION issues for the current language. */
  readonly dsgvoCount = computed(
    () => this.issueCountForLang().filter(i => i.category === ComplianceIssueCategoryEnum.DsgvoMinimization).length,
  );

  /** Number of PUBLIC_SECTOR issues for the current language. */
  readonly publicSectorCount = computed(
    () => this.issueCountForLang().filter(i => i.category === ComplianceIssueCategoryEnum.PublicSector).length,
  );

  /** Position of the gender decoder pointer on the sidebar scale. */
  readonly genderDecoderPointerClass = computed(() => {
    switch (this.genderBiasAnalysis()?.coding) {
      case 'non-inclusive-coded':
        return 'left-[14%]';
      case 'inclusive-coded':
        return 'left-[86%]';
      case 'neutral':
      case 'empty':
      default:
        return 'left-1/2';
    }
  });

  readonly genderDecoderWordsToImprove = computed(() => getUniqueNonInclusiveWords(this.genderBiasAnalysis()?.biasedWords));

  readonly genderDecoderReviewCount = computed(() => this.genderDecoderWordsToImprove().length);

  protected readonly ComplianceIssueCategoryEnum = ComplianceIssueCategoryEnum;
  protected readonly genderBiasFilter = 'GENDER_BIAS';

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

  private readonly displayedScoreEffect = effect(() => {
    const loading = this.isScoreLoading();
    const score = this.boundedScore();

    if (loading) {
      return;
    }
    this.displayedScore.set(score);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Selects the given category as the active filter, or clears it if already selected. */
  selectCategoryFilter(category: string): void {
    const next = this.activeFilter() === category ? undefined : category;
    this.activeFilter.set(next);
    this.filterComplianceCat.emit(next);
  }

  onGenerate(): void {
    this.generate.emit();
  }

  openScoreDialog(): void {
    this.scoreDialogVisible.set(true);
  }

  onScoreDialogVisibleChange(isVisible: boolean): void {
    this.scoreDialogVisible.set(isVisible);
  }
}
