import { Component, TemplateRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { DynamicTableColumn, DynamicTableComponent } from 'app/shared/components/organisms/dynamic-table/dynamic-table.component';
import { ToastService } from 'app/service/toast-service';
import { TableLazyLoadEvent } from 'primeng/table';
import { firstValueFrom } from 'rxjs';
import { BadgeModule } from 'primeng/badge';
import { AccountService } from 'app/core/auth/account.service';
import { TranslateModule } from '@ngx-translate/core';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';
import { TimeAgoPipe } from 'app/shared/pipes/time-ago.pipe';
import { SortOption } from 'app/shared/components/atoms/sorting/sorting';
import { TranslateDirective } from 'app/shared/language';
import { JhiMenuItem, MenuComponent } from 'app/shared/components/atoms/menu/menu.component';
import { ApplicationResourceApi } from 'app/generated/api/application-resource-api';
import { ApplicationOverviewDTO } from 'app/generated/model/application-overview-dto';
import { ApplicationOverviewDTOApplicationStateEnum } from 'app/generated/model/application-overview-dto';

import { ApplicationStateForApplicantsComponent } from '../application-state-for-applicants/application-state-for-applicants.component';

@Component({
  selector: 'jhi-application-overview-for-applicant',
  imports: [
    DynamicTableComponent,
    ButtonComponent,
    BadgeModule,
    TranslateModule,
    TranslateDirective,
    ApplicationStateForApplicantsComponent,
    RouterModule,
    ConfirmDialogModule,
    ConfirmDialog,
    TimeAgoPipe,
    MenuComponent,
  ],
  templateUrl: './application-overview-for-applicant.component.html',
})

/**
 *
 * This Angular component is responsible for displaying a paginated and dynamic overview
 * of applications submitted by the applicant. It uses a dynamic table
 * to list applications along with relevant details such as job title, research group,
 * application status, and creation time.
 */
export default class ApplicationOverviewForApplicantComponent {
  loading = signal(true);
  pageData = signal<ApplicationOverviewDTO[]>([]);
  pageSize = signal<number>(10);
  total = signal<number>(0);

  sortBy = signal<string>('createdAt');
  sortDirection = signal<'ASC' | 'DESC'>('DESC');

  // Stores the last lazy load event to enable data refresh after actions
  lastLazyLoadEvent = signal<TableLazyLoadEvent | undefined>(undefined);

  // Template reference for action buttons (e.g., View, Withdraw, Delete)
  readonly actionTemplate = viewChild.required<TemplateRef<unknown>>('actionTemplate');

  // Template reference for status badge display
  readonly badgeTemplate = viewChild.required<TemplateRef<unknown>>('stateTemplate');

  // Template reference for job title display
  readonly jobNameTemplate = viewChild.required<TemplateRef<unknown>>('jobNameTemplate');

  // Template reference for created column (relative time)
  readonly timeSinceCreationTemplate = viewChild.required<TemplateRef<unknown>>('timeSinceCreationTemplate');

  // Dialog visibility signals
  showWithdrawDialog = signal(false);
  showDeleteDialog = signal(false);

  // Track current application ID for dialogs
  currentApplicationId = signal<string | undefined>(undefined);

  // Computed table column definitions including custom templates
  readonly columns = computed<DynamicTableColumn[]>(() => {
    const actionTemplate = this.actionTemplate();
    const badgeTemplate = this.badgeTemplate();
    const jobNameTemplate = this.jobNameTemplate();
    const timeSinceCreationTemplate = this.timeSinceCreationTemplate();
    return [
      {
        field: 'jobTitle',
        header: 'entity.applicationOverview.columns.positionTitle',
        width: '34rem',
        template: jobNameTemplate,
      },
      {
        field: 'researchGroup',
        header: 'entity.applicationOverview.columns.researchGroup',
        width: '20rem',
      },
      {
        field: 'badges',
        header: 'entity.applicationOverview.columns.status',
        width: '10rem',
        template: badgeTemplate,
      },
      {
        field: 'createdAt',
        header: 'entity.applicationOverview.columns.created',
        width: '10rem',
        template: timeSinceCreationTemplate,
      },
      {
        field: 'actions',
        header: '',
        width: '15rem',
        template: actionTemplate,
      },
    ];
  });

  readonly sortableFields: SortOption[] = [
    { displayName: 'entity.applicationOverview.columns.created', fieldName: 'createdAt', type: 'TEXT' },
  ];

  // Computed signal that creates a map of application IDs to their menu items
  readonly applicationMenuItems = computed<Map<string, JhiMenuItem[]>>(() => {
    const menuMap = new Map<string, JhiMenuItem[]>();

    for (const application of this.pageData()) {
      if (application.applicationId === undefined) continue;

      const items: JhiMenuItem[] = [];
      const applicationId = application.applicationId;

      // Edit action - only for SAVED applications
      if (application.applicationState === ApplicationOverviewDTOApplicationStateEnum.Saved) {
        items.push({
          label: 'button.edit',
          icon: 'pencil',
          severity: 'primary',
          command: () => {
            this.onUpdateApplication(applicationId);
          },
        });
      }

      // Withdraw: only while the application is still in SENT (i.e. not yet
      // picked up for review). Server also enforces the job-deadline guard.
      if (application.applicationState === ApplicationOverviewDTOApplicationStateEnum.Sent) {
        items.push({
          label: 'button.withdraw',
          icon: 'withdraw',
          severity: 'danger',
          command: () => {
            this.currentApplicationId.set(applicationId);
            this.showWithdrawDialog.set(true);
          },
        });
      }

      // Delete action - only for SAVED applications
      if (application.applicationState === ApplicationOverviewDTOApplicationStateEnum.Saved) {
        items.push({
          label: 'button.delete',
          icon: 'trash',
          severity: 'danger',
          command: () => {
            this.currentApplicationId.set(applicationId);
            this.showDeleteDialog.set(true);
          },
        });
      }

      menuMap.set(applicationId, items);
    }

    return menuMap;
  });

  readonly getMenuItems = computed(() => {
    const menuMap = this.applicationMenuItems();
    return (application: ApplicationOverviewDTO): JhiMenuItem[] => {
      if (application.applicationId === undefined) return [];
      return menuMap.get(application.applicationId) ?? [];
    };
  });

  private readonly router = inject(Router);
  private toastService = inject(ToastService);

  private readonly applicationApi = inject(ApplicationResourceApi);
  private readonly accountService = inject(AccountService);

  private applicantId = signal<string>('');

  private initEffect = effect(() => {
    this.applicantId.set(this.accountService.loadedUser()?.id ?? '');
  });

  async loadPage(event: TableLazyLoadEvent): Promise<void> {
    this.lastLazyLoadEvent.set(event);
    this.loading.set(true);

    const first = event.first ?? 0;
    const rows = event.rows ?? 10;
    const pageIndex = first / rows;

    try {
      const page = await firstValueFrom(
        this.applicationApi.getApplicationPages(rows, pageIndex, this.sortBy(), this.sortDirection()).pipe(),
      );
      this.pageData.set(page.content ?? []);
      this.total.set(page.totalElements ?? 0);
    } catch (error) {
      console.error('Failed to load applications:', error);
    } finally {
      this.loading.set(false);
    }
  }

  onViewApplication(applicationId: string): void {
    void this.router.navigate([`/application/detail/${applicationId}`]);
  }

  onUpdateApplication(applicationId: string): void {
    void this.router.navigate(['/application/form'], {
      queryParams: {
        application: applicationId,
      },
    });
  }

  onDeleteApplication(applicationId: string): void {
    this.applicationApi.deleteApplication(applicationId).subscribe({
      next: () => {
        this.toastService.showSuccess({ detail: 'Application successfully deleted' });
        const event = this.lastLazyLoadEvent();
        if (event) void this.loadPage(event);
      },
      error: err => {
        this.toastService.showError({ detail: 'Error deleting the application' });
        console.error('Delete failed', err);
      },
    });
  }

  onWithdrawApplication(applicationId: string): void {
    this.applicationApi.withdrawApplication(applicationId).subscribe({
      next: () => {
        this.toastService.showSuccess({ detail: 'Application successfully withdrawn' });
        const event = this.lastLazyLoadEvent();
        if (event) void this.loadPage(event);
      },
      error: err => {
        this.toastService.showError({ detail: 'Error withdrawing the application' });
        console.error('Withdraw failed', err);
      },
    });
  }

  onBrowsePositions(): void {
    void this.router.navigate(['/job-overview']);
  }
}
