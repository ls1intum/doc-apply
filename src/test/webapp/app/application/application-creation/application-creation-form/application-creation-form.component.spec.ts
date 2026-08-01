import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';
import { createTranslateServiceMock, provideTranslateMock, TranslateServiceMock } from 'util/translate.mock';
import ApplicationCreationFormComponent from '../../../../../../main/webapp/app/application/application-creation/application-creation-form/application-creation-form.component';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { of, throwError } from 'rxjs';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { SavingStates } from 'app/shared/constants/saving-states';
import { ApplicationForApplicantDTOApplicationStateEnum } from 'app/generated/model/application-for-applicant-dto';
import { HttpResponse } from '@angular/common/http';
import { ApplicationDetailDTOApplicationStateEnum } from 'app/generated/model/application-detail-dto';
import { UpdateApplicationDTO } from 'app/generated/model/update-application-dto';
import { ApplicationCreationPage1Data } from 'app/application/application-creation/application-creation-page1/application-creation-page1.component';
import { ProgressStepperComponent } from 'app/shared/components/molecules/progress-stepper/progress-stepper.component';
import { AccountServiceMock, createAccountServiceMock, provideAccountServiceMock } from 'util/account.service.mock';
import { createRouterMock, provideRouterMock, RouterMock } from 'util/router.mock';
import { createToastServiceMock, provideToastServiceMock, ToastServiceMock } from 'util/toast-service.mock';
import { createLocationMock, provideLocationMock, LocationMock } from 'util/location.mock';
import { createAuthFacadeServiceMock, provideAuthFacadeServiceMock, AuthFacadeServiceMock } from 'util/auth-facade.service.mock';
import { createDialogServiceMock, provideDialogServiceMock, DialogServiceMock } from 'util/dialog.service.mock';
import {
  createAuthOrchestratorServiceMock,
  provideAuthOrchestratorServiceMock,
  AuthOrchestratorServiceMock,
} from 'util/auth-orchestrator.service.mock';
import { createLocalStorageServiceMock, provideLocalStorageServiceMock, LocalStorageServiceMock } from 'util/local-storage.service.mock';
import {
  createApplicationResourceApiMock,
  provideApplicationResourceApiMock,
  ApplicationResourceApiMock,
  createMockApplicationDTO,
} from 'util/application-resource-api.service.mock';
import { createJobResourceApiMock, provideJobResourceApiMock, JobResourceApiMock } from 'util/job-resource-api.service.mock';
import { createUserResourceApiMock, provideUserResourceApiMock, UserResourceApiMock } from 'util/user-resource-api.service.mock';
import { ActivatedRouteMock, createActivatedRouteMock, provideActivatedRouteMock } from 'util/activated-route.mock';

function spyOnPrivate<T extends object>(obj: T, methodName: string) {
  return vi.spyOn(obj as unknown as Record<string, (...args: unknown[]) => unknown>, methodName);
}

function mockReturnValuePrivate<R>(
  spy: { mockReturnValue: (value: unknown) => MockInstance<(...args: never[]) => unknown> },
  mockValue: R,
) {
  return spy.mockReturnValue(mockValue);
}

type MockDialogRef = Pick<DynamicDialogRef, 'close'>;

function createMockDialogRef(): MockDialogRef {
  return { close: vi.fn() };
}

function createProgressStepperMock(): ProgressStepperComponent {
  return { goToStep: vi.fn() } as unknown as ProgressStepperComponent;
}

interface TestBedConfig {
  accountService: AccountServiceMock;
  applicationApi: ApplicationResourceApiMock;
  router: RouterMock;
  location: LocationMock;
  toast: ToastServiceMock;
  authFacade: AuthFacadeServiceMock;
  activatedRoute: ActivatedRouteMock;
  dialogService: DialogServiceMock;
  authOrchestrator: AuthOrchestratorServiceMock;
  localStorageService: LocalStorageServiceMock;
  translateService: TranslateServiceMock;
  jobApi: JobResourceApiMock;
  userApi: UserResourceApiMock;
}

async function configureTestBed(config: TestBedConfig) {
  return await TestBed.configureTestingModule({
    imports: [ApplicationCreationFormComponent],
    providers: [
      provideAccountServiceMock(config.accountService),
      provideApplicationResourceApiMock(config.applicationApi),
      provideRouterMock(config.router),
      provideLocationMock(config.location),
      provideToastServiceMock(config.toast),
      provideAuthFacadeServiceMock(config.authFacade),
      provideActivatedRouteMock(config.activatedRoute),
      provideDialogServiceMock(config.dialogService),
      provideAuthOrchestratorServiceMock(config.authOrchestrator),
      provideLocalStorageServiceMock(config.localStorageService),
      provideJobResourceApiMock(config.jobApi),
      provideUserResourceApiMock(config.userApi),
      provideTranslateMock(config.translateService),
      provideFontAwesomeTesting(),
    ],
  }).compileComponents();
}

function createValidPersonalInfoData(overrides?: Partial<ApplicationCreationPage1Data>): ApplicationCreationPage1Data {
  return Object.assign(
    {
      firstName: 'John',
      lastName: 'Doe',
      email: 'test@example.com',
      phoneNumber: '+1234567890',
      gender: undefined,
      nationality: undefined,
      dateOfBirth: '',
      website: '',
      linkedIn: '',
      street: '',
      city: '',
      country: undefined,
      postcode: '',
    },
    overrides ?? {},
  );
}

describe('ApplicationForm', () => {
  let accountService: AccountServiceMock;
  let applicationApi: ApplicationResourceApiMock;
  let toast: ToastServiceMock;
  let router: RouterMock;
  let location: LocationMock;
  let authFacade: AuthFacadeServiceMock;
  let dialogService: DialogServiceMock;
  let authOrchestrator: AuthOrchestratorServiceMock;
  let localStorageService: LocalStorageServiceMock;
  let translateService: TranslateServiceMock;
  let activatedRoute: ActivatedRouteMock;
  let jobApi: JobResourceApiMock;
  let userApi: UserResourceApiMock;

  let fixture: ComponentFixture<ApplicationCreationFormComponent>;
  let comp: ApplicationCreationFormComponent;

  beforeEach(async () => {
    accountService = createAccountServiceMock();
    applicationApi = createApplicationResourceApiMock();
    toast = createToastServiceMock();
    router = createRouterMock();
    location = createLocationMock();
    authFacade = createAuthFacadeServiceMock();
    dialogService = createDialogServiceMock();
    dialogService.open = vi.fn().mockReturnValue(of({ close: vi.fn() }));

    authOrchestrator = createAuthOrchestratorServiceMock();
    authOrchestrator.email.set('email@email.com');
    authOrchestrator.firstName.set('firstname');
    authOrchestrator.lastName.set('lastname');

    localStorageService = createLocalStorageServiceMock();
    translateService = createTranslateServiceMock();

    jobApi = createJobResourceApiMock();
    jobApi.getJobDetails = vi.fn().mockReturnValue({ title: 'Test Job' });

    userApi = createUserResourceApiMock();
    userApi.getAiConsent = vi.fn().mockReturnValue(of(true));

    activatedRoute = createActivatedRouteMock({}, { job: '123', application: '456' });

    await configureTestBed({
      accountService,
      applicationApi,
      router,
      location,
      toast,
      authFacade,
      activatedRoute,
      dialogService,
      authOrchestrator,
      localStorageService,
      translateService,
      jobApi,
      userApi,
    });
    fixture = TestBed.createComponent(ApplicationCreationFormComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should initialize jobId and applicationId from route', async () => {
    await fixture.whenStable();
    expect(comp.jobId()).toBe('123');
    expect(comp.applicationId()).toBe('456');
  });

  it('should throw error when neither jobId nor applicationId is provided', async () => {
    TestBed.resetTestingModule();
    await configureTestBed({
      accountService,
      applicationApi,
      router,
      location,
      toast,
      authFacade,
      activatedRoute: createActivatedRouteMock({}, {}),
      dialogService,
      authOrchestrator,
      localStorageService,
      translateService,
      jobApi,
      userApi,
    });

    const freshFixture = TestBed.createComponent(ApplicationCreationFormComponent);
    const freshComp = freshFixture.componentInstance;

    accountService.loaded.set(true);
    accountService.user.set({ id: 'user-123', email: 'test@example.com', name: 'Test User' });

    await expect(freshComp.init()).rejects.toThrow(
      'Init failed with HTTP undefined: Either job ID or application ID must be provided in the URL.',
    );
    expect(toast.showErrorKey).toHaveBeenCalledWith('entity.toast.applyFlow.loadFailed');
  });

  it('should show error if privacy is not accepted on send', () => {
    comp.additionalInfoForm.controls.privacyAccepted.setValue(false);
    comp.onConfirmSend();
    expect(toast.showErrorKey).toHaveBeenCalledWith('privacy.privacyConsent.toastError');
  });

  it('should show error if doctoral requirements are not accepted on send', () => {
    comp.additionalInfoForm.controls.privacyAccepted.setValue(true);
    comp.additionalInfoForm.controls.doctoralRequirementsAccepted.setValue(false);
    fixture.detectChanges();
    const sendSpy = vi.spyOn(comp, 'sendCreateApplicationData');

    comp.onConfirmSend();

    expect(toast.showErrorKey).toHaveBeenCalledWith('entity.applicationPage4.doctoralRequirements.toastError');
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('should send application if privacy accepted', async () => {
    comp.applicationId.set('456');
    comp.useLocalStorage.set(false);
    comp.additionalInfoForm.controls.privacyAccepted.setValue(true);
    comp.additionalInfoForm.controls.doctoralRequirementsAccepted.setValue(true);
    fixture.detectChanges();
    const sendSpy = vi.spyOn(comp, 'sendCreateApplicationData').mockResolvedValue(true);

    comp.onConfirmSend();

    await new Promise(resolve => setTimeout(resolve, 10));
    await fixture.whenStable();

    expect(sendSpy).toHaveBeenCalledWith(ApplicationForApplicantDTOApplicationStateEnum.Sent, true);
  });

  describe('initPageForLocalStorage', () => {
    it('should load from local storage when unauthenticated', async () => {
      accountService.user.set(undefined);
      vi.mocked(localStorageService.loadApplicationDraft).mockReturnValue({
        applicationId: 'local-id',
        jobId: 'local-job',
        personalInfoData: createValidPersonalInfoData({
          email: 'local@example.com',
          firstName: 'Local',
          lastName: 'User',
        }),
        timestamp: new Date().toISOString(),
      });

      fixture = TestBed.createComponent(ApplicationCreationFormComponent);
      comp = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      expect(comp.useLocalStorage()).toBe(true);
      expect(comp.applicationId()).toBe('local-id');
      expect(comp.personalInfoData().email).toBe('local@example.com');
    });

    it('should show error message when jobId is null in initPageForLocalStorageCase', async () => {
      const showErrorSpy = spyOnPrivate(comp, 'showInitErrorMessage');
      comp.initPageForLocalStorageCase(null);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(showErrorSpy).toHaveBeenCalledWith('entity.toast.applyFlow.missingJobIdUnauthenticated');
      expect(comp.jobId()).not.toBe(null);
    });

    it('should set title from fetched jobDetails', async () => {
      const loadDataSpy = spyOnPrivate(comp, 'loadPersonalInfoDataFromLocalStorage');
      jobApi.getJobDetails = vi.fn().mockReturnValue(of({ title: 'Senior Software Engineer' }));

      comp.initPageForLocalStorageCase('job-456');

      fixture.detectChanges();
      await new Promise(resolve => setTimeout(resolve, 50));
      await fixture.whenStable();

      expect(loadDataSpy).toHaveBeenCalledWith('job-456');
      expect(comp.title()).toBe('Senior Software Engineer');
      expect(jobApi.getJobDetails).toHaveBeenCalledWith('job-456');
    });

    it('should silently swallow error when jobDetails fetch fails', async () => {
      jobApi.getJobDetails = vi.fn().mockReturnValue(throwError(() => new Error('Job fetch failed')));
      comp.initPageForLocalStorageCase('job-error');

      fixture.detectChanges();
      await new Promise(resolve => setTimeout(resolve, 50));
      await fixture.whenStable();

      expect(jobApi.getJobDetails).toHaveBeenCalledWith('job-error');
      expect(toast.showErrorKey).not.toHaveBeenCalled();
    });
  });

  it('should flip badge to SAVING and forward change through auto-save controller', () => {
    const notifySpy = vi.spyOn(comp.autoSave, 'notifyChanged');
    comp.onValueChanged();
    expect(notifySpy).toHaveBeenCalledOnce();
    expect(comp.autoSave.state()).toBe(SavingStates.SAVING);
  });

  describe('saveToLocalStorage', () => {
    it('should save draft and return true', () => {
      comp.personalInfoData.set(createValidPersonalInfoData());
      comp.applicationId.set('app-123');
      comp.jobId.set('job-456');

      const result = comp['saveToLocalStorage']();

      expect(localStorageService.saveApplicationDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          personalInfoData: expect.any(Object),
          applicationId: 'app-123',
          jobId: 'job-456',
          timestamp: expect.any(String),
        }),
      );
      expect(toast.showErrorKey).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should show error toast and return false when save throws', () => {
      comp.personalInfoData.set(createValidPersonalInfoData());
      comp.applicationId.set('app-789');
      comp.jobId.set('job-999');

      localStorageService.saveApplicationDraft = vi.fn().mockImplementation(() => {
        throw new Error('LocalStorage quota exceeded');
      });

      const result = comp['saveToLocalStorage']();

      expect(toast.showErrorKey).toHaveBeenCalledWith('entity.toast.applyFlow.saveFailed');
      expect(result).toBe(false);
    });
  });

  describe('sendCreateApplicationData', () => {
    it('should show error and return false when applicationId is empty', async () => {
      comp.applicationId.set('');
      const result = await comp.sendCreateApplicationData('SAVED', false);
      expect(toast.showErrorKey).toHaveBeenCalledWith('entity.toast.applyFlow.errorApplicationId');
      expect(applicationApi.updateApplication).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should show error and return false when useLocalStorage is true', async () => {
      comp.applicationId.set('app-123');
      comp.useLocalStorage.set(true);
      const result = await comp.sendCreateApplicationData('SAVED', false);
      expect(toast.showErrorKey).toHaveBeenCalledWith('entity.toast.applyFlow.authRequired');
      expect(result).toBe(false);
    });

    it('should update, clear localStorage, toast and navigate when rerouteToOtherPage is true', async () => {
      comp.applicationId.set('app-456');
      comp.useLocalStorage.set(false);

      const mockUpdateDTO = { applicationId: 'app-456', applicationState: ApplicationForApplicantDTOApplicationStateEnum.Sent };
      spyOnPrivate(comp, 'mapPagesToDTO').mockReturnValue(mockUpdateDTO);
      const clearLocalStorageSpy = spyOnPrivate(comp, 'clearLocalStorage').mockImplementation(() => {});

      applicationApi.updateApplication = vi.fn().mockReturnValue(of(new HttpResponse({ body: {}, status: 200 })));

      const result = await comp.sendCreateApplicationData(ApplicationForApplicantDTOApplicationStateEnum.Sent, true);

      expect(applicationApi.updateApplication).toHaveBeenCalledWith(mockUpdateDTO);
      expect(clearLocalStorageSpy).toHaveBeenCalledOnce();
      expect(toast.showSuccessKey).toHaveBeenCalledWith('entity.toast.applyFlow.submitted');
      expect(router.navigate).toHaveBeenCalledWith(['/application/overview']);
      expect(result).toBe(true);
    });

    it('should not toast/navigate when rerouteToOtherPage is false', async () => {
      comp.applicationId.set('app-789');
      comp.useLocalStorage.set(false);

      spyOnPrivate(comp, 'mapPagesToDTO').mockReturnValue({ applicationId: 'app-789', applicationState: 'SAVED' });
      spyOnPrivate(comp, 'clearLocalStorage').mockImplementation(() => {});
      applicationApi.updateApplication = vi.fn().mockReturnValue(of(new HttpResponse({ body: {}, status: 200 })));

      const result = await comp.sendCreateApplicationData('SAVED', false);

      expect(toast.showSuccessKey).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should show error toast and return false when update fails', async () => {
      comp.applicationId.set('app-error');
      comp.useLocalStorage.set(false);

      spyOnPrivate(comp, 'mapPagesToDTO').mockReturnValue({ applicationId: 'app-error', applicationState: 'SAVED' });
      const clearLocalStorageSpy = spyOnPrivate(comp, 'clearLocalStorage').mockImplementation(() => {});
      applicationApi.updateApplication = vi.fn().mockReturnValue(throwError(() => new Error('Network error')));

      const result = await comp.sendCreateApplicationData('SAVED', false);

      expect(clearLocalStorageSpy).not.toHaveBeenCalled();
      expect(toast.showErrorKey).toHaveBeenCalledWith('entity.toast.applyFlow.saveFailed');
      expect(result).toBe(false);
    });

    it('should call accountService.loadUser only when state is SENT', async () => {
      comp.applicationId.set('app-123');
      comp.useLocalStorage.set(false);
      spyOnPrivate(comp, 'mapPagesToDTO').mockReturnValue({ applicationState: ApplicationForApplicantDTOApplicationStateEnum.Sent });
      spyOnPrivate(comp, 'clearLocalStorage').mockImplementation(() => {});
      applicationApi.updateApplication = vi.fn().mockReturnValue(of(new HttpResponse({ body: {}, status: 200 })));
      accountService.loadUser = vi.fn().mockResolvedValue(undefined);

      await comp.sendCreateApplicationData(ApplicationForApplicantDTOApplicationStateEnum.Sent, false);
      expect(accountService.loadUser).toHaveBeenCalledOnce();

      vi.mocked(accountService.loadUser).mockClear();
      spyOnPrivate(comp, 'mapPagesToDTO').mockReturnValue({ applicationState: 'SAVED' });
      await comp.sendCreateApplicationData('SAVED', false);
      expect(accountService.loadUser).not.toHaveBeenCalled();
    });
  });

  describe('mapPagesToDTO', () => {
    beforeEach(() => {
      comp.personalInfoData.set({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneNumber: '+1234567890',
        gender: { value: 'male', name: 'Male' },
        nationality: { value: 'US', name: 'United States' },
        dateOfBirth: '1990-01-01',
        website: 'https://example.com',
        linkedIn: 'https://linkedin.com/in/johndoe',
        street: '123 Main St',
        city: 'New York',
        country: { value: 'US', name: 'United States' },
        postcode: '10001',
      });
      comp.educationData.set({
        bachelorDegreeName: 'Computer Science',
        bachelorDegreeUniversity: 'MIT',
        bachelorGrade: '3.8',
        bachelorGradeLowerLimit: '4',
        bachelorGradeUpperLimit: '1',
        masterDegreeName: 'Software Engineering',
        masterDegreeUniversity: 'Stanford',
        masterGrade: '3.9',
        masterGradeLowerLimit: '4',
        masterGradeUpperLimit: '1',
      });
      comp.applicationDetailsData.set({
        motivation: '<p>I am passionate about software</p>',
        skills: '<p>Java, TypeScript, Angular</p>',
        desiredStartDate: '2025-06-01',
        experiences: '<p>Built multiple apps</p>',
      });
      comp.applicationId.set('app-123');
      comp.applicantId.set('user-456');
    });

    it('should return UpdateApplicationDTO with all fields when state is provided', () => {
      const result = comp['mapPagesToDTO'](ApplicationForApplicantDTOApplicationStateEnum.Sent) as UpdateApplicationDTO;

      expect(result.applicationId).toBe('app-123');
      expect(result.applicationState).toBe(ApplicationForApplicantDTOApplicationStateEnum.Sent);
      expect(result.applicant?.user.userId).toBe('user-456');
      expect(result.applicant?.user.email).toBe('john@example.com');
      expect(result.applicant?.city).toBe('New York');
      expect(result.applicant?.country).toBe('US');
      expect(result.applicant?.postalCode).toBe('10001');
      expect(result.motivation).toBe('<p>I am passionate about software</p>');
      expect(result.specialSkills).toBe('<p>Java, TypeScript, Angular</p>');
      expect(result.desiredDate).toBe('2025-06-01');
      expect(result.projects).toBe('<p>Built multiple apps</p>');
      expect(result.referenceLettersConfidential).toBe(true);
    });

    it('should return DTO without address fields when state is undefined', () => {
      comp.applicationState.set('SAVED');
      const result = comp['mapPagesToDTO'](undefined);
      expect(result.applicationState).toBe('SAVED');
      expect(result.applicant?.city).toBeUndefined();
    });
  });

  describe('openOtpAndWaitForLogin', () => {
    it.each([
      ['', 'John', 'Doe', 'entity.toast.applyFlow.invalidEmail'],
      ['   ', 'John', 'Doe', 'entity.toast.applyFlow.invalidEmail'],
      ['test@example.com', '', 'Doe', 'entity.toast.applyFlow.invalidFirstName'],
      ['test@example.com', '   ', 'Doe', 'entity.toast.applyFlow.invalidFirstName'],
      ['test@example.com', 'John', '', 'entity.toast.applyFlow.invalidLastName'],
      ['test@example.com', 'John', '   ', 'entity.toast.applyFlow.invalidLastName'],
    ])('should show error %s/%s/%s and not request OTP', async (email, first, last, key) => {
      await comp['openOtpAndWaitForLogin'](email, first, last);
      expect(toast.showErrorKey).toHaveBeenCalledWith(key);
      expect(authFacade.requestOtp).not.toHaveBeenCalled();
    });

    it('should trim inputs and request OTP', async () => {
      authFacade.requestOtp = vi.fn().mockResolvedValue(undefined);
      mockReturnValuePrivate(vi.spyOn(dialogService, 'open'), { close: vi.fn() });
      vi.useFakeTimers();

      comp['openOtpAndWaitForLogin']('  test@example.com  ', '  John  ', '  Doe  ');
      vi.advanceTimersByTime(100);
      await Promise.resolve();

      expect(authOrchestrator.email()).toBe('test@example.com');
      expect(authOrchestrator.firstName()).toBe('John');
      expect(authOrchestrator.lastName()).toBe('Doe');
      expect(authFacade.requestOtp).toHaveBeenCalledWith(true);

      vi.useRealTimers();
    });

    it('should reject with timeout when login does not occur', async () => {
      accountService.loaded.set(false);
      accountService.user.set(undefined);
      authFacade.requestOtp = vi.fn().mockResolvedValue(undefined);
      mockReturnValuePrivate(vi.spyOn(dialogService, 'open'), createMockDialogRef());
      vi.useFakeTimers();

      const promise = comp['openOtpAndWaitForLogin']('test@example.com', 'John', 'Doe');
      vi.advanceTimersByTime(100);
      await Promise.resolve();
      vi.advanceTimersByTime(601_000);
      await Promise.resolve();

      await expect(promise).rejects.toThrow('OTP verification timeout. Please try again.');
      vi.useRealTimers();
    });

    it('should resolve when user logs in before timeout', async () => {
      accountService.loaded.set(true);
      accountService.user.set(undefined);
      authFacade.requestOtp = vi.fn().mockResolvedValue(undefined);
      mockReturnValuePrivate(vi.spyOn(dialogService, 'open'), createMockDialogRef());
      vi.useFakeTimers();

      const promise = comp['openOtpAndWaitForLogin']('test@example.com', 'John', 'Doe');
      vi.advanceTimersByTime(100);
      await Promise.resolve();

      accountService.user.set({ id: 'new-user-123', email: 'test@example.com', name: 'John Doe' });
      vi.advanceTimersByTime(601_000);
      await Promise.resolve();

      await expect(promise).resolves.toBeUndefined();
      vi.useRealTimers();
    });
  });

  describe('migrateDraftIfNeeded', () => {
    it('should return early when useLocalStorage is false or jobId empty', async () => {
      const initPageSpy = spyOnPrivate(comp, 'initPageCreateApplication');

      comp.useLocalStorage.set(false);
      await comp['migrateDraftIfNeeded']();
      expect(initPageSpy).not.toHaveBeenCalled();

      comp.useLocalStorage.set(true);
      comp.jobId.set('');
      await comp['migrateDraftIfNeeded']();
      expect(initPageSpy).not.toHaveBeenCalled();
    });

    it('should migrate draft successfully', async () => {
      comp.useLocalStorage.set(true);
      comp.jobId.set('job-789');
      comp.applicationState.set('SAVED');

      const initPageSpy = spyOnPrivate(comp, 'initPageCreateApplication').mockResolvedValue(
        createMockApplicationDTO(ApplicationForApplicantDTOApplicationStateEnum.Saved),
      );
      const sendDataSpy = spyOnPrivate(comp, 'sendCreateApplicationData').mockResolvedValue(true);

      await comp['migrateDraftIfNeeded']();

      expect(initPageSpy).toHaveBeenCalledWith('job-789');
      expect(comp.useLocalStorage()).toBe(false);
      expect(comp.applicationId()).toBe('456');
      expect(comp.autoSave.state()).toBe(SavingStates.SAVED);
      expect(sendDataSpy).toHaveBeenCalledWith('SAVED', false);
    });

    it('should toast error when migration fails', async () => {
      comp.useLocalStorage.set(true);
      comp.jobId.set('job-error');
      spyOnPrivate(comp, 'initPageCreateApplication').mockRejectedValue(new Error('Migration failed'));

      await comp['migrateDraftIfNeeded']();
      expect(toast.showErrorKey).toHaveBeenCalledWith('entity.toast.applyFlow.migrationFailed');
    });
  });

  describe('handleNextFromStep1', () => {
    it('should return early when applicantId already set', () => {
      comp.applicantId.set('existing-user-123');
      const openOtpSpy = spyOnPrivate(comp, 'openOtpAndWaitForLogin');
      comp['handleNextFromStep1']();
      expect(openOtpSpy).not.toHaveBeenCalled();
    });

    it('should bail without migrating or stepping when auth fails', async () => {
      comp.applicantId.set('');
      comp.personalInfoData.set(createValidPersonalInfoData({ email: 'test@example.com', firstName: 'Jane', lastName: 'Smith' }));

      const openOtpSpy = spyOnPrivate(comp, 'openOtpAndWaitForLogin').mockResolvedValue(undefined);
      const migrateDraftSpy = spyOnPrivate(comp, 'migrateDraftIfNeeded').mockResolvedValue(undefined);
      accountService.user.set(undefined);

      const progressStepperMock = createProgressStepperMock();
      vi.spyOn(comp, 'progressStepper').mockReturnValue(progressStepperMock);

      comp['handleNextFromStep1']();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(openOtpSpy).toHaveBeenCalledWith('test@example.com', 'Jane', 'Smith');
      expect(comp.applicantId()).toBe('');
      expect(migrateDraftSpy).not.toHaveBeenCalled();
      expect(vi.mocked(progressStepperMock.goToStep)).not.toHaveBeenCalled();
    });

    it('should set applicantId, migrate draft, and step forward on successful auth', async () => {
      comp.applicantId.set('');
      comp.personalInfoData.set(createValidPersonalInfoData({ email: 'test@example.com', firstName: 'Jane', lastName: 'Smith' }));

      const openOtpSpy = spyOnPrivate(comp, 'openOtpAndWaitForLogin').mockResolvedValue(undefined);
      const migrateDraftSpy = spyOnPrivate(comp, 'migrateDraftIfNeeded').mockResolvedValue(undefined);
      accountService.user.set({ id: 'valid-user-789', email: 'test@example.com', name: 'Jane Smith' });

      const progressStepperMock = createProgressStepperMock();
      vi.spyOn(comp, 'progressStepper').mockReturnValue(progressStepperMock);

      comp['handleNextFromStep1']();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(openOtpSpy).toHaveBeenCalledWith('test@example.com', 'Jane', 'Smith');
      expect(comp.applicantId()).toBe('valid-user-789');
      expect(migrateDraftSpy).toHaveBeenCalledOnce();
      expect(vi.mocked(progressStepperMock.goToStep)).toHaveBeenCalledWith(2);
    });
  });

  describe('step button handlers', () => {
    beforeEach(() => {
      comp.personalInfoDataValid.set(true);
      comp.educationDataValid.set(true);
      comp.applicationDetailsDataValid.set(true);
      comp.applicantId.set('user-123');
      fixture.detectChanges();
    });

    it('should flush auto-save and call location.back on personalInfo back button', async () => {
      const flushSpy = vi.spyOn(comp.autoSave, 'flush').mockResolvedValue(undefined);
      const steps = comp.stepData();
      steps[0].buttonGroupPrev[0].onClick();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(flushSpy).toHaveBeenCalledOnce();
      expect(location.back).toHaveBeenCalledOnce();
    });

    it('should call handleNextFromStep1 on personalInfo next button', () => {
      const handleNextSpy = spyOnPrivate(comp, 'handleNextFromStep1').mockImplementation(() => {});
      comp.stepData()[0].buttonGroupNext[0].onClick();
      expect(handleNextSpy).toHaveBeenCalledOnce();
    });

    it('should set showSendDialog true on summary send button', () => {
      comp.stepData()[3].buttonGroupNext[0].onClick();
      expect(comp.showSendDialog()).toBe(true);
    });
  });

  describe('allPagesValid computed property', () => {
    it.each([
      [false, true, true, false],
      [true, false, true, false],
      [true, true, false, false],
      [true, true, true, true],
    ])('personalInfo=%s education=%s details=%s -> %s', (personal, education, details, expected) => {
      comp.personalInfoDataValid.set(personal);
      comp.educationDataValid.set(education);
      comp.applicationDetailsDataValid.set(details);
      expect(comp.allPagesValid()).toBe(expected);
    });
  });

  describe('executeAutoSave', () => {
    it('should save to localStorage when useLocalStorage is true', async () => {
      comp.useLocalStorage.set(true);
      const saveToLocalStorageSpy = spyOnPrivate(comp, 'saveToLocalStorage').mockReturnValue(true);
      const saved = await comp.executeAutoSave();
      expect(saveToLocalStorageSpy).toHaveBeenCalledOnce();
      expect(saved).toBe(true);
    });

    it('should save to server when useLocalStorage is false', async () => {
      comp.useLocalStorage.set(false);
      comp.applicationState.set('SAVED');
      const sendDataSpy = vi.spyOn(comp, 'sendCreateApplicationData').mockResolvedValue(true);
      const saved = await comp.executeAutoSave();
      expect(sendDataSpy).toHaveBeenCalledWith('SAVED', false);
      expect(saved).toBe(true);
    });
  });

  describe('initPageCreateApplication', () => {
    it('should create application, set applicationId, and navigate with query params when SAVED', async () => {
      const result = await comp.initPageCreateApplication('123');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(applicationApi.createApplication).toHaveBeenCalledWith('123');
      expect(comp.applicationId()).toBe('456');

      const injectedRoute = TestBed.inject(ActivatedRoute);
      expect(router.navigate).toHaveBeenCalledWith([], {
        relativeTo: injectedRoute,
        queryParams: { job: '123', application: '456' },
        queryParamsHandling: 'merge',
      });
      expect(result).toEqual(createMockApplicationDTO(ApplicationForApplicantDTOApplicationStateEnum.Saved));
    });

    it('should toast error, navigate to detail and throw when state is not SAVED', async () => {
      applicationApi.createApplication = vi
        .fn()
        .mockReturnValue(of(createMockApplicationDTO(ApplicationDetailDTOApplicationStateEnum.Sent)));

      await expect(comp.initPageCreateApplication('job-456')).rejects.toThrow('Application is not editable.');
      expect(toast.showErrorKey).toHaveBeenCalledWith('entity.toast.applyFlow.notEditable');
      expect(router.navigate).toHaveBeenCalledWith(['/application/detail', '456']);
    });
  });

  describe('initPageLoadExistingApplication', () => {
    it('should load application when state is SAVED', async () => {
      applicationApi.getApplicationById = vi
        .fn()
        .mockReturnValue(of(createMockApplicationDTO(ApplicationForApplicantDTOApplicationStateEnum.Saved)));

      const result = await comp.initPageLoadExistingApplication('existing-app-123');

      expect(applicationApi.getApplicationById).toHaveBeenCalledWith('existing-app-123');
      expect(comp.applicationId()).toBe('existing-app-123');
      expect(router.navigate).not.toHaveBeenCalled();
      expect(result).toEqual(createMockApplicationDTO(ApplicationForApplicantDTOApplicationStateEnum.Saved));
    });

    it('should toast error and navigate to detail when state is not SAVED', async () => {
      applicationApi.getApplicationById = vi
        .fn()
        .mockReturnValue(of(createMockApplicationDTO(ApplicationDetailDTOApplicationStateEnum.Sent)));

      await expect(comp.initPageLoadExistingApplication('existing-app-456')).rejects.toThrow('Application is not editable.');
      expect(toast.showErrorKey).toHaveBeenCalledWith('entity.toast.applyFlow.notEditable');
      expect(router.navigate).toHaveBeenCalledWith(['/application/detail', 'existing-app-456']);
    });
  });

  describe('updateDocumentInformation', () => {
    it('should not call API when useLocalStorage is true', () => {
      comp.useLocalStorage.set(true);
      comp.applicationId.set('app-123');
      const getDocumentIdsSpy = vi.spyOn(applicationApi, 'getDocumentIds');
      getDocumentIdsSpy.mockClear();

      comp.updateDocumentInformation();

      expect(getDocumentIdsSpy).not.toHaveBeenCalled();
      expect(comp.documentIds()).toStrictEqual({});
    });

    it('should fetch document ids when useLocalStorage is false', async () => {
      comp.useLocalStorage.set(false);
      comp.applicationId.set('app-456');
      const mockDocumentIds = { documentId1: 'doc-1', documentId2: 'doc-2' };
      applicationApi.getDocumentIds = vi.fn().mockReturnValue(of(mockDocumentIds));

      comp.updateDocumentInformation();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(applicationApi.getDocumentIds).toHaveBeenCalledWith('app-456');
      expect(comp.documentIds()).toEqual(mockDocumentIds);
    });

    it('should toast error when getDocumentIds fails', async () => {
      comp.useLocalStorage.set(false);
      comp.applicationId.set('app-error');
      applicationApi.getDocumentIds = vi.fn().mockReturnValue(throwError(() => new Error('Network error')));

      comp.updateDocumentInformation();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(toast.showErrorKey).toHaveBeenCalledWith('entity.toast.applyFlow.fetchDocumentIdsFailed');
    });
  });

  describe('clearLocalStorage', () => {
    it('should call clearApplicationDraft with current applicationId/jobId', () => {
      comp.applicationId.set('app-123');
      comp.jobId.set('job-456');
      comp['clearLocalStorage']();
      expect(localStorageService.clearApplicationDraft).toHaveBeenCalledWith('app-123', 'job-456');
    });
  });

  describe('loadPersonalInfoDataFromLocalStorage', () => {
    it('should load and set personal info data when draft exists', () => {
      const mockDraft = {
        applicationId: 'app-draft-123',
        jobId: 'job-draft-456',
        personalInfoData: createValidPersonalInfoData({ firstName: 'John', email: 'john@example.com' }),
        timestamp: new Date().toISOString(),
      };
      localStorageService.loadApplicationDraft = vi.fn().mockReturnValue(mockDraft);

      comp['loadPersonalInfoDataFromLocalStorage']('job-draft-456');

      expect(localStorageService.loadApplicationDraft).toHaveBeenCalledWith(undefined, 'job-draft-456');
      expect(comp.personalInfoData()).toEqual(mockDraft.personalInfoData);
      expect(comp.applicationId()).toBe('app-draft-123');
      expect(comp.jobId()).toBe('job-draft-456');
    });

    it('should not modify signals when draft is null', () => {
      const initialPersonalInfoData = comp.personalInfoData();
      localStorageService.loadApplicationDraft = vi.fn().mockReturnValue(null);
      comp['loadPersonalInfoDataFromLocalStorage']('job-456');
      expect(comp.personalInfoData()).toEqual(initialPersonalInfoData);
    });

    it('should toast error when loadApplicationDraft throws', async () => {
      localStorageService.loadApplicationDraft = vi.fn().mockImplementation(() => {
        throw new Error('LocalStorage access denied');
      });

      comp['loadPersonalInfoDataFromLocalStorage']('job-456');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(toast.showErrorKey).toHaveBeenCalledWith('entity.toast.applyFlow.loadFailed');
    });
  });
});
