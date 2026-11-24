import { Component, input, output } from '@angular/core';
import { TumAetUiPaginatorComponent } from '@tumaet/ui-angular';

@Component({
  selector: 'jhi-paginator',
  imports: [TumAetUiPaginatorComponent],
  template: `<tumaet-ui-paginator
    [page]="page()"
    [pageSize]="pageSize()"
    [totalRecords]="totalRecords()"
    [showCurrentPageReport]="false"
    [showRowsPerPage]="false"
    (pageChange)="pageChange.emit($event)"
  />`,
})
export class PaginatorComponent {
  /**
   * Zero-based index of the current page.
   */
  page = input<number>(0);

  /**
   * Number of records shown on one page.
   */
  pageSize = input.required<number>();

  /**
   * Number of records across all pages.
   */
  totalRecords = input.required<number>();

  /**
   * Emits the zero-based index of the page the user picked.
   */
  pageChange = output<number>();
}
