import { Component, computed, input } from '@angular/core';
import { TumAetUiChartSeries, TumAetUiLineChartComponent, TumAetUiLineChartConfig } from '@tumaet/ui-angular';

/** A single line series rendered by {@link LineChartComponent}. */
export interface LineChartDataset {
  /** Legend label for the series. */
  label: string;
  /** Y-values, one per x-axis label. */
  data: number[];
  /** Optional theme color token (CSS custom property, e.g. '--color-accent-default'); defaults to a palette token. */
  colorVar?: string;
}

/** App theme color tokens used, in order, for the line palette. All adapt across the four themes. */
const LINE_COLOR_TOKENS = ['--color-primary-default', '--color-accent-default', '--color-positive-default', '--color-warning-default'];

/**
 * Reusable line chart that takes plain labels and datasets. Lines are coloured with the app's theme tokens,
 * which the SVG chart reads directly, so the chart follows theme changes without re-rendering.
 */
@Component({
  selector: 'jhi-line-chart',
  standalone: true,
  imports: [TumAetUiLineChartComponent],
  templateUrl: './line-chart.component.html',
})
export class LineChartComponent {
  /** X-axis labels shared by every dataset. */
  labels = input.required<string[]>();

  /** One or more line series to plot. */
  datasets = input.required<LineChartDataset[]>();

  /** Container height in pixels. */
  heightPx = input<number>(360);

  /**
   * Upper bound of the y-axis. When omitted, it is rounded up from the largest data point to the
   * next "nice" value so the highest line always sits comfortably below the top of the chart.
   */
  yMax = input<number | undefined>(undefined);

  protected readonly series = computed<TumAetUiChartSeries[]>(() =>
    this.datasets().map((dataset, index) => ({
      label: dataset.label,
      data: dataset.data,
      color: `var(${dataset.colorVar ?? LINE_COLOR_TOKENS[index % LINE_COLOR_TOKENS.length]})`,
    })),
  );

  protected readonly config = computed<TumAetUiLineChartConfig>(() => ({
    legend: { position: 'top' },
    monotone: true,
    yAxis: { min: 0, max: this.yMax() ?? this.niceCeil(this.maxDataValue()) },
  }));

  /** Names the chart after its series for assistive technology. */
  protected readonly ariaLabel = computed(() =>
    this.datasets()
      .map(dataset => dataset.label)
      .join(', '),
  );

  /**
   * @returns the largest value across all datasets, or 0 when there is no data
   */
  private maxDataValue(): number {
    return this.datasets().reduce((max, dataset) => dataset.data.reduce((datasetMax, value) => Math.max(datasetMax, value), max), 0);
  }

  /**
   * Rounds a value up to the next visually pleasant axis maximum (e.g. 30 → 50, 57 → 75), always
   * leaving headroom above the data and keeping the maximum an integer.
   *
   * @param value the largest data value to accommodate
   * @returns a rounded-up axis maximum
   */
  private niceCeil(value: number): number {
    if (value <= 0) {
      return 5;
    }
    const steps = [1, 2, 2.5, 5, 7.5, 10];
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const ratio = value / magnitude;
    const niceRatio = steps.find(step => step > ratio) ?? 10;
    return Math.ceil(niceRatio * magnitude);
  }
}
