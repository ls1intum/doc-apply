import { hasText } from 'app/shared/util/text.util';
import { Router } from '@angular/router';
import { Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogService } from 'primeng/dynamicdialog';
import { TableLazyLoadEvent } from 'primeng/table';
import { firstValueFrom } from 'rxjs';
import { ResearchGroupResourceApi } from 'app/generated/api/research-group-resource-api';
import { ResearchGroupAdminDTO, ResearchGroupAdminDTOStatusEnum } from 'app/generated/model/research-group-admin-dto';
import { ToastService } from 'app/service/toast-service';
import { ButtonColor, ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';
import { JhiMenuItem, MenuComponent } from 'app/shared/components/atoms/menu/menu.component';
import { Filter, FilterChange } from 'app/shared/components/atoms/filter-multiselect/filter-multiselect';
import { Sort, SortDirection, SortOption } from 'app/shared/components/atoms/sorting/sorting';
import { TagComponent } from 'app/shared/components/atoms/tag/tag.component';
import { SearchFilterSortBar } from 'app/shared/components/molecules/search-filter-sort-bar/search-filter-sort-bar';
import { DynamicTableColumn, DynamicTableComponent } from 'app/shared/components/organisms/dynamic-table/dynamic-table.component';
import { TranslateDirective } from 'app/shared/language';
import { ResearchGroupCreationFormComponent } from 'app/shared/components/molecules/research-group-creation-form/research-group-creation-form.component';

const I18N_BASE = 'researchGroup.adminView';

@Component({
  selector: 'jhi-research-group-admin-view',
  imports: [
    ButtonComponent,
    MenuComponent,
    TagComponent,
    TranslateModule,
    TranslateDirective,
    SearchFilterSortBar,
    DynamicTableComponent,
    ConfirmDialog,
  ],
  templateUrl: './research-group-admin-view.component.html',
})
export class ResearchGroupAdminView {
  researchGroups = signal<ResearchGroupAdminDTO[]>([]);
  totalRecords = signal<number>(0);
  page = signal<number>(0);
  pageSize = signal<number>(10);
  searchQuery = signal<string>('');

  sortBy = signal<string>('state');
  sortDirection = signal<SortDirection>('DESC');

  readonly availableStatusOptions: { key: string; label: string }[] = [
    { key: ResearchGroupAdminDTOStatusEnum.Draft, label: `${I18N_BASE}.groupState.draft` },
    { key: ResearchGroupAdminDTOStatusEnum.Active, label: `${I18N_BASE}.groupState.active` },
    { key: ResearchGroupAdminDTOStatusEnum.Denied, label: `${I18N_BASE}.groupState.denied` },
  ];

  readonly stateTextMap = computed<Record<string, string>>(() =>
    this.availableStatusOptions.reduce<Record<string, string>>((acc, cur) => {
      acc[cur.key] = cur.label;
      return acc;
    }, {}),
  );

  readonly availableStatusLabels = this.availableStatusOptions.map(option => option.label);

  readonly stateSeverityMap = signal<Record<string, ButtonColor>>({
    [ResearchGroupAdminDTOStatusEnum.Draft]: 'contrast',
    [ResearchGroupAdminDTOStatusEnum.Active]: 'success',
    [ResearchGroupAdminDTOStatusEnum.Denied]: 'danger',
  });

  readonly buttonTemplate = viewChild.required<TemplateRef<unknown>>('actionTemplate');
  readonly stateTemplate = viewChild.required<TemplateRef<unknown>>('stateTemplate');

  showApproveDialog = signal(false);
  showDenyDialog = signal(false);
  showWithdrawDialog = signal(false);

  currentResearchGroupId = signal<string | undefined>(undefined);

  readonly selectedStatusFilters = signal<ResearchGroupAdminDTOStatusEnum[]>([]);

  readonly columns = computed<DynamicTableColumn[]>(() => {
    const stateTpl = this.stateTemplate();
    const buttonTpl = this.buttonTemplate();

    return [
      { field: 'professorName', header: `${I18N_BASE}.tableColumn.professor`, width: '20rem' },
      {
        field: 'status',
        header: `${I18N_BASE}.tableColumn.status`,
        width: '6rem',
        alignCenter: true,
        template: stateTpl,
      },
      { field: 'researchGroup', header: `${I18N_BASE}.tableColumn.researchGroup`, width: '30rem' },
      { field: 'createdAt', header: `${I18N_BASE}.tableColumn.requestedAt`, type: 'date', width: '16rem' },
      { field: 'actions', header: '', width: '5rem', template: buttonTpl },
    ];
  });

  readonly filters: Filter[] = [
    {
      filterId: 'status',
      filterLabel: `${I18N_BASE}.filter.status`,
      filterSearchPlaceholder: `${I18N_BASE}.filter.stateSearchPlaceholder`,
      filterOptions: this.availableStatusLabels,
      shouldTranslateOptions: true,
    },
  ];

  readonly sortableFields: SortOption[] = [
    { displayName: `${I18N_BASE}.tableColumn.status`, fieldName: 'state', type: 'TEXT' },
    { displayName: `${I18N_BASE}.tableColumn.requestedAt`, fieldName: 'createdAt', type: 'NUMBER' },
  ];

  readonly actionMenuItems = computed<Map<string, JhiMenuItem[]>>(() => {
    const menuMap = new Map<string, JhiMenuItem[]>();

    for (const group of this.researchGroups()) {
      const groupId = group.id;
      if (!hasText(groupId)) {
        continue;
      }
      const items: JhiMenuItem[] = [];

      if (group.status !== ResearchGroupAdminDTOStatusEnum.Denied) {
        items.push({
          label: 'researchGroup.members.manageMembers',
          icon: 'users',
          severity: 'primary',
          command: () => {
            this.onManageMembers(groupId);
          },
        });
      }

      items.push({
        label: 'researchGroup.imageLibrary.manageButton',
        icon: 'image',
        severity: 'primary',
        command: () => {
          this.onManageImages(groupId, group.researchGroup);
        },
      });

      if (group.status === ResearchGroupAdminDTOStatusEnum.Active) {
        items.push({
          label: 'button.withdraw',
          icon: 'withdraw',
          severity: 'danger',
          command: () => {
            this.currentResearchGroupId.set(groupId);
            this.showWithdrawDialog.set(true);
          },
        });
      }

      if (group.status === ResearchGroupAdminDTOStatusEnum.Draft) {
        items.push({
          label: 'button.confirm',
          icon: 'check',
          severity: 'success',
          command: () => {
            this.currentResearchGroupId.set(groupId);
            this.showApproveDialog.set(true);
          },
        });
        items.push({
          label: 'button.deny',
          icon: 'times',
          severity: 'danger',
          command: () => {
            this.currentResearchGroupId.set(groupId);
            this.showDenyDialog.set(true);
          },
        });
      }

      if (group.status === ResearchGroupAdminDTOStatusEnum.Denied) {
        items.push({
          label: 'button.confirm',
          icon: 'check',
          severity: 'success',
          command: () => {
            this.currentResearchGroupId.set(groupId);
            this.showApproveDialog.set(true);
          },
        });
      }

      menuMap.set(groupId, items);
    }

    return menuMap;
  });

  readonly getMenuItems = computed(() => {
    const menuMap = this.actionMenuItems();
    return (group: ResearchGroupAdminDTO): JhiMenuItem[] => (hasText(group.id) ? (menuMap.get(group.id) ?? []) : []);
  });

  private toastService = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private researchGroupApi = inject(ResearchGroupResourceApi);
  private readonly dialogService = inject(DialogService);
  private router = inject(Router);

  loadOnTableEmit(event: TableLazyLoadEvent): void {
    const page = Math.floor((event.first ?? 0) / (event.rows ?? this.pageSize()));
    const size = event.rows ?? this.pageSize();

    this.page.set(page);
    this.pageSize.set(size);
    void this.loadResearchGroups();
  }

  onSearchEmit(searchQuery: string): void {
    if (searchQuery !== this.searchQuery()) {
      this.page.set(0);
      this.searchQuery.set(searchQuery);
      void this.loadResearchGroups();
    }
  }

  onFilterEmit(filterChange: FilterChange): void {
    if (filterChange.filterId === 'status') {
      this.page.set(0);
      const selectedKeys = this.mapTranslationKeysToEnumValues(filterChange.selectedValues);
      this.selectedStatusFilters.set(selectedKeys);
      void this.loadResearchGroups();
    }
  }

  loadOnSortEmit(event: Sort): void {
    this.page.set(0);
    this.sortBy.set(event.field);
    this.sortDirection.set(event.direction);
    void this.loadResearchGroups();
  }

  onViewResearchGroup(researchGroupId: string): void {
    void this.router.navigate(['/research-group/detail', researchGroupId]);
  }

  onCreateResearchGroup(): void {
    const dialogRef = this.dialogService.open(ResearchGroupCreationFormComponent, {
      header: this.translate.instant('researchGroup.adminView.createDialog.title'),
      data: { mode: 'admin' },
      styleClass: 'research-group-create-dialog',
      style: { background: 'var(--color-background-default)', width: '60rem' },
      closable: true,
      draggable: false,
      modal: true,
    });

    dialogRef?.onClose.subscribe((result: unknown) => {
      if (result !== undefined && result !== null && result !== false) {
        void this.loadResearchGroups();
      }
    });
  }

  onManageMembers(researchGroupId: string): void {
    void this.router.navigate(['/research-group', researchGroupId, 'members']);
  }

  onManageImages(researchGroupId: string, researchGroupName?: string): void {
    void this.router.navigate(['/research-group/admin-view/images'], {
      queryParams: { researchGroupId, researchGroupName: researchGroupName ?? '' },
    });
  }

  async onApproveResearchGroup(researchGroupId: string): Promise<void> {
    try {
      await firstValueFrom(this.researchGroupApi.activateResearchGroup(researchGroupId));
      this.toastService.showSuccessKey(`${I18N_BASE}.success.approve`);
      await this.loadResearchGroups();
    } catch {
      this.toastService.showErrorKey(`${I18N_BASE}.errors.approve`);
    }
  }

  async onDenyResearchGroup(researchGroupId: string): Promise<void> {
    try {
      await firstValueFrom(this.researchGroupApi.denyResearchGroup(researchGroupId));
      this.toastService.showSuccessKey(`${I18N_BASE}.success.deny`);
      await this.loadResearchGroups();
    } catch {
      this.toastService.showErrorKey(`${I18N_BASE}.errors.deny`);
    }
  }

  async onWithdrawResearchGroup(researchGroupId: string): Promise<void> {
    try {
      await firstValueFrom(this.researchGroupApi.withdrawResearchGroup(researchGroupId));
      this.toastService.showSuccessKey(`${I18N_BASE}.success.withdraw`);
      await this.loadResearchGroups();
    } catch {
      this.toastService.showErrorKey(`${I18N_BASE}.errors.withdraw`);
    }
  }

  onConfirmApprove(): void {
    const researchGroupId = this.currentResearchGroupId();
    if (hasText(researchGroupId)) {
      void this.onApproveResearchGroup(researchGroupId);
    }
  }

  onConfirmDeny(): void {
    const researchGroupId = this.currentResearchGroupId();
    if (hasText(researchGroupId)) {
      void this.onDenyResearchGroup(researchGroupId);
    }
  }

  onConfirmWithdraw(): void {
    const researchGroupId = this.currentResearchGroupId();
    if (hasText(researchGroupId)) {
      void this.onWithdrawResearchGroup(researchGroupId);
    }
  }

  private mapTranslationKeysToEnumValues(translationKeys: string[]): ResearchGroupAdminDTOStatusEnum[] {
    const keyMap = new Map(this.availableStatusOptions.map(option => [option.label, option.key]));
    return translationKeys.map(key => (keyMap.get(key) ?? key) as ResearchGroupAdminDTOStatusEnum);
  }

  private async loadResearchGroups(): Promise<void> {
    try {
      const pageData = await firstValueFrom(
        this.researchGroupApi.getResearchGroupsForAdmin(
          this.pageSize(),
          this.page(),
          this.selectedStatusFilters(),
          this.searchQuery(),
          this.sortBy(),
          this.sortDirection(),
        ),
      );
      this.researchGroups.set(pageData.content ?? []);
      this.totalRecords.set(pageData.totalElements ?? 0);
    } catch {
      this.toastService.showErrorKey(`${I18N_BASE}.errors.loadResearchGroups`);
    }
  }
}
