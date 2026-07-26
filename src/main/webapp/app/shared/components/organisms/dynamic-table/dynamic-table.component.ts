import { Component, TemplateRef, afterNextRender, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TranslateDirective } from 'app/shared/language';
import { ProgressSpinnerComponent } from 'app/shared/components/atoms/progress-spinner/progress-spinner.component';
import { LocalStorageService } from 'app/service/localStorage.service';

export class DynamicTableColumn {
  field!: string;
  header!: string;
  type?: string;
  width!: string;
  alignCenter?: boolean;
  template?: TemplateRef<unknown>;
}

export const DEFAULT_ROWS_PER_PAGE_OPTIONS: number[] = [5, 10, 15, 20];

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
      const key = this.storageKey();
      if (key === undefined) return;
      const stored = this.localStorageService.loadPageSize(key, this.rows(), this.rowsPerPageOptions());
      if (stored !== this.rows()) {
        this.rowsHydrated.emit(stored);
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
}
