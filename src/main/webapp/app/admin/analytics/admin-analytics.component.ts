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
import { AiUsageTimeRange } from 'app/generated/model/ai-usage-time-range';
import { AiUsageFeature } from 'app/generated/model/ai-usage-feature';

/** A selectable AI feature paired with its i18n label for the graph toggle. */
interface FeatureOption {
  label: string;
  value: AiUsageFeature;
}

/**
 * Admin dashboard visualizing how often each AI feature is triggered over time.
 *
 * The server returns one trigger-count series per feature over a shared time axis, so switching
 * the feature toggle is a client-side swap; only changing the time range refetches.
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

  /** Feature whose series is currently plotted. */
  readonly selectedFeature = signal<AiUsageFeature>(AiUsageFeature.JobDescriptionGeneration);

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

  /** Feature toggle options. */
  readonly featureOptions: FeatureOption[] = [
    { label: 'analytics.feature.jobDescriptionGeneration', value: AiUsageFeature.JobDescriptionGeneration },
    { label: 'analytics.feature.translation', value: AiUsageFeature.Translation },
    { label: 'analytics.feature.documentExtraction', value: AiUsageFeature.DocumentExtraction },
  ];

  /** The dropdown option matching the active range. */
  readonly selectedRangeOption = computed(() => this.rangeOptions.find(option => option.value === this.range()) ?? this.rangeOptions[0]);

  /** X-axis labels for the chart. */
  readonly chartLabels = computed(() => this.analytics()?.labels ?? []);

  /** The single dataset for the currently selected feature. */
  readonly chartDatasets = computed<LineChartDataset[]>(() => {
    const series = this.analytics()?.series?.find(entry => entry.feature === this.selectedFeature());
    return [{ label: this.translateService.instant('analytics.chart.triggers'), data: [...(series?.counts ?? [])] }];
  });

  /** Total triggers across all features in the selected range. */
  readonly totalTriggers = computed(() =>
    (this.analytics()?.series ?? []).reduce((sum, entry) => sum + (entry.counts ?? []).reduce((acc, count) => acc + count, 0), 0),
  );

  /** Total "Write with TUMApply" generations in the selected range. */
  readonly generationTotal = computed(() => this.featureTotal(AiUsageFeature.JobDescriptionGeneration));

  /** Total AI translations in the selected range. */
  readonly translationTotal = computed(() => this.featureTotal(AiUsageFeature.Translation));

  /** Total applicant extractions in the selected range. */
  readonly extractionTotal = computed(() => this.featureTotal(AiUsageFeature.DocumentExtraction));

  /** Aggregate token consumption and estimated cost for the selected range. */
  readonly cost = computed(() => this.analytics()?.cost);

  /** Total failed triggers across all features in the selected range. */
  readonly failedCalls = computed(() =>
    (this.analytics()?.series ?? []).reduce((sum, entry) => sum + (entry.failureCounts ?? []).reduce((acc, count) => acc + count, 0), 0),
  );

  /** Share of successful triggers in the selected range, as a percentage (100 when there are no calls). */
  readonly successRate = computed(() => {
    const total = this.totalTriggers();
    return total > 0 ? (100 * (total - this.failedCalls())) / total : 100;
  });

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
  onRangeChange(option: SelectOption): void {
    this.range.set(option.value as AiUsageTimeRange);
    void this.loadAnalytics();
  }

  /**
   * Switches the plotted feature without refetching.
   *
   * @param feature the feature to plot
   */
  onFeatureChange(feature: AiUsageFeature): void {
    this.selectedFeature.set(feature);
  }

  /**
   * Sums the trigger counts of a single feature across the selected range.
   *
   * @param feature the feature to total
   * @returns the total number of triggers for that feature
   */
  private featureTotal(feature: AiUsageFeature): number {
    const series = this.analytics()?.series?.find(entry => entry.feature === feature);
    return (series?.counts ?? []).reduce((sum, count) => sum + count, 0);
  }
}
