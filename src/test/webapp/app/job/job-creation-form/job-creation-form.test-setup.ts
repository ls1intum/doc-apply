import { ComponentFixture, TestBed } from '@angular/core/testing';
import { it } from 'vitest';
import { of } from 'rxjs';
import { UrlSegment } from '@angular/router';
import { signal, TemplateRef } from '@angular/core';
import { JobCreationFormComponent } from 'app/job/job-creation-form/job-creation-form.component';
import { JobResourceApi } from 'app/generated/api/job-resource-api';
import { ImageResourceApi } from 'app/generated/api/image-resource-api';
import { User } from 'app/core/auth/account.service';
import {
  JobFormDTO,
  JobFormDTOFundingTypeEnum,
  JobFormDTOLocationEnum,
  JobFormDTOSubjectAreaEnum,
  JobFormDTOStateEnum,
} from 'app/generated/model/job-form-dto';
import { ImageDTOImageTypeEnum } from 'app/generated/model/image-dto';
import { JobDTO } from 'app/generated/model/job-dto';
import { ComplianceIssueDTO as ComplianceIssue } from 'app/generated/model/compliance-issue-dto';
import { AiResourceApi } from 'app/generated/api/ai-resource-api';
import { provideTranslateMock } from '../../../util/translate.mock';
import { provideFontAwesomeTesting } from '../../../util/fontawesome.testing';
import { createAccountServiceMock, provideAccountServiceMock } from '../../../util/account.service.mock';
import { createToastServiceMock, provideToastServiceMock } from '../../../util/toast-service.mock';
import { createRouterMock, provideRouterMock } from '../../../util/router.mock';
import { createLocationMock, provideLocationMock } from '../../../util/location.mock';
import { createActivatedRouteMock, provideActivatedRouteMock } from '../../../util/activated-route.mock';
import { createJobResourceApiMock, provideJobResourceApiMock } from '../../../util/job-resource-api.service.mock';
import { createImageResourceApiMock, provideImageResourceApiMock } from '../../../util/image-resource-api.service.mock';
import { createAiStreamingServiceMock, provideAiStreamingServiceMock } from '../../../util/ai-streaming.service.mock';
import { createUserResourceApiMock, provideUserResourceApiMock } from '../../../util/user-resource-api.service.mock';
import {
  createResearchGroupResourceApiMock,
  provideResearchGroupResourceApiMock,
} from '../../../util/research-group-resource-api.service.mock';

/** The parts of a progress-stepper step that the specs inspect. */
export interface Step {
  name: string;
  disabled?: boolean;
  buttonGroupPrev?: { onClick: () => void }[];
  buttonGroupNext?: { onClick: () => void; disabled?: boolean }[];
}

/**
 * Fills both form steps and both description languages with valid values.
 *
 * @param component the job form to fill
 */
export function fillValidJobForm(component: JobCreationFormComponent) {
  component.basicInfoForm.patchValue({
    title: 'T',
    researchArea: 'AI',
    subjectArea: { value: JobFormDTOSubjectAreaEnum.ComputerScience },
    location: { value: JobFormDTOLocationEnum.Munich },
    supervisingProfessor: 'Prof',
    jobDescription: '<p>This is a job description.</p>',
  });
  component.jobDescriptionEN.set('<p>This is a job description.</p>');
  component.jobDescriptionDE.set('<p>Das ist eine Job Beschreibung.</p>');
  component.jobDescriptionSignal.set('<p>This is a job description.</p>');
  component.positionDetailsForm.patchValue({
    startDate: '2025-02-25',
    applicationDeadline: '2025-01-01',
    workload: 20,
    contractDuration: 3,
    fundingType: { value: JobFormDTOFundingTypeEnum.FullyFunded, name: 'Fully Funded' },
  });

  component.basicInfoForm.updateValueAndValidity();
  component.positionDetailsForm.updateValueAndValidity();
}

/**
 * Replaces the panel templates the stepper reads with empty stand-ins, so step data can be built without rendering.
 *
 * @param component the job form whose templates are replaced
 */
export function mockPanelTemplates(component: JobCreationFormComponent) {
  (component as { panel1: () => object }).panel1 = () => ({});
  (component as { panel2: () => object }).panel2 = () => ({});
  (component as { panel4: () => object }).panel4 = () => ({});
  (component as { savingStatePanel: () => object }).savingStatePanel = () => ({});
}

/**
 * Replaces every panel template, including the image panel, with a template signal.
 *
 * @param component the job form whose templates are replaced
 */
export function mockAllPanelTemplates(component: JobCreationFormComponent) {
  const mockTemplate = {} as TemplateRef<HTMLDivElement>;
  Object.defineProperty(component, 'panel1', { get: () => signal(mockTemplate).asReadonly() });
  Object.defineProperty(component, 'panel2', { get: () => signal(mockTemplate).asReadonly() });
  Object.defineProperty(component, 'panel3', { get: () => signal(mockTemplate).asReadonly() });
  Object.defineProperty(component, 'panel4', { get: () => signal(mockTemplate).asReadonly() });
  Object.defineProperty(component, 'savingStatePanel', { get: () => signal(mockTemplate).asReadonly() });
}

/** The private members of the job form that the specs call or stub directly. */
export type ComponentPrivate = {
  runAutoSave: () => Promise<boolean>;
  autoSaveInitialized: boolean;
  populateForm: (job?: JobDTO) => void;
  createJobDTO: (state?: JobFormDTOStateEnum) => JobFormDTO;
  buildStepData: () => Step[];
  findDropdownOption: (arr: { value: string }[], val: string) => unknown;
  extractJobDescriptionFromStream: (content: string) => string | null;
  loadSupervisingProfessors: () => Promise<void>;
  setDefaultSupervisingProfessor: (preselectId?: string) => void;
  translateAndStoreOtherLanguage: (
    currentLang: 'en' | 'de',
    currentText: string,
    sourceIssues: Promise<ComplianceIssue[] | undefined>,
    run?: unknown,
  ) => Promise<void>;
  analyzeAndUpdateScore: (lang: string, run?: unknown) => Promise<ComplianceIssue[] | undefined>;
  startAiRun: () => unknown;
  refreshComplianceHighlights: () => void;
  aiApi: AiResourceApi;
};

/**
 * Gives access to the private members of the job form.
 *
 * @param component the job form
 * @returns the same instance, typed with its private members
 */
export function getPrivate(component: JobCreationFormComponent): ComponentPrivate {
  return component as unknown as ComponentPrivate;
}

/** The rendered job form together with the mocks it was created with, shared by the job form specs. */
export interface JobCreationFormContext {
  fixture: ComponentFixture<JobCreationFormComponent>;
  component: JobCreationFormComponent;
  mockJobApi: ReturnType<typeof createJobResourceApiMock>;
  mockImageApi: ReturnType<typeof createImageResourceApiMock>;
  mockAccountService: ReturnType<typeof createAccountServiceMock>;
  mockToastService: ReturnType<typeof createToastServiceMock>;
  mockRouter: ReturnType<typeof createRouterMock>;
  mockLocation: ReturnType<typeof createLocationMock>;
  mockActivatedRoute: ReturnType<typeof createActivatedRouteMock>;
  mockAiStreamingService: ReturnType<typeof createAiStreamingServiceMock>;
  mockResearchGroupApi: ReturnType<typeof createResearchGroupResourceApiMock>;
  mockUserApi: ReturnType<typeof createUserResourceApiMock>;
}

/**
 * Configures the testing module with mocks for every dependency of the job form and renders it.
 *
 * @returns the rendered form and its mocks, so each spec can stub responses and assert calls
 */
export async function setupJobCreationForm(): Promise<JobCreationFormContext> {
  const mockJobApi = createJobResourceApiMock();
  mockJobApi.getJobById.mockReturnValue(of({ title: 'Loaded Job', description: 'Desc' }));
  mockJobApi.createJob.mockReturnValue(of({ jobId: 'new123' }));
  mockJobApi.updateJob.mockReturnValue(of({}));

  const mockImageApi = createImageResourceApiMock();
  mockImageApi.getMyDefaultJobBanners.mockReturnValue(of([]));
  mockImageApi.getDefaultJobBanners.mockReturnValue(of([]));
  mockImageApi.getResearchGroupJobBanners.mockReturnValue(of([]));
  mockImageApi.uploadJobBanner.mockReturnValue(
    of({ imageId: 'img123', url: '/images/test.jpg', imageType: ImageDTOImageTypeEnum.JobBanner }),
  );
  mockImageApi.deleteImage.mockReturnValue(of({}));

  const mockAccountService = createAccountServiceMock();
  mockAccountService.user.set({ id: 'u1', name: 'Test User' } as User);
  const mockToastService = createToastServiceMock();
  const mockRouter = createRouterMock();
  const mockLocation = createLocationMock();
  const mockActivatedRoute = createActivatedRouteMock({}, {}, [new UrlSegment('job', {}), new UrlSegment('create', {})]);
  const mockAiStreamingService = createAiStreamingServiceMock();
  mockAiStreamingService.generateJobApplicationDraftStream.mockResolvedValue('{"jobDescription":"<p>Generated content</p>"}');
  const mockResearchGroupApi = createResearchGroupResourceApiMock();
  mockResearchGroupApi.getResearchGroupProfessors.mockReturnValue(of([]));
  const mockUserApi = createUserResourceApiMock();
  mockUserApi.getAiConsent.mockReturnValue(of(true));

  await TestBed.configureTestingModule({
    imports: [JobCreationFormComponent],
    providers: [
      provideJobResourceApiMock(mockJobApi),
      provideImageResourceApiMock(mockImageApi),
      provideLocationMock(mockLocation),
      provideActivatedRouteMock(mockActivatedRoute),
      provideAccountServiceMock(mockAccountService),
      provideToastServiceMock(mockToastService),
      provideRouterMock(mockRouter),
      provideTranslateMock(),
      provideFontAwesomeTesting(),
      provideAiStreamingServiceMock(mockAiStreamingService),
      provideResearchGroupResourceApiMock(mockResearchGroupApi),
      provideUserResourceApiMock(mockUserApi),
    ],
  })
    .overrideComponent(JobCreationFormComponent, {
      remove: { providers: [JobResourceApi, ImageResourceApi] },
    })
    .compileComponents();

  const fixture = TestBed.createComponent(JobCreationFormComponent);
  const component = fixture.componentInstance;
  fixture.detectChanges();
  return {
    fixture,
    component,
    mockJobApi,
    mockImageApi,
    mockAccountService,
    mockToastService,
    mockRouter,
    mockLocation,
    mockActivatedRoute,
    mockAiStreamingService,
    mockResearchGroupApi,
    mockUserApi,
  };
}
