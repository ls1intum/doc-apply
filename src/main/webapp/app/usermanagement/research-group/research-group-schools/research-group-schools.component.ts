import { hasText } from 'app/shared/util/text.util';
import { Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DynamicTableColumn, DynamicTableComponent } from 'app/shared/components/organisms/dynamic-table/dynamic-table.component';
import { TableLazyLoadEvent } from 'primeng/table';
import { firstValueFrom } from 'rxjs';
import { ToastService } from 'app/service/toast-service';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { DialogService } from 'primeng/dynamicdialog';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';
import { SearchFilterSortBar } from 'app/shared/components/molecules/search-filter-sort-bar/search-filter-sort-bar';
import { Sort, SortOption } from 'app/shared/components/atoms/sorting/sorting';
import { SchoolResourceApi } from 'app/generated/api/school-resource-api';
import { SchoolDTO } from 'app/generated/model/school-dto';

import { SchoolEditDialogComponent } from './school-edit-dialog/school-edit-dialog.component';

interface SchoolPageResponse {
  content?: SchoolDTO[];
  totalElements?: number;
}

interface SchoolTableRow {
  schoolId?: string;
  name?: string;
  abbreviation?: string;
  departments?: string;
}

@Component({
  selector: 'jhi-research-group-schools.component',
  imports: [FontAwesomeModule, TranslateModule, DynamicTableComponent, ButtonComponent, ConfirmDialog, SearchFilterSortBar],
  templateUrl: './research-group-schools.component.html',
})
export class ResearchGroupSchoolsComponent {
  pageNumber = signal<number>(0);
  pageSize = signal<number>(10);

  searchQuery = signal<string>('');
  sortBy = signal<string>('name');
  sortDirection = signal<'ASC' | 'DESC'>('DESC');

  schools = signal<SchoolDTO[]>([]);
  total = signal<number>(0);

  readonly buttonTemplate = viewChild.required<TemplateRef<unknown>>('actionTemplate');
  readonly translationKey: string = 'researchGroup.schools';

  readonly columns = computed<DynamicTableColumn[]>(() => {
    const buttonTpl = this.buttonTemplate();

    return [
      { field: 'name', header: `${this.translationKey}.tableColumns.name`, width: '20rem' },
      { field: 'abbreviation', header: `${this.translationKey}.tableColumns.abbreviation`, width: '12rem' },
      { field: 'departments', header: `${this.translationKey}.tableColumns.departments`, width: '24rem' },
      { field: 'actions', header: '', width: '8rem', template: buttonTpl },
    ];
  });

  readonly sortableFields: SortOption[] = [
    { displayName: `${this.translationKey}.tableColumns.name`, fieldName: 'name', type: 'TEXT' },
    { displayName: `${this.translationKey}.tableColumns.abbreviation`, fieldName: 'abbreviation', type: 'TEXT' },
  ];

  readonly tableData = computed<SchoolTableRow[]>(() => {
    return this.schools().map(school => ({
      schoolId: school.schoolId,
      name: school.name,
      abbreviation: school.abbreviation,
      departments: this.getDepartmentsLabel(school),
    }));
  });

  private toastService = inject(ToastService);
  private readonly schoolApi = inject(SchoolResourceApi);
  private readonly dialogService = inject(DialogService);
  private readonly translate = inject(TranslateService);

  loadOnTableEmit(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? 10;
    this.pageNumber.set(first / rows);
    this.pageSize.set(rows);
    void this.loadSchools();
  }

  async loadSchools(): Promise<void> {
    try {
      const pageResponse = await firstValueFrom(
        this.schoolApi.getSchoolsForAdmin(this.pageSize(), this.pageNumber(), this.searchQuery(), this.sortBy(), this.sortDirection()),
      );

      const typedResponse = pageResponse as SchoolPageResponse;
      this.schools.set(typedResponse.content ?? []);
      this.total.set(typedResponse.totalElements ?? 0);
    } catch {
      this.toastService.showErrorKey(`${this.translationKey}.toastMessages.loadFailed`);
    }
  }

  onSearchEmit(searchQuery: string): void {
    this.searchQuery.set(searchQuery);
    this.pageNumber.set(0);
    void this.loadSchools();
  }

  loadOnSortEmit(event: Sort): void {
    this.sortBy.set(event.field);
    this.sortDirection.set(event.direction);
    this.pageNumber.set(0);
    void this.loadSchools();
  }

  async onEditSchool(schoolId: string | undefined): Promise<void> {
    if (schoolId == null) {
      return;
    }
    const school = this.schools().find(s => s.schoolId === schoolId);
    if (school == null) {
      return;
    }

    const dialogRef = this.dialogService.open(SchoolEditDialogComponent, {
      header: this.translate.instant(`${this.translationKey}.editDialog.title`),
      width: '60rem',
      style: { background: 'var(--color-background-default)' },
      closable: true,
      draggable: false,
      modal: true,
      data: {
        school,
      },
    });

    if (dialogRef == null) {
      return;
    }

    const updated: unknown = await firstValueFrom(dialogRef.onClose);
    if (updated === true) {
      await this.loadSchools();
    }
  }

  async onDeleteSchool(schoolId: string | undefined): Promise<void> {
    if (schoolId == null) {
      return;
    }
    try {
      await firstValueFrom(this.schoolApi.deleteSchool(schoolId));
      this.toastService.showSuccessKey(`${this.translationKey}.toastMessages.deleteSuccess`);
      await this.loadSchools();
    } catch {
      this.toastService.showErrorKey(`${this.translationKey}.toastMessages.deleteFailed`);
    }
  }

  async onCreateSchool(): Promise<void> {
    const dialogRef = this.dialogService.open(SchoolEditDialogComponent, {
      header: this.translate.instant(`${this.translationKey}.createDialog.title`),
      width: '60rem',
      style: { background: 'var(--color-background-default)' },
      closable: true,
      draggable: false,
      modal: true,
    });

    if (dialogRef == null) {
      return;
    }

    const created: unknown = await firstValueFrom(dialogRef.onClose);
    if (created === true) {
      await this.loadSchools();
    }
  }

  private getDepartmentsLabel(school: SchoolDTO): string {
    const departmentNames = (school.departments ?? [])
      .map(department => department.name)
      .filter((departmentName): departmentName is string => hasText(departmentName))
      .join(', ');

    return departmentNames || this.translate.instant(`${this.translationKey}.noDepartments`);
  }
}
