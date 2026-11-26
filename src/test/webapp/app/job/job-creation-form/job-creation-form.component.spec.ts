import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { UrlSegment } from '@angular/router';
import { JobCreationFormComponent } from 'app/job/job-creation-form/job-creation-form.component';
import { User } from 'app/core/auth/account.service';
import { JobFormDTO, JobFormDTOStateEnum } from 'app/generated/model/job-form-dto';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';
import { ImageDTOImageTypeEnum } from 'app/generated/model/image-dto';
import { JobDTO } from 'app/generated/model/job-dto';
import { ImageDTO } from 'app/generated/model/image-dto';
import { RecommendationType } from 'app/generated/model/recommendation-type';
import { BiasedIssueDTO as BiasedIssue } from 'app/generated/model/biased-issue-dto';
import { AiFeatureStatusService } from 'app/service/ai-feature-status.service';
import * as DropdownOptions from 'app/job/dropdown-options';
import { createAccountServiceMock } from '../../../util/account.service.mock';
import { createToastServiceMock } from '../../../util/toast-service.mock';
import { createRouterMock } from '../../../util/router.mock';
import { createLocationMock } from '../../../util/location.mock';
import { createActivatedRouteMock } from '../../../util/activated-route.mock';
import { createJobResourceApiMock } from '../../../util/job-resource-api.service.mock';
import { createImageResourceApiMock } from '../../../util/image-resource-api.service.mock';
import { createAiStreamingServiceMock } from '../../../util/ai-streaming.service.mock';
import { createUserResourceApiMock } from '../../../util/user-resource-api.service.mock';
import { createResearchGroupResourceApiMock } from '../../../util/research-group-resource-api.service.mock';

import {
  Step,
  fillValidJobForm,
  mockPanelTemplates,
  mockAllPanelTemplates,
  getPrivate,
  setupJobCreationForm,
} from './job-creation-form.test-setup';

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
  let mockUserApi: ReturnType<typeof createUserResourceApiMock>;

  beforeEach(async () => {
    const context = await setupJobCreationForm();
    fixture = context.fixture;
    component = context.component;
    mockJobApi = context.mockJobApi;
    mockImageApi = context.mockImageApi;
    mockAccountService = context.mockAccountService;
    mockToastService = context.mockToastService;
    mockRouter = context.mockRouter;
    mockLocation = context.mockLocation;
    mockActivatedRoute = context.mockActivatedRoute;
    mockAiStreamingService = context.mockAiStreamingService;
    mockResearchGroupApi = context.mockResearchGroupApi;
    mockUserApi = context.mockUserApi;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    fixture?.destroy();
  });

  describe('Component Initialization', () => {
    it('should expose gender decoder issues only for the selected description language', () => {
      const issues: BiasedIssue[] = [
        { language: 'en', word: 'leader', type: 'NON_INCLUSIVE' },
        { language: 'de', word: 'durchsetzungsfähig', type: 'NON_INCLUSIVE' },
        { word: 'legacy', type: 'INCLUSIVE' },
      ];
      component.biasedIssues.set(issues);

      component.currentDescriptionLanguage.set('en');
      expect(component.currentBiasedIssues().map(issue => issue.word)).toEqual(['leader', 'legacy']);

      component.currentDescriptionLanguage.set('de');
      expect(component.currentBiasedIssues().map(issue => issue.word)).toEqual(['durchsetzungsfähig', 'legacy']);
    });

    it('should navigate to /my-positions if edit mode but no jobId', async () => {
      // Update the existing mock for this test case BEFORE creating component
      mockActivatedRoute.setUrl([new UrlSegment('job', {}), new UrlSegment('edit', {})]);
      mockActivatedRoute.setParams({});

      // Track the initial call count to check for new calls
      const initialCallCount = vi.mocked(mockRouter.navigate).mock.calls.length;

      const fixture2 = TestBed.createComponent(JobCreationFormComponent);
      fixture2.detectChanges();
      await fixture2.whenStable();
      await new Promise(resolve => setTimeout(resolve, 0));

      const calls = vi.mocked(mockRouter.navigate).mock.calls.slice(initialCallCount);
      expect(calls).toContainEqual([['/my-positions']]);
      fixture2.destroy();
    });
  });

  it('should load the saved job into the form when initialized in edit mode (page refresh)', async () => {
    mockJobApi.getJobById = vi.fn().mockReturnValue(of({ title: 'Saved Draft', researchArea: 'AI' }));
    mockActivatedRoute.setUrl([new UrlSegment('job', {}), new UrlSegment('edit', {})]);
    mockActivatedRoute.setParams({ job_id: 'job-xyz' });

    const fixture2 = TestBed.createComponent(JobCreationFormComponent);
    fixture2.detectChanges();
    const comp = fixture2.componentInstance;
    await vi.waitFor(() => expect(comp.basicInfoForm.get('title')?.value).toBe('Saved Draft'));

    expect(comp.mode()).toBe('edit');
    expect(comp.jobId()).toBe('job-xyz');
    expect(mockJobApi.getJobById).toHaveBeenCalledOnce();
    expect(mockJobApi.getJobById).toHaveBeenCalledWith('job-xyz');
    fixture2.destroy();
  });

  it.each([
    { stored: 'no analysis', aiScore: undefined, expectedCalls: 1 },
    { stored: 'an analysis', aiScore: 40, expectedCalls: 0 },
  ])('should analyze an opened job only when it has $stored stored', async ({ aiScore, expectedCalls }) => {
    const reanalyze = vi.spyOn(JobCreationFormComponent.prototype, 'reanalyze').mockResolvedValue();
    mockJobApi.getJobById = vi
      .fn()
      .mockReturnValue(of({ title: 'Saved Draft', jobDescriptionEN: '<p>We look for a researcher.</p>', aiScore }));
    mockActivatedRoute.setUrl([new UrlSegment('job', {}), new UrlSegment('edit', {})]);
    mockActivatedRoute.setParams({ job_id: 'job-xyz' });

    const fixture2 = TestBed.createComponent(JobCreationFormComponent);
    fixture2.detectChanges();
    const comp = fixture2.componentInstance;
    await vi.waitFor(() => expect(comp.isLoading()).toBe(false));
    await fixture2.whenStable();

    expect(reanalyze).toHaveBeenCalledTimes(expectedCalls);
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

    it('should restart analysis and translation for a newer edit while analysis is running', async () => {
      const description = '<p>We need a leading researcher.</p>';
      component.jobId.set('job123');
      component.currentDescriptionLanguage.set('en');
      component.basicInfoForm.get('jobDescription')?.setValue(description);
      component.jobDescriptionEN.set(description);
      component.aiToggleSignal.set(true);
      TestBed.inject(AiFeatureStatusService).aiSystemEnabled.set(true);
      component.isAnalyzing.set(true);
      mockJobApi.updateJob.mockReturnValue(of({ jobId: 'job123', jobDescriptionEN: description }));
      const sourceIssues = Promise.resolve(undefined);
      const analyzeSpy = vi.spyOn(getPrivate(component), 'analyzeAndUpdateScore').mockReturnValue(sourceIssues);
      const translateSpy = vi.spyOn(getPrivate(component), 'translateAndStoreOtherLanguage').mockResolvedValue();

      await getPrivate(component).runAutoSave();

      expect(analyzeSpy).toHaveBeenCalledWith('en', expect.anything());
      expect(translateSpy).toHaveBeenCalledWith('en', description, sourceIssues, expect.anything());
    });

    it('should persist a newer edit only after the previous save finishes', async () => {
      const firstSave = new Subject<JobFormDTO>();
      component.jobId.set('job123');
      component.currentDescriptionLanguage.set('en');
      component.aiToggleSignal.set(false);
      component.basicInfoForm.get('jobDescription')?.setValue('<p>ambitious leading</p>');
      mockJobApi.updateJob
        .mockReturnValueOnce(firstSave.asObservable())
        .mockReturnValueOnce(of({ jobId: 'job123', jobDescriptionEN: '<p>updated</p>' }));

      const oldSave = getPrivate(component).runAutoSave();
      component.basicInfoForm.get('jobDescription')?.setValue('<p>updated</p>');
      const newSave = getPrivate(component).runAutoSave();

      expect(mockJobApi.updateJob).toHaveBeenCalledOnce();
      firstSave.next({ jobId: 'job123', jobDescriptionEN: '<p>ambitious leading</p>' } as JobFormDTO);
      firstSave.complete();
      await oldSave;
      await newSave;

      expect(mockJobApi.updateJob).toHaveBeenCalledTimes(2);
      expect(mockJobApi.updateJob.mock.calls[1]?.[1].jobDescriptionEN).toBe('<p>updated</p>');
    });
  });

  describe('Job Publishing', () => {
    it.each([
      {
        name: 'publish successfully and open the positions overview',
        setup: (comp: JobCreationFormComponent) => {
          fillValidJobForm(comp);
          fixture.detectChanges();
          comp.jobId.set('id123');
        },
        expectations: () => {
          expect(mockToastService.showSuccessKey).toHaveBeenCalledWith('toast.published');
          expect(mockRouter.navigate).toHaveBeenCalledWith(['/my-positions']);
          expect(mockLocation.back).not.toHaveBeenCalled();
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
});
