import { Component, TemplateRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { ProgressStepperComponent, StepData } from 'app/shared/components/molecules/progress-stepper/progress-stepper.component';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AccountService } from 'app/core/auth/account.service';
import { ToastService } from 'app/service/toast-service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';
import { ButtonColor } from 'app/shared/components/atoms/button/button.component';
import { ApplicationDraftData, LocalStorageService } from 'app/service/localStorage.service';
import ApplicationDetailForApplicantComponent from 'app/application/application-detail-for-applicant/application-detail-for-applicant.component';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { OtpInput } from 'app/shared/components/atoms/otp-input/otp-input';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { DividerModule } from 'primeng/divider';
import { CheckboxModule } from 'primeng/checkbox';
import { SavingStates } from 'app/shared/constants/saving-states';
import { AutoSaveController } from 'app/shared/util/auto-save-controller';
import { SavingBadgeComponent } from 'app/shared/components/atoms/saving-badge/saving-badge.component';
import { JobResourceApi } from 'app/generated/api/job-resource-api';
import { MessageComponent } from 'app/shared/components/atoms/message/message.component';
import { ApplicationDetailDTOApplicationStateEnum } from 'app/generated/model/application-detail-dto';
import { ApplicationForApplicantDTOApplicationStateEnum } from 'app/generated/model/application-for-applicant-dto';
import TranslateDirective from 'app/shared/language/translate.directive';
import { AuthFacadeService } from 'app/core/auth/auth-facade.service';
import { ApplicationDetailDTO } from 'app/generated/model/application-detail-dto';
import { ApplicationForApplicantDTO } from 'app/generated/model/application-for-applicant-dto';
import { ApplicationDocumentIdsDTO } from 'app/generated/model/application-document-ids-dto';
import { ApplicationResourceApi } from 'app/generated/api/application-resource-api';
import { UpdateApplicationDTO } from 'app/generated/model/update-application-dto';
import { AuthOrchestratorService } from 'app/core/auth/auth-orchestrator.service';
import { ExtractedCertificateDataDTO } from 'app/generated/model/extracted-certificate-data-dto';
import { ReferenceRequestDTO } from 'app/generated/model/reference-request-dto';
import { RecommendationType } from 'app/generated/model/recommendation-type';
import { CheckboxComponent } from 'app/shared/components/atoms/checkbox/checkbox.component';

import ApplicationCreationPage2Component, {
  ApplicationCreationPage2Data,
  getPage2FromApplication,
} from '../application-creation-page2/application-creation-page2.component';
import ApplicationCreationPage3Component, {
  ApplicationCreationPage3Data,
  getPage3FromApplication,
} from '../application-creation-page3/application-creation-page3.component';
import ApplicationCreationPage1Component, {
  ApplicationCreationPage1Data,
  getPage1FromApplication,
} from '../application-creation-page1/application-creation-page1.component';
import ApplicationCreationReferencesComponent from '../application-creation-references/application-creation-references.component';

const applyflow = 'entity.toast.applyFlow';

@Component({
  selector: 'jhi-application-creation-form',
  imports: [
    ReactiveFormsModule,
    DividerModule,
    CheckboxModule,
    ProgressStepperComponent,
    ApplicationCreationPage1Component,
    ApplicationCreationPage2Component,
    ApplicationCreationPage3Component,
    ApplicationCreationReferencesComponent,
    FontAwesomeModule,
    TranslateModule,
    ConfirmDialog,
    ApplicationDetailForApplicantComponent,
    TranslateDirective,
    MessageComponent,
    SavingBadgeComponent,
    CheckboxComponent,
  ],
  templateUrl: './application-creation-form.component.html',
  providers: [DialogService],
  standalone: true,
})
export default class ApplicationCreationFormComponent {
  private static readonly MAX_OTP_WAIT_TIME_MS = 600_000; // 10 minutes
  readonly sendButtonSeverity = 'primary' as ButtonColor;
  readonly sendButtonIcon = 'paper-plane';

  personalInfoData = signal<ApplicationCreationPage1Data>({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    gender: undefined,
    nationality: undefined,
    dateOfBirth: '',
    website: '',
    linkedIn: '',
    street: '',
    city: '',
    country: undefined,
    postcode: '',
  });

  educationData = signal<ApplicationCreationPage2Data>({
    bachelorDegreeName: '',
    bachelorDegreeUniversity: '',
    bachelorGradeUpperLimit: '',
    bachelorGradeLowerLimit: '',
    bachelorGrade: '',
    masterDegreeName: '',
    masterDegreeUniversity: '',
    masterGradeUpperLimit: '',
    masterGradeLowerLimit: '',
    masterGrade: '',
  });

  applicationDetailsData = signal<ApplicationCreationPage3Data>({
    desiredStartDate: '',
    motivation: '',
    skills: '',
    experiences: '',
  });

  previewData = computed(() => this.mapPagesToDTO() as ApplicationDetailDTO);

  personalInfoPanel = viewChild<TemplateRef<ApplicationCreationPage1Component>>('personalInfoPanel');
  educationPanel = viewChild<TemplateRef<ApplicationCreationPage2Component>>('educationPanel');
  applicationDetailsPanel = viewChild<TemplateRef<ApplicationCreationPage3Component>>('applicationDetailsPanel');
  referencesPanel = viewChild<TemplateRef<ApplicationCreationReferencesComponent>>('referencesPanel');
  summaryPanel = viewChild<TemplateRef<ApplicationDetailForApplicantComponent>>('summaryPanel');
  savedStatusPanel = viewChild<TemplateRef<HTMLDivElement>>('saving_state_panel');
  showSendDialog = signal(false);
  progressStepper = viewChild<ProgressStepperComponent>(ProgressStepperComponent);

  title = signal<string>('');
  jobId = signal<string>('');
  applicantId = signal<string>('');
  applicationId = signal<string>('');
  applicationState = signal<ApplicationForApplicantDTOApplicationStateEnum>(ApplicationForApplicantDTOApplicationStateEnum.Saved);

  /** Debounced auto-save controller. Owns the timer and the badge state. */
  readonly autoSave = new AutoSaveController({ save: () => this.executeAutoSave() });

  personalInfoDataValid = signal<boolean>(false);
  educationDataValid = signal<boolean>(false);
  applicationDetailsDataValid = signal<boolean>(false);
  references = signal<ReferenceRequestDTO[]>([]);
  referenceLettersConfidential = signal<boolean>(true);
  referenceLettersRequired = signal<number>(0);
  referenceLettersEnabled = computed(() => this.referenceLettersRequired() > 0);
  recommendationType = signal<RecommendationType | undefined>(undefined);
  savingTick = signal<number>(0);
  allPagesValid = computed(() => this.personalInfoDataValid() && this.educationDataValid() && this.applicationDetailsDataValid());
  documentIds = signal<ApplicationDocumentIdsDTO | undefined>(undefined);
  readonly formbuilder = inject(FormBuilder);

  dialogService = inject(DialogService);
  location = inject(Location);
  useLocalStorage = signal<boolean>(false);

  readonly additionalInfoForm = this.formbuilder.nonNullable.group({
    privacyAccepted: this.formbuilder.nonNullable.control(false, {
      validators: Validators.requiredTrue,
    }),
    doctoralRequirementsAccepted: this.formbuilder.nonNullable.control(false, {
      validators: Validators.requiredTrue,
    }),
  });

  readonly privacyAcceptedSignal = toSignal(this.additionalInfoForm.controls.privacyAccepted.valueChanges, {
    initialValue: this.additionalInfoForm.controls.privacyAccepted.value,
  });

  readonly doctoralRequirementsAcceptedSignal = toSignal(this.additionalInfoForm.controls.doctoralRequirementsAccepted.valueChanges, {
    initialValue: this.additionalInfoForm.controls.doctoralRequirementsAccepted.value,
  });

  submitAttempted = signal(false);

  // Stepper config
  stepData = computed<StepData[]>(() => {
    const steps: StepData[] = [];
    const personalInfoPanel = this.personalInfoPanel();
    const educationPanel = this.educationPanel();
    const applicationDetailsPanel = this.applicationDetailsPanel();
    const referencesPanel = this.referencesPanel();
    const summaryPanel = this.summaryPanel();
    const applicantId = this.applicantId();
    const personalInfoDataValid = this.personalInfoDataValid();
    const educationDataValid = this.educationDataValid();
    const applicationDetailsDataValid = this.applicationDetailsDataValid();
    const referencesEnabled = this.referenceLettersEnabled();
    const personalInfoAndEducationDataValid = personalInfoDataValid && educationDataValid;
    const allDataValid = personalInfoDataValid && educationDataValid && applicationDetailsDataValid;
    const allPagesValid = this.allPagesValid();
    const location = this.location;
    const flushAutoSave: () => Promise<void> = () => this.autoSave.flush();
    const statusPanel = this.savedStatusPanel();
    const updateDocumentInformation = this.updateDocumentInformation.bind(this);

    if (personalInfoPanel) {
      steps.push({
        name: 'entity.applicationSteps.personalInformation',
        panelTemplate: personalInfoPanel,
        shouldTranslate: true,
        buttonGroupPrev: [
          {
            variant: 'outlined',
            severity: 'info',
            icon: 'arrow-left',
            onClick(): void {
              void (async () => {
                await flushAutoSave();
                location.back();
              })();
            },
            disabled: false,
            label: 'button.back',
            changePanel: false,
            shouldTranslate: true,
          },
        ],
        buttonGroupNext: [
          {
            severity: 'primary',
            icon: 'chevron-right',
            onClick: () => {
              this.handleNextFromStep1();
            },
            disabled: !personalInfoDataValid,
            label: 'button.next',
            shouldTranslate: true,
            changePanel: this.applicantId() !== '',
          },
        ],
        status: statusPanel,
      });
    }

    if (educationPanel) {
      steps.push({
        name: 'entity.applicationSteps.education',
        panelTemplate: educationPanel,
        shouldTranslate: true,
        buttonGroupPrev: [
          {
            variant: 'outlined',
            severity: 'primary',
            icon: 'chevron-left',
            onClick() {
              updateDocumentInformation();
            },
            disabled: false,
            label: 'button.back',
            shouldTranslate: true,
            changePanel: true,
          },
        ],
        buttonGroupNext: [
          {
            severity: 'primary',
            icon: 'chevron-right',
            onClick() {
              updateDocumentInformation();
            },
            disabled: !educationDataValid,
            label: 'button.next',
            shouldTranslate: true,
            changePanel: true,
          },
        ],
        disabled: !personalInfoDataValid || !applicantId,
        status: statusPanel,
      });
    }

    if (applicationDetailsPanel) {
      steps.push({
        name: 'entity.applicationSteps.applicationDetails',
        shouldTranslate: true,
        panelTemplate: applicationDetailsPanel,
        buttonGroupPrev: [
          {
            variant: 'outlined',
            severity: 'primary',
            icon: 'chevron-left',
            onClick() {
              updateDocumentInformation();
            },
            disabled: false,
            label: 'button.back',
            shouldTranslate: true,
            changePanel: true,
          },
        ],
        buttonGroupNext: [
          {
            severity: 'primary',
            icon: 'chevron-right',
            onClick() {
              updateDocumentInformation();
            },
            disabled: !applicationDetailsDataValid,
            label: 'button.next',
            shouldTranslate: true,
            changePanel: true,
          },
        ],
        disabled: !personalInfoAndEducationDataValid || !applicantId,
        status: statusPanel,
      });
    }

    if (referencesEnabled && referencesPanel) {
      steps.push({
        name: 'entity.applicationSteps.references',
        shouldTranslate: true,
        panelTemplate: referencesPanel,
        buttonGroupPrev: [
          {
            variant: 'outlined',
            severity: 'primary',
            icon: 'chevron-left',
            onClick() {
              updateDocumentInformation();
            },
            disabled: false,
            label: 'button.back',
            shouldTranslate: true,
            changePanel: true,
          },
        ],
        buttonGroupNext: [
          {
            severity: 'primary',
            icon: 'chevron-right',
            onClick() {
              updateDocumentInformation();
            },
            disabled: false,
            label: 'button.next',
            shouldTranslate: true,
            changePanel: true,
          },
        ],
        disabled: !applicationDetailsDataValid || !applicantId,
        status: statusPanel,
      });
    }

    if (summaryPanel) {
      steps.push({
        name: 'entity.applicationSteps.summary',
        shouldTranslate: true,
        panelTemplate: summaryPanel,
        buttonGroupPrev: [
          {
            variant: 'outlined',
            severity: 'primary',
            icon: 'chevron-left',
            onClick() {
              updateDocumentInformation();
            },
            disabled: false,
            label: 'button.back',
            shouldTranslate: true,
            changePanel: true,
          },
        ],
        buttonGroupNext: [
          {
            severity: this.sendButtonSeverity,
            icon: this.sendButtonIcon,
            onClick: () => {
              this.showSendDialog.set(true);
            },
            disabled: !allPagesValid,
            label: 'button.submit',
            shouldTranslate: true,
            changePanel: false,
          },
        ],
        disabled: !allDataValid || !applicantId,
        status: statusPanel,
      });
    }
    return steps;
  });
  private readonly applicationApi = inject(ApplicationResourceApi);
  private readonly accountService = inject(AccountService);
  private readonly authFacade = inject(AuthFacadeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly authOrchestrator = inject(AuthOrchestratorService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly translateService = inject(TranslateService);
  private readonly jobApi = inject(JobResourceApi);

  private otpDialogRef: DynamicDialogRef | null = null;
  private initCalled = signal(false);

  private initEffect = effect(() => {
    if (!untracked(() => this.initCalled())) {
      this.initCalled.set(true);
      void this.init();
    }
  });

  async init(): Promise<void> {
    this.applicantId.set(this.accountService.loadedUser()?.id ?? '');

    const jobId = this.route.snapshot.queryParamMap.get('job');
    const applicationId = this.route.snapshot.queryParamMap.get('application');

    if (this.applicantId() === '') {
      this.initPageForLocalStorageCase(jobId);
    } else {
      try {
        let application: ApplicationForApplicantDTO;

        if (applicationId !== null) {
          application = await this.initPageLoadExistingApplication(applicationId);
        } else if (jobId !== null) {
          application = await this.initPageCreateApplication(jobId);
        } else {
          throw new Error('Either job ID or application ID must be provided in the URL.');
        }

        // Set job information
        this.jobId.set(application.job.jobId);
        if (application.job.title && application.job.title.trim().length > 0) {
          this.title.set(application.job.title);
        }
        const required = application.job.referenceLettersRequired ?? 0;
        this.referenceLettersRequired.set(required);
        this.recommendationType.set(application.job.recommendationType);

        this.applicationState.set(application.applicationState);
        this.useLocalStorage.set(false);

        // Load data from application
        this.personalInfoData.set(getPage1FromApplication(application));
        this.educationData.set(getPage2FromApplication(application));
        this.applicationDetailsData.set(getPage3FromApplication(application));
        this.referenceLettersConfidential.set(application.referenceLettersConfidential ?? true);
        this.references.set(application.references ?? []);

        this.updateDocumentInformation();
      } catch (error) {
        const httpError = error as HttpErrorResponse;
        this.showInitErrorMessage(`${applyflow}.loadFailed`);
        throw new Error(`Init failed with HTTP ${httpError.status} ${httpError.statusText}: ${httpError.message}`);
      }
    }
  }

  initPageForLocalStorageCase(jobId: string | null): void {
    this.useLocalStorage.set(true);
    if (jobId !== null) {
      this.jobId.set(jobId);
      this.loadPersonalInfoDataFromLocalStorage(jobId);
      this.applicationState.set(ApplicationForApplicantDTOApplicationStateEnum.Saved);

      // Fetch job title for display
      firstValueFrom(this.jobApi.getJobDetails(jobId))
        .then(jobDetails => {
          if (jobDetails.title) {
            this.title.set(jobDetails.title);
          }
          this.referenceLettersRequired.set(jobDetails.referenceLettersRequired ?? 0);
          this.recommendationType.set(jobDetails.recommendationType);
        })
        .catch(() => {
          // Silently ignore errors when fetching job title - this is non-critical for the application flow
        });
    } else {
      this.showInitErrorMessage(`${applyflow}.missingJobIdUnauthenticated`);
    }
  }

  async initPageLoadExistingApplication(applicationId: string): Promise<ApplicationForApplicantDTO> {
    const application = await firstValueFrom(this.applicationApi.getApplicationById(applicationId));

    if (application.applicationState !== ApplicationForApplicantDTOApplicationStateEnum.Saved) {
      this.toastService.showErrorKey(`${applyflow}.notEditable`);
      await this.router.navigate(['/application/detail', applicationId]);
      throw new Error('Application is not editable.');
    }

    this.applicationId.set(applicationId);
    return application;
  }

  async initPageCreateApplication(jobId: string): Promise<ApplicationForApplicantDTO> {
    const application = await firstValueFrom(this.applicationApi.createApplication(jobId));

    if (application.applicationState !== ApplicationForApplicantDTOApplicationStateEnum.Saved) {
      this.toastService.showErrorKey(`${applyflow}.notEditable`);
      await this.router.navigate(['/application/detail', application.applicationId]);
      throw new Error('Application is not editable.');
    }

    this.applicationId.set(application.applicationId ?? '');

    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { job: jobId, application: application.applicationId },
      queryParamsHandling: 'merge',
    });

    return application;
  }

  /** Save callback invoked by the {@link AutoSaveController} when its debounce timer fires. */
  async executeAutoSave(): Promise<boolean> {
    if (this.useLocalStorage()) {
      return this.saveToLocalStorage();
    }
    return this.sendCreateApplicationData(this.applicationState(), false);
  }

  onConfirmSend(): void {
    this.submitAttempted.set(true);
    if (!this.privacyAcceptedSignal()) {
      this.toastService.showErrorKey('privacy.privacyConsent.toastError');
      return;
    }
    if (!this.doctoralRequirementsAcceptedSignal()) {
      this.toastService.showErrorKey('entity.applicationPage4.doctoralRequirements.toastError');
      return;
    }
    void this.sendCreateApplicationData(ApplicationForApplicantDTOApplicationStateEnum.Sent, true);
  }

  async sendCreateApplicationData(state: ApplicationForApplicantDTOApplicationStateEnum, rerouteToOtherPage: boolean): Promise<boolean> {
    const applicationId = this.applicationId();

    if (applicationId === '') {
      this.toastService.showErrorKey(`${applyflow}.errorApplicationId`);
      return false;
    }

    // If using local storage, we can't send to server
    if (this.useLocalStorage()) {
      this.toastService.showErrorKey(`${applyflow}.authRequired`);
      return false;
    }

    const updateApplication = this.mapPagesToDTO(state) as UpdateApplicationDTO;

    try {
      await firstValueFrom(this.applicationApi.updateApplication(updateApplication));

      // Clear local storage on successful server save
      this.clearLocalStorage();

      // After application is sent, reload user data to update header with latest names
      if (state === ApplicationForApplicantDTOApplicationStateEnum.Sent) {
        await this.accountService.loadUser();
      }

      if (rerouteToOtherPage) {
        this.toastService.showSuccessKey(`${applyflow}.submitted`);
        await this.router.navigate(['/application/overview']);
      }
    } catch {
      this.toastService.showErrorKey(`${applyflow}.saveFailed`);
      return false;
    }
    return true;
  }

  updateDocumentInformation(): void {
    // Skip document update if using local storage
    if (this.useLocalStorage()) {
      return;
    }

    firstValueFrom(this.applicationApi.getDocumentIds(this.applicationId()))
      .then(ids => {
        this.documentIds.set(ids);
      })
      .catch(() => this.toastService.showErrorKey(`${applyflow}.fetchDocumentIdsFailed`));
  }

  onValueChanged(): void {
    this.autoSave.notifyChanged();
  }

  onPersonalInfoDataValidityChanged(isValid: boolean): void {
    this.personalInfoDataValid.set(isValid);
  }

  onEducationDataValidityChanged(isValid: boolean): void {
    this.educationDataValid.set(isValid);
  }

  // Applies AI-extracted education fields to page 2, only filling currently empty values
  onEducationDataExtracted(extracted: ExtractedCertificateDataDTO | undefined): void {
    this.educationData.update(current => {
      if (current.bachelorDegreeName === '') current.bachelorDegreeName = extracted?.bachelorDegreeName ?? '';
      if (current.bachelorDegreeUniversity === '') current.bachelorDegreeUniversity = extracted?.bachelorUniversity ?? '';
      if (current.bachelorGrade === '') current.bachelorGrade = extracted?.bachelorGrade ?? '';
      if (current.masterDegreeName === '') current.masterDegreeName = extracted?.masterDegreeName ?? '';
      if (current.masterDegreeUniversity === '') current.masterDegreeUniversity = extracted?.masterUniversity ?? '';
      if (current.masterGrade === '') current.masterGrade = extracted?.masterGrade ?? '';
      return current;
    });
  }

  onApplicationDetailsDataValidityChanged(isValid: boolean): void {
    this.applicationDetailsDataValid.set(isValid);
  }

  onReferencesChanged(list: ReferenceRequestDTO[]): void {
    this.references.set(list);
  }

  onReferenceLettersConfidentialChanged(confidential: boolean): void {
    this.referenceLettersConfidential.set(confidential);
  }

  // Authenticates the current visitor (OTP) and ensures a server-side application exists.
  // Resolves once `applicationId` is populated, or earlier (no-op) when validation
  // failed and the user needs to fill in missing fields before retrying.
  async requestAuthAndApplication(): Promise<void> {
    if (this.applicantId()) {
      return;
    }

    const email = this.personalInfoData().email;
    const firstName = this.personalInfoData().firstName;
    const lastName = this.personalInfoData().lastName;

    await this.openOtpAndWaitForLogin(email, firstName, lastName);

    // Validation inside openOtpAndWaitForLogin returns early without authenticating.
    // Bail here too so we don't try to create or migrate an application against
    // an unauthenticated session (which would fire "Session expired" toasts).
    const userId = this.accountService.loadedUser()?.id;
    if (!userId) {
      return;
    }

    this.applicantId.set(userId);
    await this.migrateDraftIfNeeded();
  }

  // Handles the Next action from Step 1: runs OTP flow, refreshes user, migrates draft, advances stepper.
  private handleNextFromStep1(): void {
    if (this.applicantId()) {
      return;
    }

    void (async () => {
      try {
        await this.requestAuthAndApplication();
        if (this.applicantId()) {
          this.progressStepper()?.goToStep(2);
        }
      } catch {
        // Inner methods (openOtpAndWaitForLogin, migrateDraftIfNeeded) already
        // surface a specific toast for the failure cause; just don't advance.
      }
    })();
  }

  // Bound to <jhi-application-creation-page1 [requestAuth]>. Arrow-function so `this` is preserved.
  // eslint-disable-next-line @typescript-eslint/member-ordering
  readonly requestAuthCallback = (): Promise<void> => this.requestAuthAndApplication();

  // Opens the OTP dialog and waits until the user is effectively logged in or a timeout occurs.
  // Returns early (without authenticating) when required fields are missing — the corresponding
  // toast is shown for the user, and the caller should detect the still-empty session.
  private async openOtpAndWaitForLogin(email: string, firstName: string, lastName: string): Promise<void> {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      this.toastService.showErrorKey(`${applyflow}.invalidEmail`);
      return;
    }
    const normalizedFirstName = firstName.trim();
    if (!normalizedFirstName) {
      this.toastService.showErrorKey(`${applyflow}.invalidFirstName`);
      return;
    }
    const normalizedLastName = lastName.trim();
    if (!normalizedLastName) {
      this.toastService.showErrorKey(`${applyflow}.invalidLastName`);
      return;
    }

    this.authOrchestrator.email.set(normalizedEmail);
    this.authOrchestrator.firstName.set(normalizedFirstName);
    this.authOrchestrator.lastName.set(normalizedLastName);
    await this.authFacade.requestOtp(true);
    this.otpDialogRef = this.dialogService.open(OtpInput, {
      header: this.translateService.instant('auth.common.otp.title'),
      data: { registration: true },
      style: { background: 'var(--p-background-default)', maxWidth: '40rem' },
      closable: true,
      draggable: false,
      modal: true,
    });

    // Poll account state until a user is available or timeout
    const started = Date.now();
    await new Promise<void>((resolve, reject) => {
      const iv = setInterval(() => {
        const hasUser = this.accountService.loadedUser()?.id != null;
        if (hasUser) {
          clearInterval(iv);
          this.otpDialogRef?.close();
          resolve();
        } else if (Date.now() - started > ApplicationCreationFormComponent.MAX_OTP_WAIT_TIME_MS) {
          clearInterval(iv);
          this.otpDialogRef?.close();
          reject(new Error('OTP verification timeout. Please try again.'));
        }
      }, 250);
    });
  }

  // Migrates local draft (anonymous) to server-backed application after login and persists current data.
  private async migrateDraftIfNeeded(): Promise<void> {
    if (!this.useLocalStorage()) {
      return;
    }

    const jobId = this.jobId();
    if (!jobId) {
      return;
    }

    try {
      const application = await this.initPageCreateApplication(jobId);
      this.useLocalStorage.set(false);
      this.applicationId.set(application.applicationId ?? this.applicationId());
      this.references.set(application.references ?? []);
      this.autoSave.setState(SavingStates.SAVING);
      const saved = await this.sendCreateApplicationData(this.applicationState(), false);
      this.autoSave.setState(saved ? SavingStates.SAVED : SavingStates.FAILED);
      // TODO: remove application from local storage
    } catch {
      this.toastService.showErrorKey(`${applyflow}.migrationFailed`);
    }
  }

  private mapPagesToDTO(state?: ApplicationDetailDTOApplicationStateEnum): UpdateApplicationDTO | ApplicationDetailDTO {
    const p1 = this.personalInfoData();
    const p2 = this.educationData();
    const p3 = this.applicationDetailsData();

    const base = {
      applicationId: this.applicationId(),
      applicant: {
        user: {
          userId: this.applicantId(),
          email: p1.email,
          gender: p1.gender?.value as string,
          nationality: p1.nationality?.value as string,
          birthday: p1.dateOfBirth,
          website: p1.website,
          linkedinUrl: p1.linkedIn,
        },
        bachelorDegreeName: p2.bachelorDegreeName,
        bachelorUniversity: p2.bachelorDegreeUniversity,
        bachelorGrade: p2.bachelorGrade,
        bachelorGradeUpperLimit: p2.bachelorGradeUpperLimit,
        bachelorGradeLowerLimit: p2.bachelorGradeLowerLimit,
        masterDegreeName: p2.masterDegreeName,
        masterUniversity: p2.masterDegreeUniversity,
        masterGrade: p2.masterGrade,
        masterGradeUpperLimit: p2.masterGradeUpperLimit,
        masterGradeLowerLimit: p2.masterGradeLowerLimit,
      },
      motivation: p3.motivation,
      specialSkills: p3.skills,
      desiredDate: p3.desiredStartDate,
      projects: p3.experiences,
      jobTitle: this.title(),
      references: this.references(),
      referenceLettersConfidential: this.referenceLettersConfidential(),
    };

    if (state !== undefined) {
      return {
        ...base,
        applicationState: state,
        applicant: {
          ...base.applicant,
          city: p1.city,
          country: p1.country?.value,
          postalCode: p1.postcode,
          street: p1.street,
          user: {
            ...base.applicant.user,
            firstName: p1.firstName,
            lastName: p1.lastName,
            phoneNumber: p1.phoneNumber,
          },
        },
      } as UpdateApplicationDTO;
    }

    return {
      ...base,
      applicationState: this.applicationState(),
    } as ApplicationDetailDTO;
  }

  private saveToLocalStorage(): boolean {
    const applicationData: ApplicationDraftData = {
      personalInfoData: this.personalInfoData(),
      applicationId: this.applicationId(),
      jobId: this.jobId(),
      timestamp: new Date().toISOString(),
    };
    try {
      this.localStorageService.saveApplicationDraft(applicationData);
    } catch {
      this.toastService.showErrorKey(`${applyflow}.saveFailed`);
      return false;
    }
    return true;
  }

  /**
   * Loads application form data for the first page from localStorage for the current application.
   * Validates applicationId match before applying data to form page.
   *
   * @returns {boolean} True if data was successfully loaded, false otherwise
   * @private
   */
  private loadPersonalInfoDataFromLocalStorage(jobId: string): void {
    try {
      const draft = this.localStorageService.loadApplicationDraft(undefined, jobId);
      if (draft) {
        this.personalInfoData.set(draft.personalInfoData);
        this.applicationId.set(draft.applicationId);
        this.jobId.set(draft.jobId);
      }
    } catch {
      queueMicrotask(() => {
        this.toastService.showErrorKey(`${applyflow}.loadFailed`);
        // Error is handled via toast notification, no need to re-throw
        // This prevents unhandled error exceptions in tests and maintains graceful error handling
      });
    }
  }

  private clearLocalStorage(): void {
    this.localStorageService.clearApplicationDraft(this.applicationId(), this.jobId());
  }

  /*
   * `queueMicroTask` is here to fix a timing issue with the ToastService.
   * on opening the webpage directly to this component, the Toastservice is not ready to be rendered in the DOM, so it's functions are being executed, but no toast is visible
   * tried different strategies of fixing the timing issue:
   *  - `afterNextRender`
   *  - different LifecylceStrategies (constructor, constructor with effect, ngOnInit)
   *
   * What also works is `setTimeout(() => {})`
   * This might be a problem of the Toastservice instead of this component. A waiting queue
   * and a flag that waits for initialisation before executing the primeng messageservice did not fix the issue,
   * because while the component was initialised (createGlobalToast had been executed and toastComponent was not empty)
   * it was likely not ready being rendered in the DOM
   */
  private showInitErrorMessage(key: string): void {
    queueMicrotask(() => {
      this.toastService.showErrorKey(key);
      setTimeout(() => void this.router.navigate(['/job-overview']), 3000);
    });
  }
}
