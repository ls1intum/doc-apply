import { Component, LOCALE_ID, TemplateRef, afterNextRender, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { NgTemplateOutlet, formatDate } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TumAetUiCheckboxComponent, TumAetUiPaginatorComponent, TumAetUiTableDirective } from '@tumaet/ui-angular';
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

/** The page a table asks its view to load: the index of the first row on it and how many rows it shows. */
export interface TablePageEvent {
  first: number;
  rows: number;
}

/** A page change as the table reports it, where either part may be missing. */
interface PageRequest {
  first?: number;
  rows?: number;
}

/** A row on the current page together with the text of every column that has no template of its own. */
interface DynamicTableRow {
  data: unknown;
  text: Record<string, string>;
}

export const DEFAULT_ROWS_PER_PAGE_OPTIONS: number[] = [5, 10, 15, 20];

/** Stands in for "the user has not picked a page size yet", since any real size is positive. */
const NO_STORED_SIZE = -1;

const DATE_FORMAT = 'dd.MM.yyyy';

@Component({
  selector: 'jhi-dynamic-table',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    TranslateModule,
    TranslateDirective,
    TumAetUiTableDirective,
    TumAetUiPaginatorComponent,
    TumAetUiCheckboxComponent,
    ProgressSpinnerComponent,
  ],
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
   * Height after which the rows scroll inside the table while the header and paginator stay in view, e.g. '50vh'.
   * Without it the table grows with its rows.
   */
  scrollHeight = input<string | undefined>(undefined);
  /**
   * Whether small screens always open on the short page, even when the reader picked a size before.
   * Off by default, so a remembered size normally wins.
   */
  alwaysUseMobileRows = input<boolean>(false);

  lazyLoad = output<TablePageEvent>();
  rowsHydrated = output<number>();

  /** The page on screen; follows the page input and moves on its own when the reader pages. */
  protected readonly currentPage = linkedSignal(() => this.page());
  /** The page size on screen; follows the rows input and changes on its own when the reader picks a size. */
  protected readonly currentRows = linkedSignal(() => this.rows());
  protected readonly selectedRows = signal<unknown[]>([]);

  protected readonly columnCount = computed(() => this.columns().length + (this.selectable() ? 1 : 0));

  protected readonly tableRows = computed<DynamicTableRow[]>(() => {
    if (this.loading()) {
      return [];
    }
    const columns = this.columns();
    return this.pageData().map(data => ({ data, text: this.cellTexts(data, columns) }));
  });

  /** Whether each row on the current page is selected, by position. */
  protected readonly rowSelection = computed(() => {
    const selected = this.selectedRows();
    return this.tableRows().map(row => selected.includes(row.data));
  });

  protected readonly allSelected = computed(() => {
    const selection = this.rowSelection();
    return selection.length > 0 && selection.every(Boolean);
  });

  protected readonly someSelected = computed(() => !this.allSelected() && this.rowSelection().some(Boolean));

  private readonly localStorageService = inject(LocalStorageService);
  private readonly locale = inject(LOCALE_ID);

  /** The rows of the current page: the view pages lazy tables itself, so only eager tables are sliced here. */
  private readonly pageData = computed(() => {
    const data = this.data();
    if (this.lazy() || !this.paginator()) {
      return data;
    }
    const first = this.currentPage() * this.currentRows();
    return data.slice(first, first + this.currentRows());
  });

  /**
   * Emits the first lazy load once the view is rendered, when the page size to start on is known, so
   * a view never loads a page of one size and then shows it under the label of another.
   */
  constructor() {
    afterNextRender(() => {
      const initial = this.resolveInitialRows();
      if (initial !== this.rows()) {
        this.currentRows.set(initial);
        this.rowsHydrated.emit(initial);
      }
      if (this.lazy()) {
        this.lazyLoad.emit({ first: 0, rows: initial });
      }
    });
  }

  /**
   * Shows and forwards a page change, remembering the page size whenever the reader changes it so the
   * choice survives navigation and reloads.
   *
   * @param event the page the reader moved to; a missing part falls back to the first row and the rows input
   */
  emitLazy(event: PageRequest): void {
    const rows = event.rows ?? this.rows();
    const first = event.first ?? 0;
    this.showPage(first, rows);
    this.lazyLoad.emit({ first, rows });
  }

  /**
   * Moves to the page the reader picked in the paginator.
   *
   * @param page the zero-based index of the picked page
   */
  protected onPageChange(page: number): void {
    const rows = this.currentRows();
    this.requestPage(page * rows, rows);
  }

  /**
   * Switches to the page size the reader picked, starting again on the first page.
   *
   * @param rows the picked page size
   */
  protected onPageSizeChange(rows: number): void {
    this.requestPage(0, rows);
  }

  /**
   * Selects or deselects every row on the current page.
   *
   * @param checked whether the rows become selected
   */
  protected toggleAll(checked: boolean): void {
    const visible = this.tableRows().map(row => row.data);
    const others = this.selectedRows().filter(row => !visible.includes(row));
    this.selectedRows.set(checked ? others.concat(visible) : others);
  }

  /**
   * Selects or deselects one row.
   *
   * @param row the row to change
   * @param checked whether the row becomes selected
   */
  protected toggleRow(row: unknown, checked: boolean): void {
    const others = this.selectedRows().filter(selected => selected !== row);
    this.selectedRows.set(checked ? others.concat([row]) : others);
  }

  /**
   * Lazy tables hand the page to their view; eager ones only show it.
   *
   * @param first the index of the first row on the page
   * @param rows the page size
   */
  private requestPage(first: number, rows: number): void {
    if (this.lazy()) {
      this.emitLazy({ first, rows });
    } else {
      this.showPage(first, rows);
    }
  }

  /**
   * Puts a page on screen and remembers a page size the reader changed.
   *
   * @param first the index of the first row on the page
   * @param rows the page size
   */
  private showPage(first: number, rows: number): void {
    const key = this.storageKey();
    if (key !== undefined && rows !== this.rows()) {
      this.localStorageService.savePageSize(key, rows);
    }
    this.currentRows.set(rows);
    this.currentPage.set(rows > 0 ? Math.floor(first / rows) : 0);
  }

  /**
   * Formats the cells of a row whose columns have no template.
   *
   * @param data the row
   * @param columns the table columns
   * @returns the display text by column field
   */
  private cellTexts(data: unknown, columns: DynamicTableColumn[]): Record<string, string> {
    const values: Record<string, unknown> = typeof data === 'object' && data !== null ? Object.fromEntries(Object.entries(data)) : {};
    const texts: Record<string, string> = {};
    for (const column of columns) {
      if (column.template === undefined) {
        texts[column.field] = this.formatCell(values[column.field], column.type);
      }
    }
    return texts;
  }

  /**
   * @param value the cell value
   * @param type the column type; 'date' columns show the day only
   * @returns the text shown in the cell, empty for a missing value or one that has no readable text form
   */
  private formatCell(value: unknown, type: string | undefined): string {
    const isDateLike = typeof value === 'string' || typeof value === 'number' || value instanceof Date;
    if (type === 'date') {
      return isDateLike ? formatDate(value, DATE_FORMAT, this.locale) : '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return value.toString();
    }
    return '';
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
   * The shortest page the view offers, which is where small screens start: a full page of rows is a
   * long scroll on a phone. Taking it from the offered sizes keeps it valid for views that set their
   * own, such as the job cards, whose sizes are multiples of a full row.
   *
   * @returns the shortest page size on a phone-sized viewport, otherwise {@code undefined}
   */
  private mobileRows(): number | undefined {
    const options = this.rowsPerPageOptions();
    if (!this.isMobileViewport() || options.length === 0) {
      return undefined;
    }
    return options.reduce((shortest, option) => Math.min(shortest, option));
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
