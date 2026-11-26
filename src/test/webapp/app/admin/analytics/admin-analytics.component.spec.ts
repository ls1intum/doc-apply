import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { AdminAnalyticsComponent } from 'app/admin/analytics/admin-analytics.component';
import { AiUsageAnalyticsDTO } from 'app/generated/model/ai-usage-analytics-dto';
import { AiUsageFeature } from 'app/generated/model/ai-usage-feature';
import { AiUsageTimeRange } from 'app/generated/model/ai-usage-time-range';
import { provideTranslateMock } from 'util/translate.mock';
import { createToastServiceMock, provideToastServiceMock, ToastServiceMock } from 'util/toast-service.mock';
import {
  AdminAiAnalyticsResourceApiMock,
  createAdminAiAnalyticsResourceApiMock,
  provideAdminAiAnalyticsResourceApiMock,
} from 'util/admin-ai-analytics-resource-api.service.mock';

describe('AdminAnalyticsComponent', () => {
  let fixture: ComponentFixture<AdminAnalyticsComponent>;
  let component: AdminAnalyticsComponent;
  let analyticsApi: AdminAiAnalyticsResourceApiMock;
  let toastService: ToastServiceMock;

  const analytics: AiUsageAnalyticsDTO = {
    labels: ['2026-11-24', '2026-11-25', '2026-11-26'],
    series: [
      {
        feature: AiUsageFeature.JobDescriptionGeneration,
        counts: [2, 0, 3],
        failureCounts: [1, 0, 0],
        totalTokens: 500,
        estimatedCost: 0.5,
      },
      { feature: AiUsageFeature.Translation, counts: [1, 4, 0], failureCounts: [0, 0, 0], totalTokens: 200, estimatedCost: 0.2 },
      { feature: AiUsageFeature.DocumentExtraction, counts: [0, 1, 0], failureCounts: [0, 1, 0], totalTokens: 0, estimatedCost: 0 },
      {
        feature: AiUsageFeature.EmailTemplateTranslation,
        counts: [0, 0, 1],
        failureCounts: [0, 0, 0],
        totalTokens: 100,
        estimatedCost: 0.1,
      },
    ],
    cost: { inputTokens: 300, outputTokens: 500, totalTokens: 800, estimatedCost: 0.8, currency: 'EUR' },
  };

  /**
   * @returns the text of the stat card grid, where the translate mock renders each label as its key
   */
  function cardText(): string {
    const grid: HTMLElement | undefined = fixture.nativeElement.querySelector('.grid') ?? undefined;
    return grid?.textContent ?? '';
  }

  beforeEach(async () => {
    analyticsApi = createAdminAiAnalyticsResourceApiMock();
    analyticsApi.getAiUsage.mockReturnValue(of(analytics));
    toastService = createToastServiceMock();

    await TestBed.configureTestingModule({
      imports: [AdminAnalyticsComponent],
      providers: [provideAdminAiAnalyticsResourceApiMock(analyticsApi), provideToastServiceMock(toastService), provideTranslateMock()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminAnalyticsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should show all features combined by default with the summed total line and global stats', () => {
    expect(analyticsApi.getAiUsage).toHaveBeenCalledExactlyOnceWith(AiUsageTimeRange.LastMonth);
    expect(component.featureOptions[0].value).toBeUndefined();
    expect(component.selectedFeature()).toBeUndefined();

    const datasets = component.chartDatasets();
    expect(datasets.map(dataset => dataset.label)).toEqual([
      'analytics.chart.total',
      'analytics.feature.jobDescriptionGeneration',
      'analytics.feature.translation',
      'analytics.feature.documentExtraction',
      'analytics.feature.emailTemplateTranslation',
    ]);
    expect(datasets[0].data).toEqual([3, 5, 4]);
    expect(component.calls()).toBe(12);
    expect(component.failedCalls()).toBe(2);
    expect(component.tokensUsed()).toBe(800);
    expect(component.estimatedCost()).toBe(0.8);
    expect(fixture.nativeElement.querySelectorAll('.grid > div')).toHaveLength(9);
    expect(cardText()).toContain('analytics.stats.totalCalls');
  });

  it('should narrow chart and stats to the selected feature', () => {
    component.onFeatureChange(AiUsageFeature.JobDescriptionGeneration);
    fixture.detectChanges();

    expect(component.chartDatasets()).toEqual([{ label: 'analytics.chart.triggers', data: [2, 0, 3] }]);
    expect(component.calls()).toBe(5);
    expect(component.successfulCalls()).toBe(4);
    expect(component.failedCalls()).toBe(1);
    expect(component.successRate()).toBe(80);
    expect(component.tokensUsed()).toBe(500);
    expect(component.estimatedCost()).toBe(0.5);
    expect(fixture.nativeElement.querySelectorAll('.grid > div')).toHaveLength(6);
    expect(cardText()).toContain('analytics.stats.successfulCalls');
    expect(cardText()).not.toContain('analytics.feature.translation');
  });

  it('should refetch when the time range changes', () => {
    component.onRangeChange({ name: 'analytics.range.lastDay', value: AiUsageTimeRange.LastDay });

    expect(analyticsApi.getAiUsage).toHaveBeenLastCalledWith(AiUsageTimeRange.LastDay);
  });

  it('should show an error toast when loading fails', async () => {
    analyticsApi.getAiUsage.mockReturnValue(throwError(() => new Error('boom')));

    await component.loadAnalytics();

    expect(toastService.showErrorKey).toHaveBeenCalledExactlyOnceWith('analytics.toast.loadError');
  });
});
