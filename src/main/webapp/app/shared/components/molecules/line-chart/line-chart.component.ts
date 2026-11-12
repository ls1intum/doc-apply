import { Component, PLATFORM_ID, computed, inject, input } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { ThemeService } from 'app/service/theme.service';

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
 * Thin, reusable wrapper around PrimeNG's line chart. Takes plain labels/datasets inputs and
 * derives the Chart.js data and options, resolving line, text and grid colors from the app's own
 * theme tokens so the chart matches all themes. The derivations depend on the theme signal,
 * so the chart recolors immediately when the theme changes.
 * Rendering is guarded to the browser for SSR safety.
 */
@Component({
  selector: 'jhi-line-chart',
  standalone: true,
  imports: [ChartModule],
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

  /** Chart.js data object built from the component inputs and the active theme's line colors. */
  readonly data = computed(() => {
    return {
      labels: this.labels(),
      datasets: this.datasets().map((dataset, index) => {
        const color = this.resolveToken(dataset.colorVar ?? LINE_COLOR_TOKENS[index % LINE_COLOR_TOKENS.length]);
        return {
          label: dataset.label,
          data: dataset.data,
          fill: false,
          borderColor: color,
          backgroundColor: color,
          pointBackgroundColor: color,
          borderWidth: 2,
          tension: 0.4,
        };
      }),
    };
  });

  /** Chart.js options with axis text and grid colors resolved from the active theme tokens. */
  readonly options = computed(() => {
    const textColor = this.resolveToken('--color-text-primary');
    const mutedColor = this.resolveToken('--color-text-secondary');
    const gridColor = this.resolveToken('--color-border-default');
    return {
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor } },
      },
      scales: {
        x: {
          ticks: { color: mutedColor },
          grid: { color: gridColor },
        },
        y: {
          beginAtZero: true,
          max: this.yMax() ?? this.niceCeil(this.maxDataValue()),
          ticks: { color: mutedColor, precision: 0 },
          grid: { color: gridColor },
        },
      },
    };
  });

  protected readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly themeService = inject(ThemeService);

  /**
   * Resolves an app theme color token to a concrete color for the currently active theme. Reads the
   * theme signal so the enclosing computed re-runs on theme changes, then resolves the token through
   * a hidden probe element so nested {@code var()} chains collapse to a usable color value.
   *
   * @param token the CSS custom property name, e.g. '--color-primary-default'
   * @returns the resolved color, or undefined during server-side rendering
   */
  private resolveToken(token: string): string | undefined {
    this.themeService.theme();
    if (!this.isBrowser) {
      return undefined;
    }
    const probe = document.createElement('span');
    probe.style.color = `var(${token})`;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved || undefined;
  }

  /** The largest value across all datasets, or 0 when there is no data. */
  private maxDataValue(): number {
    return this.datasets().reduce((max, dataset) => Math.max(max, ...dataset.data, 0), 0);
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
