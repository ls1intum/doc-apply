import { Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateService } from '@ngx-translate/core';
import { DynamicTableColumn, DynamicTableComponent } from 'app/shared/components/organisms/dynamic-table/dynamic-table.component';
import { DepartmentDTO } from 'app/generated/model/department-dto';
import { TableLazyLoadEvent } from 'primeng/table';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { ToastService } from 'app/service/toast-service';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { DialogService } from 'primeng/dynamicdialog';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';
import { SearchFilterSortBar } from 'app/shared/components/molecules/search-filter-sort-bar/search-filter-sort-bar';
import { Filter, FilterChange } from 'app/shared/components/atoms/filter-multiselect/filter-multiselect';
import { Sort, SortOption } from 'app/shared/components/atoms/sorting/sorting';
import { DepartmentResourceApi } from 'app/generated/api/department-resource-api';
import { SchoolResourceApi } from 'app/generated/api/school-resource-api';
import { SchoolShortDTO } from 'app/generated/model/school-short-dto';
import { JhiMenuItem, MenuComponent } from 'app/shared/components/atoms/menu/menu.component';

import TranslateDirective from '../../../shared/language/translate.directive';

import { DepartmentEditDialogComponent } from './department-edit-dialog/department-edit-dialog.component';

interface Confirmable {
  confirm(): void;
}

interface DepartmentTableRow {
  departmentId?: string;
  name?: string;
  schoolName?: string;
  schoolAbbreviation?: string;
}

@Component({
  selector: 'jhi-research-group-departments.component',
  imports: [
    FontAwesomeModule,
    DynamicTableComponent,
    ButtonComponent,
    ConfirmDialog,
    SearchFilterSortBar,
    MenuComponent,
    TranslateDirective,
  ],
  templateUrl: './research-group-departments.component.html',
})
export class ResearchGroupDepartmentsComponent {
  pageNumber = signal<number>(0);
  pageSize = signal<number>(10);

  searchQuery = signal<string>('');
  selectedSchoolFilters = signal<string[]>([]);
  sortBy = signal<string>('name');
  sortDirection = signal<'ASC' | 'DESC'>('DESC');

  departments = signal<DepartmentDTO[]>([]);
  total = signal<number>(0);
  schools = signal<SchoolShortDTO[]>([]);

  readonly buttonTemplate = viewChild.required<TemplateRef<unknown>>('actionTemplate');
  readonly translationKey: string = 'researchGroup.departments';

  readonly columns = computed<DynamicTableColumn[]>(() => {
    const buttonTpl = this.buttonTemplate();

    return [
      { field: 'name', header: `${this.translationKey}.tableColumns.name`, width: '16rem' },
      { field: 'schoolName', header: `${this.translationKey}.tableColumns.school`, width: '20rem' },
      { field: 'schoolAbbreviation', header: `${this.translationKey}.tableColumns.schoolAbbreviation`, width: '10rem' },
      { field: 'actions', header: '', width: '10rem', template: buttonTpl },
    ];
  });

  readonly availableSchools = computed(() =>
    this.schools()
      .map(s => s.name ?? '')
      .sort(),
  );

  readonly filters = computed<Filter[]>(() => [
    {
      filterId: 'school',
      filterLabel: `${this.translationKey}.filter.school`,
      filterSearchPlaceholder: `${this.translationKey}.filter.schoolSearch`,
      filterOptions: this.availableSchools(),
      shouldTranslateOptions: false,
    },
  ]);

  readonly sortableFields: SortOption[] = [
    { displayName: `${this.translationKey}.tableColumns.name`, fieldName: 'name', type: 'TEXT' },
    { displayName: `${this.translationKey}.tableColumns.school`, fieldName: 'school.name', type: 'TEXT' },
  ];

  readonly tableData = computed<DepartmentTableRow[]>(() => {
    return this.departments().map(dept => ({
      departmentId: dept.departmentId,
      name: dept.name,
      schoolName: dept.school?.name,
      schoolAbbreviation: dept.school?.abbreviation,
    }));
  });

  readonly menuItems = computed<JhiMenuItem[]>(() => {
    const department = this.activeDepartment();
    const deleteDialog = this.activeDeleteDialog();
    if (department?.departmentId == null || deleteDialog == null) {
      return [];
    }

    return [
      {
        label: `${this.translationKey}.images.button`,
        icon: 'image',
        severity: 'primary',
        command: () => {
          void this.router.navigate(['/research-group/departments/images'], {
            queryParams: { departmentId: department.departmentId },
          });
        },
      },
      {
        label: 'button.delete',
        icon: 'trash',
        severity: 'danger',
        command() {
          deleteDialog.confirm();
        },
      },
    ];
  });

  private toastService = inject(ToastService);
  private readonly departmentApi = inject(DepartmentResourceApi);
  private readonly schoolApi = inject(SchoolResourceApi);
  private readonly dialogService = inject(DialogService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private activeDepartment = signal<DepartmentTableRow | undefined>(undefined);
  private activeDeleteDialog = signal<Confirmable | undefined>(undefined);

  constructor() {
    // Schools populate the filter dropdown; the table's lazyLoad event drives the initial loadDepartments call.
    void this.loadSchools();
  }

  onMenuToggle(event: Event, menu: MenuComponent, department: DepartmentTableRow, deleteDialog: Confirmable): void {
    this.activeDepartment.set(department);
    this.activeDeleteDialog.set(deleteDialog);
    menu.toggle(event);
  }

  loadOnTableEmit(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? 10;
    this.pageNumber.set(first / rows);
    this.pageSize.set(rows);
    void this.loadDepartments();
  }

  async loadDepartments(): Promise<void> {
    try {
      const pageResponse = await firstValueFrom(
        this.departmentApi.getDepartmentsForAdmin(
          this.pageSize(),
          this.pageNumber(),
          this.selectedSchoolFilters(),
          this.searchQuery(),
          this.sortBy(),
          this.sortDirection(),
        ),
      );

      this.departments.set(pageResponse.content ?? []);
      this.total.set(pageResponse.totalElements ?? 0);
    } catch {
      this.toastService.showErrorKey(`${this.translationKey}.toastMessages.loadFailed`);
    }
  }

  onSearchEmit(searchQuery: string): void {
    this.searchQuery.set(searchQuery);
    this.pageNumber.set(0);
    void this.loadDepartments();
  }

  onFilterEmit(filterChange: FilterChange): void {
    if (filterChange.filterId === 'school') {
      this.selectedSchoolFilters.set(filterChange.selectedValues);
      this.pageNumber.set(0);
      void this.loadDepartments();
    }
  }

  loadOnSortEmit(event: Sort): void {
    this.sortBy.set(event.field);
    this.sortDirection.set(event.direction);
    this.pageNumber.set(0);
    void this.loadDepartments();
  }

  onEditDepartment(departmentId: string | undefined): void {
    if (departmentId == null) {
      return;
    }
    const department = this.departments().find(d => d.departmentId === departmentId);
    if (department == null) {
      return;
    }

    const dialogRef = this.dialogService.open(DepartmentEditDialogComponent, {
      header: this.translate.instant(`${this.translationKey}.editDialog.title`),
      width: '600px',
      style: { background: 'var(--color-background-default)', width: '60rem' },
      closable: true,
      draggable: false,
      modal: true,
      data: {
        department,
      },
    });

    dialogRef?.onClose.subscribe((updated: boolean) => {
      if (updated) {
        void this.loadDepartments();
      }
    });
  }

  onDeleteDepartment(departmentId: string | undefined): void {
    if (departmentId == null) {
      return;
    }
    this.departmentApi.deleteDepartment(departmentId).subscribe({
      next: () => {
        this.toastService.showSuccessKey(`${this.translationKey}.toastMessages.deleteSuccess`);
        void this.loadDepartments();
      },
      error: () => {
        this.toastService.showErrorKey(`${this.translationKey}.toastMessages.deleteFailed`);
      },
    });
  }

  onCreateDepartment(): void {
    const dialogRef = this.dialogService.open(DepartmentEditDialogComponent, {
      header: this.translate.instant(`${this.translationKey}.createDialog.title`),
      width: '600px',
      style: { background: 'var(--color-background-default)', width: '60rem' },
      closable: true,
      draggable: false,
      modal: true,
    });

    dialogRef?.onClose.subscribe((created: boolean) => {
      if (created) {
        void this.loadDepartments();
      }
    });
  }

  private async loadSchools(): Promise<void> {
    try {
      const schools = await firstValueFrom(this.schoolApi.getAllSchools());
      this.schools.set(schools);
    } catch {
      // non-fatal, availableSchools will be empty
    }
  }
}
