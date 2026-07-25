import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
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
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';
import { ImageDTOImageTypeEnum } from 'app/generated/model/image-dto';
import { JobDTO } from 'app/generated/model/job-dto';
import { ImageDTO } from 'app/generated/model/image-dto';
import { RecommendationType } from 'app/generated/model/recommendation-type';
import * as DropdownOptions from 'app/job/dropdown-options';
import { unescapeJsonString } from 'app/shared/util/util';

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
import {
  createResearchGroupResourceApiMock,
  provideResearchGroupResourceApiMock,
} from '../../../util/research-group-resource-api.service.mock';

interface Step {
  name: string;
  disabled?: boolean;
  buttonGroupPrev?: { onClick: () => void }[];
  buttonGroupNext?: { onClick: () => void; disabled?: boolean }[];
}

function fillValidJobForm(component: JobCreationFormComponent) {
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

function mockPanelTemplates(component: JobCreationFormComponent) {
  (component as { panel1: () => object }).panel1 = () => ({});
  (component as { panel2: () => object }).panel2 = () => ({});
  (component as { panel4: () => object }).panel4 = () => ({});
  (component as { savingStatePanel: () => object }).savingStatePanel = () => ({});
}

function mockAllPanelTemplates(component: JobCreationFormComponent) {
  const mockTemplate = {} as TemplateRef<HTMLDivElement>;
  Object.defineProperty(component, 'panel1', { get: () => signal(mockTemplate).asReadonly() });
  Object.defineProperty(component, 'panel2', { get: () => signal(mockTemplate).asReadonly() });
  Object.defineProperty(component, 'panel3', { get: () => signal(mockTemplate).asReadonly() });
  Object.defineProperty(component, 'panel4', { get: () => signal(mockTemplate).asReadonly() });
  Object.defineProperty(component, 'savingStatePanel', { get: () => signal(mockTemplate).asReadonly() });
}

type ComponentPrivate = {
  runAutoSave: () => Promise<boolean>;
  autoSaveInitialized: boolean;
  populateForm: (job?: JobDTO) => void;
  createJobDTO: (state?: JobFormDTOStateEnum) => JobFormDTO;
  buildStepData: () => Step[];
  findDropdownOption: (arr: { value: string }[], val: string) => unknown;
  extractJobDescriptionFromStream: (content: string) => string | null;
  loadSupervisingProfessors: () => Promise<void>;
  setDefaultSupervisingProfessor: (preselectId?: string) => void;
  translateAndStoreOtherLanguage: (currentLang: 'en' | 'de', currentText: string) => Promise<void>;
  analyzeAndUpdateScore: (lang: string) => Promise<void>;
};

function getPrivate(component: JobCreationFormComponent): ComponentPrivate {
  return component as unknown as ComponentPrivate;
}

describe('JobCreationFormComponent', () => {
  let fixture: ComponentFixture<JobCreationFormComponent>;
  let component: JobCreationFormComponent;
  let mockJobApi: ReturnType<typeof createJobResourceApiMock>;
  let mockImageApi: ReturnType<typeof createImageResourceApiMock>;
  let mockAccountService: ReturnType<typeof createAccountServiceMock>;
  let mockToastService: ReturnType<typeof createToastServiceMock>;
  let mockRouter: ReturnType<typeof createRouterMock>;
  let mockLocation: ReturnType<typeof createLocationMock>;
  let mockActivatedRoute: ReturnType<typeof createActivatedRouteMock>;
  let mockAiStreamingService: ReturnType<typeof createAiStreamingServiceMock>;
  let mockResearchGroupApi: ReturnType<typeof createResearchGroupResourceApiMock>;

  beforeEach(async () => {
    mockJobApi = createJobResourceApiMock();
    mockJobApi.getJobById.mockReturnValue(of({ title: 'Loaded Job', description: 'Desc' }));
    mockJobApi.createJob.mockReturnValue(of({ jobId: 'new123' }));
    mockJobApi.updateJob.mockReturnValue(of({}));

    mockImageApi = createImageResourceApiMock();
    mockImageApi.getMyDefaultJobBanners.mockReturnValue(of([]));
    mockImageApi.getDefaultJobBanners.mockReturnValue(of([]));
    mockImageApi.getResearchGroupJobBanners.mockReturnValue(of([]));
    mockImageApi.uploadJobBanner.mockReturnValue(
      of({ imageId: 'img123', url: '/images/test.jpg', imageType: ImageDTOImageTypeEnum.JobBanner }),
    );
    mockImageApi.deleteImage.mockReturnValue(of({}));

    mockAccountService = createAccountServiceMock();
    mockAccountService.user.set({ id: 'u1', name: 'Test User' } as User);
    mockToastService = createToastServiceMock();
    mockRouter = createRouterMock();
    mockLocation = createLocationMock();
    mockActivatedRoute = createActivatedRouteMock({}, {}, [new UrlSegment('job', {}), new UrlSegment('create', {})]);
    mockAiStreamingService = createAiStreamingServiceMock();
    mockAiStreamingService.generateJobApplicationDraftStream.mockResolvedValue('{"jobDescription":"<p>Generated content</p>"}');
    mockResearchGroupApi = createResearchGroupResourceApiMock();
    mockResearchGroupApi.getResearchGroupProfessors.mockReturnValue(of([]));

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
      ],
    })
      .overrideComponent(JobCreationFormComponent, {
        remove: { providers: [JobResourceApi, ImageResourceApi] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(JobCreationFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    fixture?.destroy();
  });

  it('should navigate to /my-positions when edit mode without jobId', async () => {
    mockActivatedRoute.setUrl([new UrlSegment('job', {}), new UrlSegment('edit', {})]);
    mockActivatedRoute.setParams({});
    const initialCallCount = vi.mocked(mockRouter.navigate).mock.calls.length;

    const fixture2 = TestBed.createComponent(JobCreationFormComponent);
    fixture2.detectChanges();
    await fixture2.whenStable();
    await new Promise(resolve => setTimeout(resolve, 0));

    const calls = vi.mocked(mockRouter.navigate).mock.calls.slice(initialCallCount);
    expect(calls).toContainEqual([['/my-positions']]);
    fixture2.destroy();
  });

  it('should load the saved job into the form when initialized in edit mode (page refresh)', async () => {
    mockJobApi.getJobById = vi.fn().mockReturnValue(of({ title: 'Saved Draft', researchArea: 'AI' }));
    mockActivatedRoute.setUrl([new UrlSegment('job', {}), new UrlSegment('edit', {})]);
    mockActivatedRoute.setParams({ job_id: 'job-xyz' });

    const fixture2 = TestBed.createComponent(JobCreationFormComponent);
    fixture2.detectChanges();
    await fixture2.whenStable();

    const comp = fixture2.componentInstance;
    expect(comp.mode()).toBe('edit');
    expect(comp.jobId()).toBe('job-xyz');
    expect(mockJobApi.getJobById).toHaveBeenCalledOnce();
    expect(mockJobApi.getJobById).toHaveBeenCalledWith('job-xyz');
    expect(comp.basicInfoForm.get('title')?.value).toBe('Saved Draft');
    fixture2.destroy();
  });

  it('should call Location.back on onBack', () => {
    component.onBack();
    expect(mockLocation.back).toHaveBeenCalledOnce();
  });

  it('should navigate to login when no user is loaded', async () => {
    mockAccountService.user.set(undefined as unknown as User);
    const fixture2 = TestBed.createComponent(JobCreationFormComponent);
    fixture2.detectChanges();
    await fixture2.whenStable();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });

  describe('Auto-Save', () => {
    it('should detect unsaved changes when form changes', () => {
      component.lastSavedData.set(component.currentJobData());
      expect(component.hasUnsavedChanges()).toBe(false);
      component.basicInfoForm.patchValue({ title: 'Modified Title' });
      fixture.detectChanges();
      expect(component.hasUnsavedChanges()).toBe(true);
    });

    it('should report failed save when updateJob rejects', async () => {
      mockJobApi.updateJob = vi.fn().mockReturnValueOnce(throwError(() => new Error('fail')));
      component.jobId.set('id123');
      const saved = await getPrivate(component).runAutoSave();
      expect(saved).toBe(false);
      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('toast.saveFailed');
    });

    it('should set jobId after creating new job', async () => {
      mockJobApi.createJob = vi.fn().mockReturnValueOnce(of({ jobId: 'abc123' }));
      component.jobId.set('');
      await getPrivate(component).runAutoSave();
      expect(component.jobId()).toBe('abc123');
      expect(mockJobApi.createJob).toHaveBeenCalledOnce();
    });

    it('should call updateJob when jobId is set', async () => {
      component.jobId.set('job123');
      await getPrivate(component).runAutoSave();
      expect(mockJobApi.updateJob).toHaveBeenCalledWith('job123', expect.any(Object));
    });

    it('should reflect the new job id in the URL after the first save so a refresh reloads the draft', async () => {
      mockJobApi.createJob = vi.fn().mockReturnValueOnce(of({ jobId: 'abc123' }));
      component.jobId.set('');
      await getPrivate(component).runAutoSave();
      expect(mockLocation.replaceState).toHaveBeenCalledOnce();
      expect(mockLocation.replaceState).toHaveBeenCalledWith('/job/edit/abc123');
    });

    it('should not change the URL when auto-saving an existing job', async () => {
      component.jobId.set('job123');
      await getPrivate(component).runAutoSave();
      expect(mockLocation.replaceState).not.toHaveBeenCalled();
    });

    it('should debounce form value changes', () => {
      getPrivate(component).autoSaveInitialized = true;
      const notifySpy = vi.spyOn(component.autoSave, 'notifyChanged');
      component.basicInfoForm.patchValue({ title: 'new title' });
      fixture.detectChanges();
      expect(notifySpy).toHaveBeenCalledOnce();
      expect(component.autoSave.state()).toBe('SAVING');
    });
  });

  describe('Job Publishing', () => {
    it.each([
      {
        name: 'publish successfully and navigate',
        setup: (comp: JobCreationFormComponent) => {
          fillValidJobForm(comp);
          fixture.detectChanges();
          comp.jobId.set('id123');
        },
        expectations: () => {
          expect(mockToastService.showSuccessKey).toHaveBeenCalledWith('toast.published');
          expect(mockLocation.back).toHaveBeenCalledOnce();
        },
      },
      {
        name: 'handle publish failure',
        setup: (comp: JobCreationFormComponent) => {
          mockJobApi.updateJob = vi.fn().mockReturnValueOnce(throwError(() => new Error('fail')));
          fillValidJobForm(comp);
          fixture.detectChanges();
          comp.jobId.set('id123');
        },
        expectations: () => {
          expect(mockToastService.showErrorKey).toHaveBeenCalledWith('toast.publishFailed');
        },
      },
      {
        name: 'skip when form data invalid',
        setup: (comp: JobCreationFormComponent) => {
          comp.basicInfoForm.patchValue({ title: '' });
          comp.positionDetailsForm.patchValue({ description: '' });
        },
        expectations: () => {
          expect(mockToastService.showSuccessKey).not.toHaveBeenCalled();
          expect(mockToastService.showErrorKey).not.toHaveBeenCalled();
        },
      },
    ])('should $name', async ({ setup, expectations }) => {
      setup(component);
      await component.publishJob();
      expectations();
    });

    it('should wait for in-flight autosave so Published is the last write', async () => {
      fillValidJobForm(component);
      fixture.detectChanges();
      component.jobId.set('id123');

      const draftSave = new Subject<JobFormDTO>();
      mockJobApi.updateJob = vi
        .fn()
        .mockReturnValueOnce(draftSave)
        .mockReturnValueOnce(of({ jobId: 'id123', state: JobFormDTOStateEnum.Published }));

      const autoSavePromise = getPrivate(component).runAutoSave();
      const publishPromise = component.publishJob();
      await Promise.resolve();

      expect(mockJobApi.updateJob).toHaveBeenCalledOnce();

      draftSave.next({ jobId: 'id123', state: JobFormDTOStateEnum.Draft } as JobFormDTO);
      draftSave.complete();
      await autoSavePromise;
      await publishPromise;

      expect(mockJobApi.updateJob).toHaveBeenCalledTimes(2);
      expect(mockJobApi.updateJob.mock.calls[0][1].state).toBe(JobFormDTOStateEnum.Draft);
      expect(mockJobApi.updateJob.mock.calls[1][1].state).toBe(JobFormDTOStateEnum.Published);
    });
  });

  describe('Form Population', () => {
    it('should populate fundingType when job has it', () => {
      const job: JobDTO = {
        jobId: 'job1',
        state: JobFormDTOStateEnum.Draft,
        title: 'Job',
        fundingType: DropdownOptions.fundingTypes[0].value,
      } as JobDTO;
      getPrivate(component).populateForm(job);
      expect(component.positionDetailsForm.get('fundingType')?.value).toEqual(DropdownOptions.fundingTypes[0]);
    });

    it('should populate selectedImage as default vs custom based on defaultImages', () => {
      component.defaultImages.set([{ imageId: 'img123', url: '/images/test.jpg', imageType: ImageDTOImageTypeEnum.DefaultJobBanner }]);
      getPrivate(component).populateForm({ title: 'Test', imageId: 'img123', imageUrl: '/images/test.jpg' } as JobDTO);
      expect(component.selectedImage()?.imageType).toBe(ImageDTOImageTypeEnum.DefaultJobBanner);

      component.defaultImages.set([{ imageId: 'default1', url: '/images/default.jpg', imageType: ImageDTOImageTypeEnum.DefaultJobBanner }]);
      getPrivate(component).populateForm({ title: 'Test', imageId: 'custom123', imageUrl: '/images/custom.jpg' } as JobDTO);
      expect(component.selectedImage()?.imageType).toBe(ImageDTOImageTypeEnum.JobBanner);
    });

    it('should not set image when imageId or imageUrl missing', () => {
      getPrivate(component).populateForm({ title: 'Test', imageUrl: '/images/test.jpg' } as JobDTO);
      expect(component.selectedImage()).toBeUndefined();
      getPrivate(component).populateForm(undefined);
      expect(component.selectedImage()).toBeUndefined();
    });

    it('should populate the recommendation type from the job and default to letter and evaluation', () => {
      getPrivate(component).populateForm({ title: 'Job', recommendationType: RecommendationType.LetterOnly } as JobDTO);
      expect(component.positionDetailsForm.get('recommendationType')?.value).toEqual(DropdownOptions.recommendationTypes[0]);

      getPrivate(component).populateForm(undefined);
      expect(component.positionDetailsForm.get('recommendationType')?.value).toEqual(
        DropdownOptions.recommendationTypes.find(option => option.value === RecommendationType.LetterAndEvaluation),
      );
    });
  });

  describe('Supervising Professor', () => {
    it('should load and sort professors filtering out non-professors', async () => {
      mockResearchGroupApi.getResearchGroupProfessors.mockReturnValueOnce(
        of([
          { userId: 'p2', firstName: 'Beta', lastName: 'Professor', roles: [UserShortDTORolesEnum.Professor] },
          { userId: 'p1', firstName: 'Alpha', lastName: 'Professor', roles: [UserShortDTORolesEnum.Professor] },
          { userId: 's1', firstName: 'Student', lastName: 'Member', roles: ['STUDENT'] },
        ]),
      );

      mockResearchGroupApi.getResearchGroupProfessors.mockClear();
      await getPrivate(component).loadSupervisingProfessors();

      expect(component.supervisingProfessorOptions()).toEqual([
        { value: 'p1', name: 'Alpha Professor' },
        { value: 'p2', name: 'Beta Professor' },
      ]);
    });

    it('should honor preselected supervising professor', () => {
      component.supervisingProfessorOptions.set([
        { value: 'p1', name: 'Alpha' },
        { value: 'p2', name: 'Beta' },
      ]);
      component.basicInfoForm.get('supervisingProfessor')?.setValue(undefined);
      getPrivate(component).setDefaultSupervisingProfessor('p2');
      expect(component.basicInfoForm.get('supervisingProfessor')?.value).toEqual({ value: 'p2', name: 'Beta' });
    });

    it('should prefer logged-in professor when in options', () => {
      mockAccountService.user.set({ id: 'u1', name: 'Prof User', authorities: [UserShortDTORolesEnum.Professor] } as User);
      component.supervisingProfessorOptions.set([
        { value: 'u1', name: 'Prof User' },
        { value: 'p2', name: 'Other' },
      ]);
      component.basicInfoForm.get('supervisingProfessor')?.setValue(undefined);
      getPrivate(component).setDefaultSupervisingProfessor();
      expect(component.basicInfoForm.get('supervisingProfessor')?.value).toEqual({ value: 'u1', name: 'Prof User' });
    });
  });

  describe('Image Management', () => {
    it('should handle image selection and clear', () => {
      const defaultImage: ImageDTO = {
        imageId: 'default1',
        url: '/images/default1.jpg',
        imageType: ImageDTOImageTypeEnum.DefaultJobBanner,
      };
      component.selectImage(defaultImage);
      expect(component.imageForm.get('imageId')?.value).toBe('default1');
      expect(component.imageSelected()).toBe(true);
      expect(component.hasCustomImage()).toBe(false);

      component.selectImage({ imageId: 'custom1', url: '/url', imageType: ImageDTOImageTypeEnum.JobBanner });
      expect(component.hasCustomImage()).toBe(true);

      component.clearImageSelection();
      expect(component.selectedImage()).toBeUndefined();
      expect(component.imageForm.get('imageId')?.value).toBeNull();
    });

    it('should delete selected image successfully', async () => {
      component.selectedImage.set({ imageId: 'img1', url: '/url', imageType: ImageDTOImageTypeEnum.JobBanner });
      await component.deleteSelectedImage();
      expect(mockImageApi.deleteImage).toHaveBeenCalledWith('img1');
      expect(component.selectedImage()).toBeUndefined();
      expect(mockToastService.showSuccessKey).toHaveBeenCalledWith('jobCreationForm.imageSection.deleteImageSuccess');
    });

    it('should toast error on delete failure', async () => {
      component.selectedImage.set({ imageId: 'img1', url: '/url', imageType: ImageDTOImageTypeEnum.JobBanner });
      mockImageApi.deleteImage.mockReturnValueOnce(throwError(() => new Error('Delete failed')));
      await component.deleteSelectedImage();
      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('jobCreationForm.imageSection.deleteImageFailed');
    });

    it.each([
      {
        name: 'skip delete with empty imageId',
        imageId: '',
        expectations: () => {
          expect(mockImageApi.deleteImage).not.toHaveBeenCalled();
        },
      },
      {
        name: 'delete non-selected image without clearing selection',
        imageId: 'img2',
        setup: (comp: JobCreationFormComponent) => {
          comp.selectedImage.set({ imageId: 'img1', url: '/url1', imageType: ImageDTOImageTypeEnum.JobBanner });
          comp.researchGroupImages.set([
            { imageId: 'img1', url: '/url1', imageType: ImageDTOImageTypeEnum.JobBanner },
            { imageId: 'img2', url: '/url2', imageType: ImageDTOImageTypeEnum.JobBanner },
          ]);
        },
        expectations: (comp: JobCreationFormComponent) => {
          expect(mockImageApi.deleteImage).toHaveBeenCalledWith('img2');
          expect(comp.selectedImage()?.imageId).toBe('img1');
        },
      },
    ])('should $name', async ({ imageId, setup, expectations }) => {
      setup?.(component);
      await component.deleteImage(imageId);
      expectations(component);
    });

    it('should load default images', async () => {
      const mockImages: ImageDTO[] = [
        { imageId: 'default1', url: '/images/default1.jpg', imageType: ImageDTOImageTypeEnum.DefaultJobBanner },
      ];
      mockImageApi.getMyDefaultJobBanners.mockReturnValueOnce(of(mockImages));
      await component.loadImages();
      expect(component.defaultImages()).toEqual(mockImages);
    });
  });

  describe('JobDTO Creation', () => {
    it('should create JobDTO with state and form data', () => {
      fillValidJobForm(component);
      component.imageForm.patchValue({ imageId: 'img123' });

      const draftDTO = getPrivate(component).createJobDTO(JobFormDTOStateEnum.Draft);
      expect(draftDTO.state).toBe(JobFormDTOStateEnum.Draft);
      expect(draftDTO.title).toBe('T');
      expect(draftDTO.imageId).toBe('img123');

      const publishedDTO = getPrivate(component).createJobDTO(JobFormDTOStateEnum.Published);
      expect(publishedDTO.state).toBe(JobFormDTOStateEnum.Published);
    });

    it('should normalize supervisingProfessor option object to ID', () => {
      component.basicInfoForm.patchValue({ supervisingProfessor: { value: 'prof-123', name: 'Prof A' } });
      const dto = getPrivate(component).createJobDTO(JobFormDTOStateEnum.Draft);
      expect(dto.supervisingProfessor).toBe('prof-123');
    });

    it('should fall back to preferred supervising professor when control empty', () => {
      mockAccountService.user.set({ id: 'prof-1', name: 'Prof User', authorities: [UserShortDTORolesEnum.Professor] } as User);
      component.supervisingProfessorOptions.set([
        { value: 'prof-1', name: 'Prof User' },
        { value: 'prof-2', name: 'Prof Two' },
      ]);
      component.basicInfoForm.patchValue({ supervisingProfessor: undefined });
      const dto = getPrivate(component).createJobDTO(JobFormDTOStateEnum.Draft);
      expect(dto.supervisingProfessor).toBe('prof-1');
    });
  });

  describe('Recommendation Type', () => {
    it('should include the selected recommendation type in the submitted DTO', () => {
      fillValidJobForm(component);
      component.positionDetailsForm.patchValue({
        referenceLettersRequired: { value: 2, name: '2' },
        recommendationType: DropdownOptions.recommendationTypes.find(option => option.value === RecommendationType.EvaluationOnly),
      });

      const dto = getPrivate(component).createJobDTO(JobFormDTOStateEnum.Draft);
      expect(dto.recommendationType).toBe(RecommendationType.EvaluationOnly);
    });

    it('should show the type select only while recommendations are required', () => {
      expect(component.recommendationTypeVisible()).toBe(false);

      component.positionDetailsForm.patchValue({ referenceLettersRequired: { value: 1, name: '1' } });
      expect(component.recommendationTypeVisible()).toBe(true);

      component.positionDetailsForm.patchValue({ referenceLettersRequired: { value: 0, name: '0' } });
      expect(component.recommendationTypeVisible()).toBe(false);
    });
  });

  describe('Computed Signals', () => {
    it('should compute publishableJobData and currentJobData based on form validity', () => {
      expect(component.allFormsValid()).toBe(false);
      expect(component.publishableJobData()).toBeUndefined();

      fillValidJobForm(component);
      fixture.detectChanges();
      expect(component.allFormsValid()).toBe(true);
      expect(component.publishableJobData()?.state).toBe(JobFormDTOStateEnum.Published);
      expect(component.currentJobData().state).toBe(JobFormDTOStateEnum.Draft);
      expect(component.currentJobData().title).toBe('T');
    });
  });

  describe('Step Navigation', () => {
    beforeEach(() => {
      mockPanelTemplates(component);
    });

    it('should disable steps based on form validity', () => {
      component.basicInfoValid.set(false);
      component.positionDetailsValid.set(false);
      let steps = getPrivate(component).buildStepData();
      expect(steps.find(s => s.name.includes('employmentTerms'))?.disabled).toBe(true);
      expect(steps.find(s => s.name.includes('summary'))?.disabled).toBe(true);
      expect(steps[0].buttonGroupNext?.[0].disabled).toBe(true);

      component.basicInfoValid.set(true);
      steps = getPrivate(component).buildStepData();
      expect(steps[0].buttonGroupNext?.[0].disabled).toBe(false);
    });

    it('should call location.back on first step prev button', () => {
      const steps = getPrivate(component).buildStepData();
      steps[0].buttonGroupPrev?.[0].onClick();
      expect(mockLocation.back).toHaveBeenCalledOnce();
    });

    it('should set showPublishDialog true when publish button clicked', () => {
      component.basicInfoValid.set(true);
      component.positionDetailsValid.set(true);
      const steps = getPrivate(component).buildStepData();
      steps.find(s => s.name.includes('summary'))?.buttonGroupNext?.[0].onClick();
      expect(component.showPublishDialog()).toBe(true);
    });

    it('should toggle image step disabled with form validity', () => {
      mockAllPanelTemplates(component);
      const imageStepDisabled = (): boolean | undefined =>
        getPrivate(component)
          .buildStepData()
          .find((s: Step) => s.name.includes('imageSelection'))?.disabled;

      component.basicInfoValid.set(false);
      component.positionDetailsValid.set(false);
      expect(imageStepDisabled()).toBe(true);

      component.basicInfoValid.set(false);
      component.positionDetailsValid.set(true);
      expect(imageStepDisabled()).toBe(true);

      component.basicInfoValid.set(true);
      component.positionDetailsValid.set(true);
      expect(imageStepDisabled()).toBe(false);
    });
  });

  describe('Utility / AI helpers', () => {
    it.each([
      { options: [{ value: 'x' }], search: 'y', expected: undefined },
      { options: [{ value: 'a' }, { value: 'b' }], search: 'b', expected: { value: 'b' } },
    ])('findDropdownOption returns $expected', ({ options, search, expected }) => {
      expect(getPrivate(component).findDropdownOption(options, search)).toEqual(expected);
    });

    it.each([
      ['', null],
      ['   ', null],
      ['{"jobDescription":"<p>Test content</p>"}', '<p>Test content</p>'],
      ['{"jobDescription":"Line1\\nLine2\\tTabbed"}', 'Line1\nLine2\tTabbed'],
      ['{"jobDescription":"He said \\"Hello\\""}', 'He said "Hello"'],
      ['{"jobDescription":"<p>Partial content', '<p>Partial content'],
      ['<p>Plain HTML content</p>', '<p>Plain HTML content</p>'],
    ])('extractJobDescriptionFromStream(%j) -> %j', (input, expected) => {
      expect(getPrivate(component).extractJobDescriptionFromStream(input as string)).toBe(expected as string | null);
    });

    it.each([
      ['Line1\\nLine2', 'Line1\nLine2'],
      ['Line1\\rLine2', 'Line1\rLine2'],
      ['Col1\\tCol2', 'Col1\tCol2'],
      ['He said \\"Hi\\"', 'He said "Hi"'],
      ['Plain text', 'Plain text'],
    ])('unescapeJsonString(%j) -> %j', (input, expected) => {
      expect(unescapeJsonString(input)).toBe(expected);
    });
  });

  describe('generateJobApplicationDraft', () => {
    function setupGen() {
      component.jobId.set('job123');
      fillValidJobForm(component);
      const mockEditor = { forceUpdate: vi.fn() };
      Object.defineProperty(component, 'jobDescriptionEditor', {
        value: () => mockEditor,
        configurable: true,
      });
      return mockEditor;
    }

    it('should toast error on failure and restore content', async () => {
      const editor = setupGen();
      const original = '<p>Original content</p>';
      component.basicInfoForm.get('jobDescription')?.setValue(original);
      mockAiStreamingService.generateJobApplicationDraftStream.mockRejectedValue(new Error('Generic error'));

      await component.generateJobApplicationDraft();

      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('jobCreationForm.toastMessages.saveFailed');
      const lastCall = editor.forceUpdate.mock.calls[editor.forceUpdate.mock.calls.length - 1];
      expect(lastCall[0]).toBe(original);
      expect(component.rewriteButtonSignal()).toBe(true);
    });

    it('should cancel translation when in flight', async () => {
      setupGen();
      component.isTranslating.set(true);
      const cancelSpy = vi.spyOn(component as unknown as { cancelTranslation: () => void }, 'cancelTranslation');
      mockAiStreamingService.generateJobApplicationDraftStream.mockRejectedValue(new Error('fail'));
      await component.generateJobApplicationDraft();
      expect(cancelSpy).toHaveBeenCalledOnce();
    });

    it('should not cancel translation when not in flight', async () => {
      setupGen();
      component.isTranslating.set(false);
      const cancelSpy = vi.spyOn(component as unknown as { cancelTranslation: () => void }, 'cancelTranslation');
      mockAiStreamingService.generateJobApplicationDraftStream.mockRejectedValue(new Error('fail'));
      await component.generateJobApplicationDraft();
      expect(cancelSpy).not.toHaveBeenCalled();
    });
  });

  describe('Language switching', () => {
    it('should not run a save when switching languages with no pending edits', () => {
      getPrivate(component).autoSaveInitialized = true;
      component.autoSave.reset();
      component.currentDescriptionLanguage.set('en');
      const flushSpy = vi.spyOn(component.autoSave, 'flush');

      component.changeDescriptionLanguage('de');

      expect(flushSpy).not.toHaveBeenCalled();
      expect(component.currentDescriptionLanguage()).toBe('de');
    });

    it('should flush pending edits before switching languages', () => {
      getPrivate(component).autoSaveInitialized = true;
      component.currentDescriptionLanguage.set('en');
      component.autoSave.notifyChanged();
      const flushSpy = vi.spyOn(component.autoSave, 'flush').mockResolvedValue();

      component.changeDescriptionLanguage('de');

      expect(flushSpy).toHaveBeenCalledOnce();
      expect(component.currentDescriptionLanguage()).toBe('de');
    });
  });

  describe('Translation and compliance', () => {
    it('should clear the translation spinner once streaming ends, before compliance analysis finishes', async () => {
      component.jobId.set('job1');
      component.currentDescriptionLanguage.set('en');
      component.lastTranslatedEN.set('');
      mockAiStreamingService.translateJobDescriptionStream.mockResolvedValue('{"translatedText":"<p>Hallo</p>"}');

      let resolveAnalysis!: () => void;
      const analysisDone = new Promise<void>(resolve => {
        resolveAnalysis = resolve;
      });
      const analyzeSpy = vi.spyOn(getPrivate(component), 'analyzeAndUpdateScore').mockImplementation(async () => {
        await analysisDone;
        component.isAnalyzing.set(false);
      });

      const promise = getPrivate(component).translateAndStoreOtherLanguage('en', 'Hello EN');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(component.isTranslating()).toBe(false);
      expect(component.isAnalyzing()).toBe(true);
      expect(analyzeSpy).toHaveBeenCalledWith('de');

      resolveAnalysis();
      await promise;
      expect(component.isAnalyzing()).toBe(false);
    });

    it('should skip translation when the source text matches the last translated baseline', async () => {
      component.jobId.set('job1');
      component.currentDescriptionLanguage.set('en');
      component.lastTranslatedEN.set('Hello EN');

      await getPrivate(component).translateAndStoreOtherLanguage('en', 'Hello EN');

      expect(mockAiStreamingService.translateJobDescriptionStream).not.toHaveBeenCalled();
      expect(component.isTranslating()).toBe(false);
    });
  });
});
