import { Component, Signal, computed, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import dayjs from 'dayjs/esm';
import { LangChangeEvent, TranslateModule, TranslateService } from '@ngx-translate/core';
import { TooltipModule } from 'primeng/tooltip';
import { AccountService } from 'app/core/auth/account.service';
import { ToastService } from 'app/service/toast-service';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';
import { trimWebsiteUrl } from 'app/shared/util/util';
import { ButtonColor, ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { BackButtonComponent } from 'app/shared/components/atoms/back-button/back-button.component';
import { ActionButton } from 'app/shared/components/atoms/button/button.types';
import { TagComponent } from 'app/shared/components/atoms/tag/tag.component';
import { getJobPDFLabels } from 'app/shared/language/pdf-labels';
import { JobResourceApi } from 'app/generated/api/job-resource-api';
import { ResearchGroupResourceApi } from 'app/generated/api/research-group-resource-api';
import { JobFormDTO, JobFormDTOTvlGradeEnum } from 'app/generated/model/job-form-dto';
import { JobDetailDTO } from 'app/generated/model/job-detail-dto';
import { RecommendationType } from 'app/generated/model/recommendation-type';
import { PdfExportResourceApi } from 'app/generated/api/pdf-export-resource-api';
import { JobPreviewRequest } from 'app/generated/model/job-preview-request';
import { JhiMenuItem, MenuComponent } from 'app/shared/components/atoms/menu/menu.component';
import { InfoBoxComponent } from 'app/shared/components/atoms/info-box/info-box.component';
import TranslateDirective from 'app/shared/language/translate.directive';
import LocalizedDatePipe from 'app/shared/pipes/localized-date.pipe';
import { createMenuActionSignals } from 'app/shared/util/util';
import { ApplicationForApplicantDTOApplicationStateEnum } from 'app/generated/model/application-for-applicant-dto';
import { JobFormDTOFundingTypeEnum, JobFormDTOLocationEnum, JobFormDTOSubjectAreaEnum } from 'app/generated/model/job-form-dto';
import { JobDetailDTOStateEnum } from 'app/generated/model/job-detail-dto';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';

import * as DropDownOptions from '../dropdown-options';

type ApplicationStateEnum = ApplicationForApplicantDTOApplicationStateEnum;
export interface JobDetails {
  supervisingProfessor: string;
  researchGroup: string;
  title: string;
  subjectArea: JobFormDTOSubjectAreaEnum;
  researchArea: string;
  location: JobFormDTOLocationEnum;
  workload: string;
  contractDuration: string;
  fundingType: JobFormDTOFundingTypeEnum | undefined;
  tvlGrade: JobFormDTOTvlGradeEnum | undefined;
  jobDescriptionEN: string;
  jobDescriptionDE: string;
  startDate: string;
  startDateByArrangement: boolean;
  endDate: string;
  createdAt: string;
  lastModifiedAt: string;

  researchGroupDescription: string;
  researchGroupDepartment: string;
  researchGroupEmail: string;
  researchGroupWebsite: string;
  researchGroupStreet: string;
  researchGroupPostalCode: string;
  researchGroupCity: string;

  jobState: JobDetailDTOStateEnum | undefined;
  belongsToResearchGroup: boolean;

  applicationId?: string;
  applicationState?: ApplicationStateEnum;

  suitableForDisabled?: boolean;

  referenceLettersRequired: number;
  recommendationType?: RecommendationType;
}

@Component({
  selector: 'jhi-job-detail',
  imports: [
    ButtonComponent,
    BackButtonComponent,
    FontAwesomeModule,
    TranslateModule,
    TranslateDirective,
    TagComponent,
    ConfirmDialog,
    TooltipModule,
    MenuComponent,
    LocalizedDatePipe,
    InfoBoxComponent,
  ],
  templateUrl: './job-detail.component.html',
})
export class JobDetailComponent {
  readonly dropDownOptions = DropDownOptions;
  readonly closeButtonLabel = 'button.close';
  readonly closeButtonSeverity = 'danger' as ButtonColor;
  readonly closeButtonIcon = 'xmark';
  readonly deleteButtonLabel = 'button.delete';
  readonly deleteButtonSeverity = 'danger' as ButtonColor;
  readonly deleteButtonIcon = 'trash';

  // Input for preview data, used in the job creation overview step
  previewData = input<Signal<JobFormDTO | undefined>>();
  isSummaryPage = input<boolean>(false);

  showCloseDialog = signal(false);
  showDeleteDialog = signal(false);

  userId = signal<string>('');
  jobId = signal<string>('');

  jobDetails = signal<JobDetails | null>(null);

  dataLoaded = signal<boolean>(false);

  translate = inject(TranslateService);
  langChange: Signal<LangChangeEvent | undefined> = toSignal(this.translate.onLangChange, { initialValue: undefined });
  noData = computed<string>(() => {
    this.langChange();
    return this.translate.instant('jobDetailPage.noData');
  });

  pdfExportApi = inject(PdfExportResourceApi);

  readonly primaryActionButton = computed<ActionButton | null>(() => {
    if (this.previewData()) {
      return null;
    }
    const job = this.jobDetails();
    if (!job) return null;

    // Case 1: Not a research group member or professor → show Apply/Edit/View button
    if (!job.belongsToResearchGroup && !this.isProfessorOrEmployee()) {
      switch (job.applicationState) {
        case undefined:
          return {
            label: 'button.apply',
            severity: 'primary',
            onClick: () => {
              this.onApply();
            },
            disabled: false,
            shouldTranslate: true,
          };
        case ApplicationForApplicantDTOApplicationStateEnum.Saved:
          return {
            label: 'button.edit',
            severity: 'primary',
            onClick: () => {
              this.onEditApplication();
            },
            disabled: false,
            shouldTranslate: true,
            icon: 'pencil',
          };
        default:
          return {
            label: 'button.view',
            severity: 'primary',
            onClick: () => {
              this.onViewApplication();
            },
            disabled: false,
            shouldTranslate: true,
          };
      }
    }
    // Case 2: DRAFT → show Edit button
    if (job.jobState === JobDetailDTOStateEnum.Draft) {
      return {
        label: 'button.edit',
        severity: 'primary',
        onClick: () => {
          this.onEditJob();
        },
        disabled: false,
        shouldTranslate: true,
        icon: 'pencil',
      };
    }
    // Case 3: PUBLISHED and belongs to professor → show Close button
    if (job.jobState === JobDetailDTOStateEnum.Published && this.isOwnerOfJob(job)) {
      return {
        label: this.closeButtonLabel,
        severity: this.closeButtonSeverity,
        icon: this.closeButtonIcon,
        onClick: () => {
          this.showCloseDialog.set(true);
        },
        disabled: false,
        shouldTranslate: true,
      };
    }
    // Else → no primary button
    return null;
  });

  readonly showPdfButtonForPreview = computed<boolean>(() => {
    return !!this.previewData();
  });

  readonly stateTextMap = new Map<string, string>([
    [JobDetailDTOStateEnum.Draft, 'jobState.draft'],
    [JobDetailDTOStateEnum.Published, 'jobState.published'],
    [JobDetailDTOStateEnum.Closed, 'jobState.closed'],
    [JobDetailDTOStateEnum.ApplicantFound, 'jobState.applicantFound'],
  ]);

  readonly stateSeverityMap = new Map<string, 'success' | 'info' | 'contrast' | 'secondary' | 'neutral'>([
    [JobDetailDTOStateEnum.Draft, 'neutral'],
    [JobDetailDTOStateEnum.Published, 'secondary'],
    [JobDetailDTOStateEnum.Closed, 'contrast'],
    [JobDetailDTOStateEnum.ApplicantFound, 'success'],
  ]);

  readonly currentJobState = computed<string | undefined>(() => {
    return this.jobDetails()?.jobState;
  });

  // Returns the job description in the currently selected language. Falls back to the other language if empty.
  readonly jobDescriptionForCurrentLang = computed<string>(() => {
    this.langChange();
    const job = this.jobDetails();
    if (!job) return '';
    const isEnglish = this.translate.getCurrentLang() === 'en';

    if (isEnglish) {
      return job.jobDescriptionEN.trim() || job.jobDescriptionDE;
    }
    return job.jobDescriptionDE.trim() || job.jobDescriptionEN;
  });

  readonly jobStateText = computed<string>(() => {
    const jobState = this.currentJobState();
    return jobState ? (this.stateTextMap.get(jobState) ?? 'jobState.unknown') : 'jobState.unknown';
  });

  readonly jobStateColor = computed<'success' | 'info' | 'contrast' | 'secondary' | 'neutral'>(() => {
    const jobState = this.currentJobState();
    return jobState ? (this.stateSeverityMap.get(jobState) ?? 'info') : 'info';
  });

  readonly menuItems = computed<JhiMenuItem[]>(() => {
    const job = this.jobDetails();
    const items: JhiMenuItem[] = [];

    // Always add PDF download option (except for preview data, where it's shown separately)
    if (!this.previewData()) {
      items.push({
        label: 'button.downloadPDF',
        icon: 'file-pdf',
        severity: 'primary',
        command: () => {
          void this.onDownloadPDF();
        },
      });
    }

    if (!job) return items;

    // Case 2: DRAFT → add Delete button to menu
    if (job.jobState === JobDetailDTOStateEnum.Draft && job.belongsToResearchGroup) {
      items.push({
        label: this.deleteButtonLabel,
        icon: this.deleteButtonIcon,
        severity: this.deleteButtonSeverity,
        command: () => {
          this.showDeleteDialog.set(true);
        },
      });
    }

    return items;
  });

  // Menu action signals - determines when to show kebab menu vs individual buttons
  readonly menuActionSignals = createMenuActionSignals({
    hasPrimaryButton: computed(() => !!this.primaryActionButton()),
    menuItems: this.menuItems,
  });

  readonly shouldShowKebabMenu = this.menuActionSignals.shouldShowKebabMenu;
  readonly individualActionButtons = this.menuActionSignals.individualActionButtons;

  private jobApi = inject(JobResourceApi);
  private accountService = inject(AccountService);
  private router = inject(Router);
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  private toastService = inject(ToastService);
  private researchGroupApi = inject(ResearchGroupResourceApi);

  private previewOrInitEffect = effect(() => {
    const previewDataValue = this.previewData()?.();
    if (previewDataValue) {
      void this.loadJobDetailsFromForm(previewDataValue);
    } else {
      void this.init();
    }
  });

  isProfessorOrEmployee(): boolean {
    return this.accountService.hasAnyAuthority([UserShortDTORolesEnum.Professor, UserShortDTORolesEnum.Employee]);
  }

  onEditResearchGroup(): void {
    this.router.navigate(['/research-group/info']);
  }

  hasResearchGroupDescription(): boolean {
    const description = this.jobDetails()?.researchGroupDescription;
    if (!description) return false;

    // Strip HTML tags and check if there's meaningful text content
    const textContent = description.replace(/<[^>]*>/g, '').trim();
    return textContent.length > 0;
  }

  trimWebsiteUrl(url: string): string {
    return trimWebsiteUrl(url);
  }

  onApply(): void {
    this.router.navigate(['/application/form'], {
      queryParams: {
        job: this.jobId(),
      },
    });
  }

  onEditApplication(): void {
    this.router.navigate(['/application/form'], {
      queryParams: {
        job: this.jobId(),
        application: this.jobDetails()?.applicationId,
      },
    });
  }

  onViewApplication(): void {
    this.router.navigate([`/application/detail/${this.jobDetails()?.applicationId}`]);
  }

  onEditJob(): void {
    if (!this.jobId()) {
      console.error('Unable to edit job with job id:', this.jobId());
    }
    this.router.navigate([`/job/edit/${this.jobId()}`]);
  }

  async onCloseJob(): Promise<void> {
    try {
      await firstValueFrom(this.jobApi.changeJobState(this.jobId(), JobDetailDTOStateEnum.Closed));
      this.toastService.showSuccess({ detail: 'Job successfully closed' });
      this.location.back();
    } catch (error) {
      if (error instanceof Error) {
        this.toastService.showError({ detail: `Error closing job: ${error.message}` });
      }
    }
  }

  async onDeleteJob(): Promise<void> {
    try {
      await firstValueFrom(this.jobApi.deleteJob(this.jobId()));
      this.toastService.showSuccess({ detail: 'Job successfully deleted' });
      this.location.back();
    } catch (error) {
      if (error instanceof Error) {
        this.toastService.showError({ detail: `Error deleting job: ${error.message}` });
      }
    }
  }

  async onDownloadPDF(): Promise<void> {
    const labels = getJobPDFLabels(this.translate);

    const previewSignal = this.previewData();
    if (previewSignal) {
      const formData = previewSignal();
      if (!formData) {
        this.toastService.showErrorKey('pdf.couldNotGeneratePdf');
        return;
      }

      const req: JobPreviewRequest = {
        job: formData,
        labels,
      };

      try {
        const response = await firstValueFrom(this.pdfExportApi.exportJobPreviewToPDF(req));
        const contentDisposition = response.headers.get('Content-Disposition');
        const filename = /filename="([^"]+)"/.exec(contentDisposition ?? '')?.[1] ?? 'job.pdf';
        const blob = response.body;
        if (blob) {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          window.URL.revokeObjectURL(url);
        }
      } catch {
        this.toastService.showErrorKey('pdf.couldNotGeneratePdf');
      }
      return;
    }

    const jobId = this.jobId();

    try {
      const response = await firstValueFrom(this.pdfExportApi.exportJobToPDF(jobId, labels));
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = /filename="([^"]+)"/.exec(contentDisposition ?? '')?.[1] ?? 'job.pdf';
      const blob = response.body;
      if (blob) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch {
      this.toastService.showErrorKey('pdf.couldNotGeneratePdf');
    }
  }

  async init(): Promise<void> {
    try {
      // Get logged-in user
      this.userId.set(this.accountService.loadedUser()?.id ?? '');

      // Get current job from route parameters
      this.jobId.set(this.route.snapshot.paramMap.get('job_id') ?? '');
      if (this.jobId() === '') {
        console.error('Invalid job ID');
        this.location.back();
        return;
      }

      const job = await firstValueFrom(this.jobApi.getJobDetails(this.jobId()));
      this.loadJobDetails(job);
      this.dataLoaded.set(true);
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        this.toastService.showError({ detail: `Error loading job details: ${error.status} ${error.statusText}` });
      } else if (error instanceof Error) {
        this.toastService.showError({ detail: `Error loading job details: ${error.message}` });
      }
      this.location.back();
    }
  }

  loadJobDetails(job: JobDetailDTO): void {
    this.jobDetails.set(this.mapToJobDetails(job, this.accountService.loadedUser()));
  }

  private isOwnerOfJob(job: JobDetails): boolean {
    const user = this.accountService.loadedUser();
    return !!user && this.isProfessorOrEmployee() && job.belongsToResearchGroup;
  }

  private mapToJobDetails(
    data: JobDetailDTO | JobFormDTO,
    user?: ReturnType<AccountService['loadedUser']>,
    researchGroupDetails?: {
      department?: {
        name: string;
      };
      description?: string;
      email?: string;
      website?: string;
      street?: string;
      postalCode?: string;
      city?: string;
    },
    isForm = false,
  ): JobDetails {
    const now = dayjs().toISOString();

    const jobDetailDTO = data as JobDetailDTO;

    let supervisingProfessor: string;
    let researchGroup: string;
    let createdAt: string;
    let lastModifiedAt: string;

    if (isForm) {
      supervisingProfessor = user?.name ?? '';
      researchGroup = this.accountService.activeResearchGroup()?.name ?? '';
      createdAt = now;
      lastModifiedAt = now;
    } else {
      supervisingProfessor = jobDetailDTO.supervisingProfessorName;
      researchGroup = jobDetailDTO.researchGroup.name ?? '';
      createdAt = jobDetailDTO.createdAt;
      lastModifiedAt = jobDetailDTO.lastModifiedAt;
    }

    const startDate = data.startDate as string;
    const endDate = data.endDate as string;

    const researchGroupDescription = researchGroupDetails?.description ?? (!isForm ? (jobDetailDTO.researchGroup.description ?? '') : '');
    const researchGroupDepartment =
      researchGroupDetails?.department?.name ?? (!isForm ? (jobDetailDTO.researchGroup.departmentName ?? '') : '');
    const researchGroupEmail = researchGroupDetails?.email ?? (!isForm ? (jobDetailDTO.researchGroup.email ?? '') : '');
    const researchGroupWebsite = researchGroupDetails?.website ?? (!isForm ? (jobDetailDTO.researchGroup.website ?? '') : '');
    const researchGroupStreet = researchGroupDetails?.street ?? (!isForm ? (jobDetailDTO.researchGroup.street ?? '') : '');
    const researchGroupPostalCode = researchGroupDetails?.postalCode ?? (!isForm ? (jobDetailDTO.researchGroup.postalCode ?? '') : '');
    const researchGroupCity = researchGroupDetails?.city ?? (!isForm ? (jobDetailDTO.researchGroup.city ?? '') : '');

    return {
      supervisingProfessor,
      researchGroup,
      title: data.title,
      subjectArea: data.subjectArea as JobFormDTOSubjectAreaEnum,
      researchArea: data.researchArea ?? '',
      location: data.location as JobFormDTOLocationEnum,
      workload: data.workload?.toString() ?? '',
      contractDuration: data.contractDuration?.toString() ?? '',
      fundingType: data.fundingType as JobFormDTOFundingTypeEnum | undefined,
      tvlGrade: data.tvlGrade as JobFormDTOTvlGradeEnum | undefined,
      jobDescriptionEN: data.jobDescriptionEN ?? '',
      jobDescriptionDE: data.jobDescriptionDE ?? '',
      startDate,
      startDateByArrangement: data.startDateByArrangement ?? false,
      endDate,
      createdAt,
      lastModifiedAt,

      researchGroupDescription,
      researchGroupDepartment,
      researchGroupEmail,
      researchGroupWebsite,
      researchGroupStreet,
      researchGroupPostalCode,
      researchGroupCity,

      referenceLettersRequired: isForm
        ? ((data as JobFormDTO).referenceLettersRequired ?? 0)
        : (jobDetailDTO.referenceLettersRequired ?? 0),
      recommendationType: isForm ? (data as JobFormDTO).recommendationType : jobDetailDTO.recommendationType,

      jobState: isForm ? JobDetailDTOStateEnum.Draft : jobDetailDTO.state,
      belongsToResearchGroup:
        !isForm && jobDetailDTO.researchGroup.researchGroupId === this.accountService.activeResearchGroup()?.researchGroupId,

      applicationId: jobDetailDTO.applicationId ?? undefined,
      applicationState: jobDetailDTO.applicationState ?? undefined,

      suitableForDisabled: data.suitableForDisabled,
    };
  }

  private async loadJobDetailsFromForm(form: JobFormDTO): Promise<void> {
    const user = this.accountService.loadedUser();
    let researchGroupDetails;
    try {
      researchGroupDetails = await firstValueFrom(
        this.researchGroupApi.getResourceGroupDetails(this.accountService.activeResearchGroup()?.researchGroupId ?? ''),
      );
    } catch {
      this.toastService.showError({ detail: `Error loading research Group details.` });
    }

    this.jobDetails.set(this.mapToJobDetails(form, user, researchGroupDetails, true));
    this.dataLoaded.set(true);
  }
}
