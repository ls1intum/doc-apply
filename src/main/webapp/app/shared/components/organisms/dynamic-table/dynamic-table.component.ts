import { Component, TemplateRef, afterNextRender, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TranslateDirective } from 'app/shared/language';
import { ProgressSpinnerComponent } from 'app/shared/components/atoms/progress-spinner/progress-spinner.component';
import { LocalStorageService } from 'app/service/localStorage.service';
import { BREAKPOINT_QUERIES } from 'app/shared/constants/breakpoints';

export class DynamicTableColumn {
  field!: string;
  header!: string;
  type?: string;
  width!: string;
  alignCenter?: boolean;
  template?: TemplateRef<unknown>;
}

export const DEFAULT_ROWS_PER_PAGE_OPTIONS: number[] = [5, 10, 15, 20];

/** Page size small screens start on, where a full page of rows is a long scroll. */
export const MOBILE_ROWS_PER_PAGE = 5;

/** Stands in for "the user has not picked a page size yet", since any real size is positive. */
const NO_STORED_SIZE = -1;

@Component({
  selector: 'jhi-dynamic-table',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule, TranslateDirective, ProgressSpinnerComponent],
  templateUrl: './dynamic-table.component.html',
})
export class DynamicTableComponent {
  loading = input<boolean>(false);

  columns = input<DynamicTableColumn[]>([]);
  data = input<unknown[]>([]);
  rows = input<number>(10);
  totalRecords = input<number>(0);
  page = input<number>(0);
  selectable = input<boolean>(false);
  hideHeader = input<boolean>(false);
  paginator = input<boolean>(true);
  lazy = input<boolean>(true);
  rowsPerPageOptions = input<number[]>(DEFAULT_ROWS_PER_PAGE_OPTIONS);
  storageKey = input<string | undefined>(undefined);
  /**
   * Whether small screens always open on the short page, even when the reader picked a size before.
   * Off by default, so a remembered size normally wins.
   */
  alwaysUseMobileRows = input<boolean>(false);

  lazyLoad = output<TableLazyLoadEvent>();
  rowsHydrated = output<number>();

  private readonly localStorageService = inject(LocalStorageService);

  constructor() {
    // The table owns the first load rather than PrimeNG, which would fire it before the page size below
    // is known. Changing the size afterwards only relabels the paginator, since PrimeNG does not reload
    // when the rows input changes, which would leave a page of the old size on screen under the new label.
    afterNextRender(() => {
      const initial = this.resolveInitialRows();
      if (initial !== this.rows()) {
        this.rowsHydrated.emit(initial);
      }
      if (this.lazy()) {
        this.lazyLoad.emit({ first: 0, rows: initial });
      }
    });
  }

  emitLazy(event: TableLazyLoadEvent): void {
    const key = this.storageKey();
    if (key !== undefined && event.rows !== undefined && event.rows !== null && event.rows !== this.rows()) {
      this.localStorageService.savePageSize(key, event.rows);
    }
    this.lazyLoad.emit(event);
  }

  /**
   * Works out which page size to start on.
   *
   * A full page of rows is a long scroll on a phone, so small screens start on a shorter page than
   * the view asked for. Views that set {@link alwaysUseMobileRows} keep that short page on every
   * visit; everywhere else a size the reader picked before wins.
   *
   * @returns the page size to start on
   */
  private resolveInitialRows(): number {
    const mobileRows = this.mobileRows();
    if (mobileRows !== undefined && this.alwaysUseMobileRows()) {
      return mobileRows;
    }

    const key = this.storageKey();
    if (key !== undefined) {
      const stored = this.localStorageService.loadPageSize(key, NO_STORED_SIZE, this.rowsPerPageOptions());
      if (stored !== NO_STORED_SIZE) {
        return stored;
      }
    }
    return mobileRows ?? this.rows();
  }

  /**
   * @returns the short page size on a phone-sized viewport that offers it, otherwise {@code undefined}
   */
  private mobileRows(): number | undefined {
    if (!this.isMobileViewport() || !this.rowsPerPageOptions().includes(MOBILE_ROWS_PER_PAGE)) {
      return undefined;
    }
    return MOBILE_ROWS_PER_PAGE;
  }

  /**
   * @returns {@code true} if the viewport is phone-sized, {@code false} where it cannot be determined
   */
  private isMobileViewport(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(BREAKPOINT_QUERIES.onlyMobile).matches;
  }
}
