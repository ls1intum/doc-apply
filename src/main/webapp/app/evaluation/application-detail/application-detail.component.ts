import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ToastService } from 'app/service/toast-service';
import { DividerModule } from 'primeng/divider';
import { DialogModule } from 'primeng/dialog';
import { SearchFilterSortBar } from 'app/shared/components/molecules/search-filter-sort-bar/search-filter-sort-bar';
import { FilterChange } from 'app/shared/components/atoms/filter-multiselect/filter-multiselect';
import { Sort } from 'app/shared/components/atoms/sorting/sorting';
import { ApplicationCarouselComponent } from 'app/shared/components/organisms/application-carousel/application-carousel.component';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { UserAvatarComponent } from 'app/shared/components/atoms/user-avatar/user-avatar.component';
import { ReviewDialogComponent } from 'app/shared/components/molecules/review-dialog/review-dialog.component';
import { ApplicationEvaluationResourceApi } from 'app/generated/api/application-evaluation-resource-api';
import { ApplicationResourceApi } from 'app/generated/api/application-resource-api';
import { InterviewResourceApi } from 'app/generated/api/interview-resource-api';
import { ApplicationEvaluationDetailDTO } from 'app/generated/model/application-evaluation-detail-dto';
import { AcceptDTO } from 'app/generated/model/accept-dto';
import { RejectDTO } from 'app/generated/model/reject-dto';
import { ApplicationEvaluationDetailListDTO } from 'app/generated/model/application-evaluation-detail-list-dto';
import { ApplicationDocumentIdsDTO } from 'app/generated/model/application-document-ids-dto';
import { formatGradeWithTranslation } from 'app/core/util/grade-conversion';
import LocalizedDatePipe from 'app/shared/pipes/localized-date.pipe';
import { TooltipModule } from 'primeng/tooltip';
import { ApplicationDetailDTOApplicationStateEnum } from 'app/generated/model/application-detail-dto';

import TranslateDirective from '../../shared/language/translate.directive';
import { Section } from '../../shared/components/atoms/section/section';
import { SubSection } from '../../shared/components/atoms/sub-section/sub-section';
import { Prose } from '../../shared/components/atoms/prose/prose';
import { DocumentSection } from '../../shared/components/organisms/document-section/document-section';
import { availableStatusOptions, sortableFields } from '../filterSortOptions';
import { CommentSection } from '../../shared/components/molecules/comment-section/comment-section';
import { InterviewRatingSection } from '../../shared/components/molecules/interview-rating-section/interview-rating-section';
import { RatingSection } from '../../shared/components/molecules/rating-section/rating-section';
import { ReferenceAssessmentSectionComponent } from '../../shared/components/molecules/reference-assessment-section/reference-assessment-section.component';

type ApplicationStateEnum = ApplicationDetailDTOApplicationStateEnum;

const CAROUSEL_SIZE = 7;

@Component({
  selector: 'jhi-application-detail',
  imports: [
    ApplicationCarouselComponent,
    DividerModule,
    DialogModule,
    FontAwesomeModule,
    SearchFilterSortBar,
    TranslateModule,
    ButtonComponent,
    UserAvatarComponent,
    ReviewDialogComponent,
    TranslateDirective,
    Section,
    SubSection,
    Prose,
    DocumentSection,
    CommentSection,
    RatingSection,
    ReferenceAssessmentSectionComponent,
    InterviewRatingSection,
    LocalizedDatePipe,
    TooltipModule,
  ],
  templateUrl: './application-detail.component.html',
})
export class ApplicationDetailComponent {
  readonly interviewRating = signal<number | undefined>(undefined);
  readonly interviewAssessmentNotes = signal<string | undefined>(undefined);
  readonly hasInterviewRating = computed(() => this.interviewRating() !== undefined);

  applications = signal<ApplicationEvaluationDetailDTO[]>([]);
  totalRecords = signal<number>(0);
  currentIndex = signal<number>(0);
  carouselIndex = signal<number>(0);
  searchQuery = signal<string>('');

  currentApplication = signal<ApplicationEvaluationDetailDTO | undefined>(undefined);
  currentDocumentIds = signal<ApplicationDocumentIdsDTO | undefined>(undefined);
  currentReferenceRequests = computed(() => this.currentApplication()?.applicationDetailDTO.references ?? []);
  hasReferenceAssessments = computed(() =>
    this.currentReferenceRequests().some(reference => reference.overallRecommendation !== undefined),
  );
  referenceLettersConfidential = computed(() => this.currentApplication()?.applicationDetailDTO.referenceLettersConfidential ?? true);
  sortBy = signal<string>('appliedAt');
  sortDirection = signal<'ASC' | 'DESC'>('DESC');

  readonly selectedJobFilters = signal<string[]>([]);
  readonly selectedStatusFilters = signal<string[]>([]);

  readonly availableStatusOptions = availableStatusOptions;

  readonly availableStatusLabels = this.availableStatusOptions.map(option => option.label);

  allAvailableJobNames = signal<string[]>([]);

  // accept/reject dialog
  reviewDialogVisible = signal<boolean>(false);
  reviewDialogMode = signal<'ACCEPT' | 'REJECT'>('ACCEPT');

  // add to interview dialog
  addToInterviewDialogVisible = signal<boolean>(false);

  half = Math.floor(CAROUSEL_SIZE / 2); // Half the carousel size, used for centering

  canReview = computed(() => {
    const currentApplication = this.currentApplication();
    if (!currentApplication) {
      return false;
    }
    const state = currentApplication.applicationDetailDTO.applicationState;

    return (
      state !== ApplicationDetailDTOApplicationStateEnum.Accepted &&
      state !== ApplicationDetailDTOApplicationStateEnum.Rejected &&
      state !== ApplicationDetailDTOApplicationStateEnum.JobClosed
    );
  });

  isAlreadyInInterview = computed(() => {
    const currentApplication = this.currentApplication();
    return currentApplication?.applicationDetailDTO.applicationState === ApplicationDetailDTOApplicationStateEnum.Interview;
  });

  currentApplicationApplicant = computed(() => this.currentApplication()?.applicationDetailDTO.applicant);

  readonly bachelorSummary = computed(() => {
    const applicant = this.currentApplicationApplicant();
    this.currentLang();

    return {
      degree: applicant?.bachelorDegreeName,
      university: applicant?.bachelorUniversity,
      gradeInfo: formatGradeWithTranslation(
        applicant?.bachelorGrade,
        applicant?.bachelorGradeUpperLimit,
        applicant?.bachelorGradeLowerLimit,
        this.translateService,
      ),
    };
  });

  readonly masterSummary = computed(() => {
    const applicant = this.currentApplicationApplicant();
    this.currentLang();

    return {
      degree: applicant?.masterDegreeName,
      university: applicant?.masterUniversity,
      gradeInfo: formatGradeWithTranslation(
        applicant?.masterGrade,
        applicant?.masterGradeUpperLimit,
        applicant?.masterGradeLowerLimit,
        this.translateService,
      ),
    };
  });

  // Privacy toggle for sensitive information
  readonly sensitiveInfoVisible = signal<boolean>(false);

  protected currentApplicationId = computed(() => {
    return this.currentApplication()?.applicationDetailDTO.applicationId;
  });

  protected readonly CAROUSEL_SIZE = CAROUSEL_SIZE;
  protected readonly sortableFields = sortableFields;

  private isSearchInitiatedByUser = false;
  private isSortInitiatedByUser = false;

  private readonly evaluationApi = inject(ApplicationEvaluationResourceApi);
  private readonly applicationApi = inject(ApplicationResourceApi);
  private readonly interviewApi = inject(InterviewResourceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);
  private toastService = inject(ToastService);

  private readonly qpSignal = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private currentLang = toSignal(this.translateService.onLangChange);

  private loadInterviewRatingEffect = effect(() => {
    const id = this.currentApplicationId();
    if (id !== undefined) {
      void this.loadInterviewRating(id);
    } else {
      this.interviewRating.set(undefined);
      this.interviewAssessmentNotes.set(undefined);
    }
  });

  private _queryParamEffect = effect(() => {
    const qp = this.qpSignal();
    const rawSD = qp.get('sortDir');
    this.sortDirection.set(rawSD === 'ASC' || rawSD === 'DESC' ? rawSD : 'DESC');

    if (!this.isSortInitiatedByUser) {
      this.sortBy.set(qp.get('sortBy') ?? this.sortableFields[0].fieldName);
      this.sortDirection.set(rawSD === 'ASC' || rawSD === 'DESC' ? rawSD : 'DESC');
    } else {
      this.isSortInitiatedByUser = false;
    }

    if (!this.isSearchInitiatedByUser) {
      this.searchQuery.set(qp.get('search') ?? '');
    }
    this.isSearchInitiatedByUser = false;
  });

  constructor() {
    void this.init();
  }

  async init(): Promise<void> {
    await this.loadAllJobNames();

    const id = this.qpSignal().get('applicationId');
    if (id !== null && id !== '') {
      void this.loadCarousel(id);
    } else {
      // Load initial batch of applications
      void this.loadInitialPage();
    }
  }

  async loadAllJobNames(): Promise<void> {
    try {
      const jobNames = await firstValueFrom(this.evaluationApi.getAllJobNames());
      this.allAvailableJobNames.set(jobNames.sort());
    } catch {
      this.allAvailableJobNames.set([]);
      this.toastService.showErrorKey('evaluation.errors.loadJobNames');
    }
  }

  onSearchEmit(searchQuery: string): void {
    this.isSearchInitiatedByUser = true;
    this.searchQuery.set(searchQuery);
    void this.loadInitialPage();
  }

  onFilterEmit(filterChange: FilterChange): void {
    if (filterChange.filterId === 'jobTitle') {
      this.selectedJobFilters.set(filterChange.selectedValues);
      void this.loadInitialPage();
    } else if (filterChange.filterId === 'status') {
      const enumValues = this.mapTranslationKeysToEnumValues(filterChange.selectedValues);
      this.selectedStatusFilters.set(enumValues);
      void this.loadInitialPage();
    }
  }

  loadOnSortEmit(event: Sort): void {
    this.isSortInitiatedByUser = true;

    this.sortBy.set(event.field);
    this.sortDirection.set(event.direction);

    void this.loadInitialPage();
  }

  // Navigate to next application
  onNext(): void {
    if (this.currentIndex() >= this.totalRecords() - 1) return;

    this.currentIndex.update(v => v + 1);
    this.carouselIndex.update(v => v + 1);
    const nextApp = this.applications()[this.carouselIndex()];
    this.currentApplication.set(nextApp);

    void this.markCurrentApplicationAsInReview();

    if (this.currentIndex() + this.half < this.totalRecords()) {
      // Load next item if within bounds
      void this.loadNext(this.currentIndex() + this.half);
    } else {
      // Otherwise update the visible carousel
      this.updateApplications();
    }
    this.updateUrlQueryParams();
  }

  // Navigate to previous application
  onPrev(): void {
    if (this.currentIndex() <= 0) return;

    this.currentIndex.update(v => v - 1);
    this.carouselIndex.update(v => v - 1);
    const prevApp = this.applications()[this.carouselIndex()];
    this.currentApplication.set(prevApp);

    void this.markCurrentApplicationAsInReview();

    if (this.currentIndex() - this.half >= 0) {
      // Load previous item if within bounds
      void this.loadPrev(this.currentIndex() - this.half);
    } else {
      // Otherwise update the visible carousel
      this.updateApplications();
    }
    this.updateUrlQueryParams();
  }

  toggleSensitiveInfo(): void {
    this.sensitiveInfoVisible.update(visible => !visible);
  }

  openAddToInterviewDialog(): void {
    this.addToInterviewDialogVisible.set(true);
  }
  openAcceptDialog(): void {
    this.reviewDialogMode.set('ACCEPT');
    this.reviewDialogVisible.set(true);
  }

  openRejectDialog(): void {
    this.reviewDialogMode.set('REJECT');
    this.reviewDialogVisible.set(true);
  }

  async onAddToInterview(navigate: boolean): Promise<void> {
    const application = this.currentApplication();
    const jobId = application?.jobId;
    if (jobId === undefined || jobId === '' || application === undefined) {
      this.toastService.showErrorKey('evaluation.errors.noJobId');
      return;
    }

    try {
      const processes = await firstValueFrom(this.interviewApi.getInterviewOverview());
      const matchingProcess = processes.find(p => p.jobId === application.jobId);

      if (!matchingProcess) {
        this.toastService.showErrorKey('evaluation.errors.noProcessFound');
        return;
      }

      // 2. Add applicant to the found process
      await firstValueFrom(
        this.interviewApi.addApplicantsToInterview(matchingProcess.processId, {
          applicationIds: [application.applicationDetailDTO.applicationId],
        }),
      );

      // 3. Update local state
      this.updateCurrentApplicationState(ApplicationDetailDTOApplicationStateEnum.Interview);
      this.toastService.showSuccess({
        summary: this.translateService.instant('evaluation.addToInterviewDialog.success.summary'),
        detail: this.translateService.instant('evaluation.addToInterviewDialog.success.detail'),
      });
      this.addToInterviewDialogVisible.set(false);

      // 4. Navigate if requested
      if (navigate) {
        await this.router.navigate(['/interviews', matchingProcess.processId]);
      }
    } catch {
      this.toastService.showError({
        summary: this.translateService.instant('evaluation.addToInterviewDialog.error.summary'),
        detail: this.translateService.instant('evaluation.addToInterviewDialog.error.detail'),
      });
    }
  }
  async acceptApplication(acceptDTO: AcceptDTO): Promise<void> {
    const application = this.currentApplication();

    if (application) {
      this.updateCurrentApplicationState(ApplicationDetailDTOApplicationStateEnum.Accepted);

      if (acceptDTO.closeJob === true) {
        // update the state of all applications in memory for this job
        this.rejectOtherApplicationsOfJob(application.jobId ?? '');
      }
      this.reviewDialogVisible.set(false);
      await firstValueFrom(this.evaluationApi.acceptApplication(application.applicationDetailDTO.applicationId, acceptDTO));
    }
  }

  async rejectApplication(rejectDTO: RejectDTO): Promise<void> {
    const application = this.currentApplication();

    if (application) {
      this.updateCurrentApplicationState(ApplicationDetailDTOApplicationStateEnum.Rejected);
      this.reviewDialogVisible.set(false);
      await firstValueFrom(this.evaluationApi.rejectApplication(application.applicationDetailDTO.applicationId, rejectDTO));
    }
  }

  async markCurrentApplicationAsInReview(): Promise<void> {
    const application = this.currentApplication();

    if (application?.applicationDetailDTO.applicationState === ApplicationDetailDTOApplicationStateEnum.Sent) {
      this.updateCurrentApplicationState(ApplicationDetailDTOApplicationStateEnum.InReview);
      await firstValueFrom(this.evaluationApi.markApplicationAsInReview(application.applicationDetailDTO.applicationId));
    }
  }

  updateCurrentApplicationState(newState: ApplicationStateEnum): void {
    const current = this.currentApplication();

    if (!current) {
      console.error('Current application is undefined');
      return;
    }

    const id = current.applicationDetailDTO.applicationId;

    // update applications
    this.applications.update(apps =>
      apps.map(app =>
        app.applicationDetailDTO.applicationId === id
          ? {
              ...app,
              applicationDetailDTO: {
                ...app.applicationDetailDTO,
                applicationState: newState,
              },
            }
          : app,
      ),
    );

    // update current application
    this.currentApplication.set({
      ...current,
      applicationDetailDTO: {
        ...current.applicationDetailDTO,
        applicationState: newState,
      },
    });
  }

  /**
   * Loads the interview rating and assessment notes for the given application.
   * Hides the interview row when no rating has been recorded yet.
   *
   * @param applicationId the id of the currently displayed application
   */
  async loadInterviewRating(applicationId: string): Promise<void> {
    try {
      const response = await firstValueFrom(this.interviewApi.getInterviewRatingForApplication(applicationId));
      this.interviewRating.set(response.rating ?? undefined);
      this.interviewAssessmentNotes.set(response.assessmentNotes ?? undefined);
    } catch {
      this.toastService.showErrorKey('evaluation.errors.loadInterviewRating');
      this.interviewRating.set(undefined);
      this.interviewAssessmentNotes.set(undefined);
    }
  }

  async onRatingUpdated(): Promise<void> {
    const current = this.currentApplication();
    if (!current) {
      return;
    }

    const id = current.applicationDetailDTO.applicationId;

    try {
      // Fetch the updated application with server-calculated average rating
      const result = await firstValueFrom(
        this.evaluationApi.getApplicationsDetailsWindow(
          id,
          1, // windowSize = 1 to get just this application
          this.sortBy(),
          this.sortDirection(),
          this.selectedStatusFilters().length ? this.selectedStatusFilters() : undefined,
          this.selectedJobFilters().length ? this.selectedJobFilters() : undefined,
          this.searchQuery() || undefined,
        ),
      );

      const updated = result.applications?.[0];
      if (!updated) {
        return;
      }

      // Update applications array with refreshed data
      this.applications.update(apps => apps.map(app => (app.applicationDetailDTO.applicationId === id ? updated : app)));

      // Update current application
      this.currentApplication.set(updated);
    } catch {
      // Silent fail - rating is already saved, this is just a UI refresh
    }
  }

  /**
   * sets the Application State of all Applications (in memory) to "REJECTED" for a specific job
   */
  rejectOtherApplicationsOfJob(jobId: string): void {
    this.applications.update(apps =>
      apps.map(application =>
        application.jobId === jobId &&
        (application.applicationDetailDTO.applicationState === ApplicationDetailDTOApplicationStateEnum.Sent ||
          application.applicationDetailDTO.applicationState === ApplicationDetailDTOApplicationStateEnum.InReview ||
          application.applicationDetailDTO.applicationState === ApplicationDetailDTOApplicationStateEnum.Interview)
          ? {
              ...application,
              applicationDetailDTO: {
                ...application.applicationDetailDTO,
                applicationState: ApplicationDetailDTOApplicationStateEnum.Rejected,
              },
            }
          : application,
      ),
    );
  }

  private mapTranslationKeysToEnumValues(translationKeys: string[]): string[] {
    const keyMap = new Map(this.availableStatusOptions.map(option => [option.label, option.key]));
    return translationKeys.map(key => keyMap.get(key) ?? key);
  }

  /**
   * Loads a page of applications from server.
   * Also updates total count of applications.
   */
  private async loadPage(offset: number, limit: number): Promise<ApplicationEvaluationDetailDTO[] | undefined> {
    try {
      const statusFilters = this.selectedStatusFilters().length > 0 ? this.selectedStatusFilters() : [];
      const jobFilters = this.selectedJobFilters().length > 0 ? this.selectedJobFilters() : [];
      const search = this.searchQuery();
      const res: ApplicationEvaluationDetailListDTO = await firstValueFrom(
        this.evaluationApi.getApplicationsDetails(
          offset,
          limit,
          this.sortBy(),
          this.sortDirection(),
          statusFilters.length ? statusFilters : undefined,
          jobFilters.length ? jobFilters : undefined,
          search || undefined,
        ),
      );
      this.totalRecords.set(res.totalRecords ?? 0);
      return res.applications ?? undefined;
    } catch {
      this.toastService.showErrorKey('evaluation.errors.loadApplications');
      return undefined;
    }
  }

  private async loadCarousel(applicationId: string): Promise<void> {
    try {
      const statusFilters = this.selectedStatusFilters().length > 0 ? this.selectedStatusFilters() : [];
      const jobFilters = this.selectedJobFilters().length > 0 ? this.selectedJobFilters() : [];

      const search = this.searchQuery();
      const res: ApplicationEvaluationDetailListDTO = await firstValueFrom(
        this.evaluationApi.getApplicationsDetailsWindow(
          applicationId,
          CAROUSEL_SIZE,
          this.sortBy(),
          this.sortDirection(),
          statusFilters.length ? statusFilters : undefined,
          jobFilters.length ? jobFilters : undefined,
          search || undefined,
        ),
      );
      this.totalRecords.set(res.totalRecords ?? 0);
      this.applications.set(res.applications ?? []);
      this.carouselIndex.set(res.windowIndex ?? 0);
      this.currentIndex.set(res.currentIndex ?? 0);
      this.currentApplication.set(this.applications()[this.carouselIndex()]);
      this.updateDocumentInformation(this.applications()[this.carouselIndex()].applicationDetailDTO.applicationId);
      void this.markCurrentApplicationAsInReview();
    } catch {
      this.toastService.showErrorKey('evaluation.errors.loadApplications');
      return undefined;
    }
  }

  /**
   * Loads the next application and appends it to the right side of the current carousel.
   * Adjusts carousel to keep the size fixed (CAROUSEL_SIZE).
   */
  private async loadNext(i: number): Promise<void> {
    const newEntry = await this.loadPage(i, 1);
    if (newEntry) {
      let apps = [...this.applications(), ...newEntry];
      // Keep carousel size fixed
      if (apps.length > CAROUSEL_SIZE) {
        apps = apps.slice(apps.length - CAROUSEL_SIZE);
        this.carouselIndex.update(v => v - 1); // Adjust index to match slice
      }
      this.applications.set(apps);
      this.updateDocumentInformation(apps[this.carouselIndex()].applicationDetailDTO.applicationId);
    }
  }

  /**
   * Loads the previous application and prepends it to the left side of the carousel.
   * Adjusts carousel to keep the size fixed (CAROUSEL_SIZE).
   */
  private async loadPrev(i: number): Promise<void> {
    const newEntry = await this.loadPage(i, 1);
    if (newEntry) {
      let apps = [...newEntry, ...this.applications()];
      if (apps.length > CAROUSEL_SIZE) {
        apps = apps.slice(0, CAROUSEL_SIZE);
      }
      this.carouselIndex.update(v => v + 1); // Adjust index to match new position
      this.applications.set(apps);
      this.updateDocumentInformation(apps[this.carouselIndex()].applicationDetailDTO.applicationId);
    }
  }

  /**
   * Loads the initial carousel of applications when component initializes.
   * Uses half of the carousel size to center the first item.
   */
  private async loadInitialPage(): Promise<void> {
    const data = await this.loadPage(0, this.half + 1);
    if (data) {
      this.currentIndex.set(0);
      this.carouselIndex.set(0);
      this.applications.set(data);
      this.currentApplication.set(data[0]);
      void this.markCurrentApplicationAsInReview();
      this.updateUrlQueryParams();
      this.updateDocumentInformation(data[this.carouselIndex()].applicationDetailDTO.applicationId);
    }
  }

  /**
   * Trims or shifts the application carousel when the internal index drifts
   * outside the center (e.g. after multiple navigations).
   * Ensures the centered item is properly positioned in the middle.
   */
  private updateApplications(): void {
    const carouselIndex = this.carouselIndex();
    const apps = this.applications();

    if (carouselIndex > this.half) {
      // Trim the front of the carousel
      const diff = carouselIndex - this.half;
      this.applications.set(apps.slice(diff));
      this.carouselIndex.update(v => v - diff);
    } else if (apps.length - carouselIndex - 1 > this.half) {
      // Trim the end of the carousel
      const diff = apps.length - carouselIndex - 1 - this.half;
      this.applications.set(apps.slice(0, apps.length - diff));
    }
    this.updateDocumentInformation(this.applications()[this.carouselIndex()].applicationDetailDTO.applicationId);
  }

  private buildQueryParams(): Params {
    const baseParams: Params = {
      sortBy: this.sortBy(),
      sortDir: this.sortDirection(),
      applicationId: this.currentApplication()?.applicationDetailDTO.applicationId,
    };

    if (this.searchQuery()) {
      baseParams.search = this.searchQuery();
    }

    const filterParams: Params = {};

    return {
      ...baseParams,
      ...filterParams,
    };
  }

  private updateUrlQueryParams(): void {
    const qp: Params = this.buildQueryParams();
    void this.router.navigate([], {
      queryParams: qp,
      replaceUrl: true,
    });
  }

  private updateDocumentInformation(applicationId: string): void {
    firstValueFrom(this.applicationApi.getDocumentIds(applicationId))
      .then(ids => {
        this.currentDocumentIds.set(ids);
      })
      .catch(() => this.toastService.showError({ summary: 'Error', detail: 'fetching the document ids for this application' }));
  }
}
