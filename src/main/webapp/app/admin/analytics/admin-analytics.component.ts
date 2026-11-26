import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { TranslateDirective } from 'app/shared/language';
import { SegmentButtonComponent } from 'app/shared/components/atoms/segment-button/segment-button.component';
import { SelectComponent, SelectOption } from 'app/shared/components/atoms/select/select.component';
import { ProgressSpinnerComponent } from 'app/shared/components/atoms/progress-spinner/progress-spinner.component';
import { LineChartComponent, LineChartDataset } from 'app/shared/components/molecules/line-chart/line-chart.component';
import { ToastService } from 'app/service/toast-service';
import { AdminAiAnalyticsResourceApi } from 'app/generated/api/admin-ai-analytics-resource-api';
import { AiUsageAnalyticsDTO } from 'app/generated/model/ai-usage-analytics-dto';
import { AiUsageTimeRange, AiUsageTimeRangeValues } from 'app/generated/model/ai-usage-time-range';
import { AiUsageFeature } from 'app/generated/model/ai-usage-feature';
import { AiUsageSeriesDTO } from 'app/generated/model/ai-usage-series-dto';

/** A segment of the feature toggle; an undefined value stands for all features combined. */
interface FeatureOption {
  label: string;
  value: AiUsageFeature | undefined;
}

/** The AI features in toggle order, each with its i18n label. */
const FEATURES: { label: string; value: AiUsageFeature }[] = [
  { label: 'analytics.feature.jobDescriptionGeneration', value: AiUsageFeature.JobDescriptionGeneration },
  { label: 'analytics.feature.translation', value: AiUsageFeature.Translation },
  { label: 'analytics.feature.documentExtraction', value: AiUsageFeature.DocumentExtraction },
  { label: 'analytics.feature.emailTemplateTranslation', value: AiUsageFeature.EmailTemplateTranslation },
];

/** The toggle segment for all features combined. */
const ALL_OPTION: FeatureOption = { label: 'analytics.feature.all', value: undefined };

/** Line colours for the per-feature series in the combined view, all distinct from the primary colour of the total line. */
const FEATURE_LINE_COLOR_TOKENS = [
  '--color-accent-default',
  '--color-positive-default',
  '--color-warning-default',
  '--color-negative-default',
];

/**
 * Admin dashboard visualizing how often each AI feature is triggered over time.
 *
 * The server returns one trigger-count series per feature over a shared time axis, so switching
 * the feature toggle is a client-side swap; only changing the time range refetches. The "All" view
 * plots the total next to every feature and shows global stats; a single feature narrows chart and
 * stats to that feature.
 */
@Component({
  selector: 'jhi-admin-analytics',
  standalone: true,
  imports: [
    DecimalPipe,
    TranslateDirective,
    TranslateModule,
    SegmentButtonComponent,
    SelectComponent,
    ProgressSpinnerComponent,
    LineChartComponent,
  ],
  templateUrl: './admin-analytics.component.html',
})
export class AdminAnalyticsComponent {
  /** Currently selected time window. */
  readonly range = signal<AiUsageTimeRange>(AiUsageTimeRange.LastMonth);

  /** Feature whose series is currently plotted, or undefined for all features combined. */
  readonly selectedFeature = signal<AiUsageFeature | undefined>(undefined);

  /** Whether the analytics payload is being loaded. */
  readonly isLoading = signal(false);

  /** The latest analytics payload from the server. */
  readonly analytics = signal<AiUsageAnalyticsDTO | undefined>(undefined);

  /** Time-range options shown in the range dropdown. */
  readonly rangeOptions: SelectOption[] = [
    { name: 'analytics.range.lastDay', value: AiUsageTimeRange.LastDay },
    { name: 'analytics.range.lastWeek', value: AiUsageTimeRange.LastWeek },
    { name: 'analytics.range.lastMonth', value: AiUsageTimeRange.LastMonth },
    { name: 'analytics.range.lastThreeMonths', value: AiUsageTimeRange.LastThreeMonths },
    { name: 'analytics.range.allTime', value: AiUsageTimeRange.AllTime },
  ];

  /** Feature toggle options, led by the combined "All" view. */
  readonly featureOptions: FeatureOption[] = [ALL_OPTION].concat(FEATURES);

  /** The dropdown option matching the active range. */
  readonly selectedRangeOption = computed(() => this.rangeOptions.find(option => option.value === this.range()) ?? this.rangeOptions[0]);

  /** X-axis labels for the chart. */
  readonly chartLabels = computed(() => this.analytics()?.labels ?? []);

  /** Whether the combined view over all features is active. */
  readonly isAllSelected = computed(() => this.selectedFeature() === undefined);

  /** The series of the selected feature, or undefined in the combined view. */
  readonly selectedSeries = computed<AiUsageSeriesDTO | undefined>(() => {
    const feature = this.selectedFeature();
    return feature === undefined ? undefined : this.findSeries(feature);
  });

  /** Trigger counts per time bucket summed over all features. */
  readonly totalCounts = computed<number[]>(() => {
    const totals = this.chartLabels().map(() => 0);
    for (const entry of this.analytics()?.series ?? []) {
      (entry.counts ?? []).forEach((count, index) => {
        totals[index] = (totals[index] ?? 0) + count;
      });
    }
    return totals;
  });

  /** The total line plus one line per feature in the combined view, or the selected feature's line. */
  readonly chartDatasets = computed<LineChartDataset[]>(() => {
    const series = this.selectedSeries();
    if (series !== undefined) {
      return [{ label: this.translateService.instant('analytics.chart.triggers'), data: (series.counts ?? []).slice() }];
    }
    const totalLine: LineChartDataset = {
      label: this.translateService.instant('analytics.chart.total'),
      data: this.totalCounts(),
      colorVar: '--color-primary-default',
    };
    const featureLines = FEATURES.map<LineChartDataset>((feature, index) => ({
      label: this.translateService.instant(feature.label),
      data: (this.findSeries(feature.value)?.counts ?? []).slice(),
      colorVar: FEATURE_LINE_COLOR_TOKENS[index % FEATURE_LINE_COLOR_TOKENS.length],
    }));
    return [totalLine].concat(featureLines);
  });

  /** Total triggers across all features in the selected range. */
  readonly totalTriggers = computed(() => this.totalCounts().reduce((sum, count) => sum + count, 0));

  /** Total "Write with DocApply" generations in the selected range. */
  readonly generationTotal = computed(() => this.sum(this.findSeries(AiUsageFeature.JobDescriptionGeneration)?.counts));

  /** Total AI translations in the selected range. */
  readonly translationTotal = computed(() => this.sum(this.findSeries(AiUsageFeature.Translation)?.counts));

  /** Total applicant extractions in the selected range. */
  readonly extractionTotal = computed(() => this.sum(this.findSeries(AiUsageFeature.DocumentExtraction)?.counts));

  /** Total automatic email template translations in the selected range. */
  readonly emailTemplateTranslationTotal = computed(() => this.sum(this.findSeries(AiUsageFeature.EmailTemplateTranslation)?.counts));

  /** Currency of the estimated cost. */
  readonly currency = computed(() => this.analytics()?.cost?.currency ?? '');

  /** Triggers in the active view: all features combined or the selected feature only. */
  readonly calls = computed(() => {
    const series = this.selectedSeries();
    return series === undefined ? this.totalTriggers() : this.sum(series.counts);
  });

  /** Failed triggers in the active view. */
  readonly failedCalls = computed(() => {
    const series = this.selectedSeries();
    if (series !== undefined) {
      return this.sum(series.failureCounts);
    }
    return (this.analytics()?.series ?? []).reduce((sum, entry) => sum + this.sum(entry.failureCounts), 0);
  });

  /** Successful triggers in the active view. */
  readonly successfulCalls = computed(() => this.calls() - this.failedCalls());

  /** Share of successful triggers in the active view, as a percentage (100 when there are no calls). */
  readonly successRate = computed(() => {
    const total = this.calls();
    return total > 0 ? (100 * this.successfulCalls()) / total : 100;
  });

  /** Tokens consumed in the active view. */
  readonly tokensUsed = computed(() => {
    const series = this.selectedSeries();
    return series === undefined ? (this.analytics()?.cost?.totalTokens ?? 0) : (series.totalTokens ?? 0);
  });

  /** Estimated cost of the active view. */
  readonly estimatedCost = computed(() => {
    const series = this.selectedSeries();
    return series === undefined ? (this.analytics()?.cost?.estimatedCost ?? 0) : (series.estimatedCost ?? 0);
  });

  /** Label of the call count card: the overall total in the combined view, the feature's calls otherwise. */
  readonly callsLabelKey = computed(() => (this.isAllSelected() ? 'analytics.stats.totalCalls' : 'analytics.stats.calls'));

  /** Text colour of the failed calls count, highlighted only when calls failed. */
  readonly failedCallsClass = computed(
    () => `text-3xl font-bold ${this.failedCalls() > 0 ? 'text-negative-default' : 'text-text-primary'}`,
  );

  private readonly analyticsApi = inject(AdminAiAnalyticsResourceApi);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  constructor() {
    void this.loadAnalytics();
  }

  /** Fetches usage analytics for the currently selected range. */
  async loadAnalytics(): Promise<void> {
    this.isLoading.set(true);
    try {
      const result = await firstValueFrom(this.analyticsApi.getAiUsage(this.range()));
      this.analytics.set(result);
    } catch {
      this.toastService.showErrorKey('analytics.toast.loadError');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Handles a range dropdown change and refetches.
   *
   * @param option the newly selected range option
   */
  onRangeChange(option: SelectOption | undefined): void {
    const range = AiUsageTimeRangeValues.find(value => value === option?.value);
    if (range === undefined) {
      return;
    }
    this.range.set(range);
    void this.loadAnalytics();
  }

  /**
   * Switches the plotted feature without refetching.
   *
   * @param feature the feature to plot, or undefined for all features combined
   */
  onFeatureChange(feature: AiUsageFeature | undefined): void {
    this.selectedFeature.set(feature);
  }

  /**
   * Looks up the series of a single feature.
   *
   * @param feature the feature to look up
   * @returns the feature's series, or undefined when the server sent none
   */
  private findSeries(feature: AiUsageFeature): AiUsageSeriesDTO | undefined {
    return this.analytics()?.series?.find(entry => entry.feature === feature);
  }

  /**
   * Adds up a list of per-bucket counts.
   *
   * @param counts the counts to add up
   * @returns their sum, or 0 when there are none
   */
  private sum(counts: number[] | undefined): number {
    return (counts ?? []).reduce((total, count) => total + count, 0);
  }
}
