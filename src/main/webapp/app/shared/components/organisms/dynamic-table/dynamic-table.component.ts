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

  lazyLoad = output<TableLazyLoadEvent>();
  rowsHydrated = output<number>();

  private readonly localStorageService = inject(LocalStorageService);

  constructor() {
    afterNextRender(() => {
      const initial = this.resolveInitialRows();
      if (initial !== this.rows()) {
        this.rowsHydrated.emit(initial);
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
   * A size the user picked before always wins. Otherwise small screens start on a shorter page
   * than the view asked for, since a full page of rows is a long scroll on a phone.
   *
   * @returns the page size to start on
   */
  private resolveInitialRows(): number {
    const key = this.storageKey();
    if (key !== undefined) {
      const stored = this.localStorageService.loadPageSize(key, NO_STORED_SIZE, this.rowsPerPageOptions());
      if (stored !== NO_STORED_SIZE) {
        return stored;
      }
    }
    return this.isMobileViewport() && this.rowsPerPageOptions().includes(MOBILE_ROWS_PER_PAGE) ? MOBILE_ROWS_PER_PAGE : this.rows();
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
