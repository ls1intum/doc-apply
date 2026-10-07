import { Component, computed, input, output } from '@angular/core';
import { PaginatorModule } from 'primeng/paginator';
import { PaginatorState } from 'primeng/types/paginator';

@Component({
  selector: 'jhi-paginator',
  standalone: true,
  imports: [PaginatorModule],
  template: '<p-paginator [rows]="pageSize()" [totalRecords]="totalRecords()" [first]="first()" (onPageChange)="onPageChange($event)" />',
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

  readonly first = computed(() => this.page() * this.pageSize());

  /**
   * Forwards the picked page index.
   *
   * @param state the paginator state after the user picked a page
   */
  onPageChange(state: PaginatorState): void {
    this.pageChange.emit(state.page ?? 0);
  }
}
