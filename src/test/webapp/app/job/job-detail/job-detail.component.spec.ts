import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';

import { JobDetailComponent, JobDetails } from 'app/job/job-detail/job-detail.component';
import { JhiMenuItem } from 'app/shared/components/atoms/menu/menu.component';
import { User } from 'app/core/auth/account.service';
import { JobResourceApi } from 'app/generated/api/job-resource-api';
import { ResearchGroupResourceApi } from 'app/generated/api/research-group-resource-api';
import { JobDetailDTO, JobDetailDTOStateEnum } from 'app/generated/model/job-detail-dto';
import { JobFormDTO, JobFormDTOLocationEnum, JobFormDTOSubjectAreaEnum } from 'app/generated/model/job-form-dto';
import { signal } from '@angular/core';
import { ApplicationForApplicantDTOApplicationStateEnum } from 'app/generated/model/application-for-applicant-dto';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideTranslateMock } from '../../../util/translate.mock';
import { provideFontAwesomeTesting } from '../../../util/fontawesome.testing';
import { createAccountServiceMock, provideAccountServiceMock } from '../../../util/account.service.mock';
import { createRouterMock, provideRouterMock } from '../../../util/router.mock';
import { createToastServiceMock, provideToastServiceMock } from '../../../util/toast-service.mock';
import { PdfExportResourceApi } from 'app/generated/api/pdf-export-resource-api';

type ResearchGroupDetails = {
  department?: { name: string };
  description?: string;
  email?: string;
  website?: string;
  street?: string;
  postalCode?: string;
  city?: string;
};

type JobDetailComponentInternals = {
  loadJobDetailsFromForm(form: JobFormDTO): Promise<void>;
  mapToJobDetails(data: JobDetailDTO | JobFormDTO, user?: User, researchGroupDetails?: ResearchGroupDetails, isForm?: boolean): JobDetails;
  isOwnerOfJob(job: JobDetails): boolean;
};

type MapToJobDetailsArgs =
  | [data: JobDetailDTO | JobFormDTO]
  | [data: JobDetailDTO | JobFormDTO, user: User | undefined]
  | [data: JobDetailDTO | JobFormDTO, user: User | undefined, researchGroupDetails: ResearchGroupDetails | undefined]
  | [data: JobDetailDTO | JobFormDTO, user: User | undefined, researchGroupDetails: ResearchGroupDetails | undefined, isForm: boolean];

describe('JobDetailComponent', () => {
  let fixture: ComponentFixture<JobDetailComponent>;
  let component: JobDetailComponent;
  let translate: TranslateService;

  let mockRouter: ReturnType<typeof createRouterMock>;
  let mockToastService: ReturnType<typeof createToastServiceMock>;

  let location: Location;
  let jobApi: {
    getJobDetails: ReturnType<typeof vi.fn>;
    changeJobState: ReturnType<typeof vi.fn>;
    deleteJob: ReturnType<typeof vi.fn>;
  };
  let mockAccountService: ReturnType<typeof createAccountServiceMock>;
  let researchGroupApi: { getResourceGroupDetails: ReturnType<typeof vi.fn> };
  let pdfExportApi: {
    exportJobToPDF: ReturnType<typeof vi.fn>;
    exportJobPreviewToPDF: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockRouter = createRouterMock();
    mockToastService = createToastServiceMock();
    location = { back: vi.fn() } as unknown as Location;
    jobApi = {
      getJobDetails: vi.fn(),
      changeJobState: vi.fn(),
      deleteJob: vi.fn(),
    };
    mockAccountService = createAccountServiceMock();

    researchGroupApi = {
      getResourceGroupDetails: vi.fn().mockReturnValue(of({ description: 'RG Desc' })),
    };

    pdfExportApi = {
      exportJobToPDF: vi.fn(),
      exportJobPreviewToPDF: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [JobDetailComponent],
      providers: [
        { provide: Location, useValue: location },
        { provide: JobResourceApi, useValue: jobApi },
        { provide: ResearchGroupResourceApi, useValue: researchGroupApi },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['job_id', 'job123']]) } } },
        { provide: PdfExportResourceApi, useValue: pdfExportApi },
        provideToastServiceMock(mockToastService),
        provideRouterMock(mockRouter),
        provideAccountServiceMock(mockAccountService),
        provideTranslateMock(),
        provideFontAwesomeTesting(),
        provideHttpClient(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(JobDetailComponent);
    translate = TestBed.inject(TranslateService);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Navigation actions', () => {
    it('should navigate to apply form on onApply', () => {
      component.jobId.set('job123');
      component.onApply();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/application/form'], { queryParams: { job: 'job123' } });
    });

    it('should navigate to edit application on onEditApplication', () => {
      component.jobId.set('job123');
      component.jobDetails.set({ applicationId: 'app42' } as JobDetails);
      component.onEditApplication();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/application/form'], { queryParams: { job: 'job123', application: 'app42' } });
    });

    it('should navigate to view application on onViewApplication', () => {
      component.jobDetails.set({ applicationId: 'app88' } as JobDetails);
      component.onViewApplication();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/application/detail/app88']);
    });

    it('should navigate to edit job on onEditJob', () => {
      component.jobId.set('job777');
      component.onEditJob();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/job/edit/job777']);
    });

    it('should log error in onEditJob when jobId missing', () => {
      component.jobId.set('');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      component.onEditJob();
      expect(consoleSpy).toHaveBeenCalledOnce();
    });

    it('should navigate to research group info on onEditResearchGroup', () => {
      component.onEditResearchGroup();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/research-group/info']);
    });
  });

  describe('hasResearchGroupDescription', () => {
    it.each([
      [undefined, false],
      ['<p><br></p>', false],
      ['<p>Hello</p>', true],
    ])('description=%j -> %s', (desc, expected) => {
      component.jobDetails.set({ researchGroupDescription: desc } as JobDetails);
      expect(component.hasResearchGroupDescription()).toBe(expected);
    });
  });

  it('should call trimWebsiteUrl util', () => {
    expect(component.trimWebsiteUrl('https://example.com')).toBe('example.com');
  });

  describe('Job state operations', () => {
    it('should close job successfully', async () => {
      jobApi.changeJobState.mockReturnValue(of({}));
      await component.onCloseJob();
      expect(jobApi.changeJobState).toHaveBeenCalledWith('job123', JobDetailDTOStateEnum.Closed);
      expect(mockToastService.showSuccess).toHaveBeenCalledOnce();
      expect(location.back).toHaveBeenCalledOnce();
    });

    it('should toast error on close job failure', async () => {
      jobApi.changeJobState.mockReturnValue(throwError(() => new Error('fail')));
      await component.onCloseJob();
      expect(mockToastService.showError).toHaveBeenCalledOnce();
    });

    it('should delete job successfully', async () => {
      jobApi.deleteJob.mockReturnValue(of({}));
      await component.onDeleteJob();
      expect(jobApi.deleteJob).toHaveBeenCalledWith('job123');
      expect(mockToastService.showSuccess).toHaveBeenCalledOnce();
    });

    it('should toast error on delete failure', async () => {
      jobApi.deleteJob.mockReturnValue(throwError(() => new Error('boom')));
      await component.onDeleteJob();
      expect(mockToastService.showError).toHaveBeenCalledOnce();
    });
  });

  describe('init', () => {
    it('should load job details', async () => {
      jobApi.getJobDetails.mockReturnValue(
        of({
          title: 'JobTitle',
          state: JobDetailDTOStateEnum.Draft,
          supervisingProfessorName: 'ProfX',
          researchGroup: { name: 'RG', researchGroupId: 'rg1' },
          createdAt: new Date().toISOString(),
          lastModifiedAt: new Date().toISOString(),
        } as JobDetailDTO),
      );

      await component.init();
      expect(jobApi.getJobDetails).toHaveBeenCalledWith('job123');
      expect(component.dataLoaded()).toBe(true);
    });

    it('should toast error and navigate back on init failure', async () => {
      jobApi.getJobDetails.mockReturnValue(throwError(() => new Error('fail')));
      await component.init();
      expect(mockToastService.showError).toHaveBeenCalledOnce();
      expect(location.back).toHaveBeenCalledOnce();
    });

    it('should handle HttpErrorResponse with status detail', async () => {
      jobApi.getJobDetails.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' })));
      await component.init();
      expect(mockToastService.showError).toHaveBeenCalledWith({ detail: expect.stringContaining('500') });
    });

    it('should fall back to empty strings when user.id and job_id missing', async () => {
      const accountServiceNoId = createAccountServiceMock();
      accountServiceNoId.user.set({ name: 'Anon' } as User);
      const routeNoJobId = { snapshot: { paramMap: new Map([['job_id', null]]) } } as unknown as ActivatedRoute;

      await TestBed.resetTestingModule()
        .configureTestingModule({
          imports: [JobDetailComponent],
          providers: [
            { provide: Location, useValue: location },
            { provide: JobResourceApi, useValue: jobApi },
            { provide: ResearchGroupResourceApi, useValue: researchGroupApi },
            { provide: ActivatedRoute, useValue: routeNoJobId },
            provideToastServiceMock(mockToastService),
            provideRouterMock(mockRouter),
            provideAccountServiceMock(accountServiceNoId),
            provideTranslateMock(),
            provideHttpClient(),
          ],
        })
        .compileComponents();

      const fixture2 = TestBed.createComponent(JobDetailComponent);
      const comp2 = fixture2.componentInstance;
      jobApi.getJobDetails.mockReturnValue(of({ title: 'FallbackJob' } as JobDetails));
      await runSilently(() => comp2.init());
      expect(comp2['userId']()).toBe('');
      expect(comp2['jobId']()).toBe('');
    });
  });

  describe('loadJobDetailsFromForm', () => {
    it('should set jobDetails and dataLoaded', async () => {
      const form: JobFormDTO = { title: 'FormJob', jobDescriptionEN: 'Desc', jobDescriptionDE: 'Desc' } as JobFormDTO;
      await (component as unknown as JobDetailComponentInternals).loadJobDetailsFromForm(form);
      expect(component.jobDetails()).not.toBeNull();
      expect(component.dataLoaded()).toBe(true);
    });

    it('should toast error when researchGroupApi fails', async () => {
      researchGroupApi.getResourceGroupDetails.mockReturnValue(throwError(() => new Error('RG error')));
      await (component as unknown as JobDetailComponentInternals).loadJobDetailsFromForm({ title: 'FormJob' } as JobFormDTO);
      expect(mockToastService.showError).toHaveBeenCalledOnce();
    });

    it('should call getResourceGroupDetails with empty string when user has no active research group', async () => {
      mockAccountService.user.set({ id: 'u2', name: 'NoGroupUser', email: 'nogroup@test.com', memberships: [] });
      mockAccountService.activeResearchGroupId.set(undefined);
      const spy = vi.spyOn(researchGroupApi, 'getResourceGroupDetails').mockReturnValue(of({ description: 'none' }));
      await (component as unknown as JobDetailComponentInternals).loadJobDetailsFromForm({
        title: 'Form Job',
        subjectArea: JobFormDTOSubjectAreaEnum.ComputerScience,
        location: JobFormDTOLocationEnum.Garching,
        state: JobDetailDTOStateEnum.Closed,
      } as JobFormDTO);
      expect(spy).toHaveBeenCalledWith('');
    });
  });

  describe('jobStateText / jobStateColor', () => {
    it('should return mapped text and color for known state', () => {
      component.jobDetails.set({ jobState: JobDetailDTOStateEnum.Draft } as JobDetails);
      expect(component.jobStateText()).toBe('jobState.draft');
      expect(component.jobStateColor()).toBe('neutral');
    });

    it.each([
      [{ jobState: 'UNKNOWN_STATE' } as unknown as JobDetails, 'jobState.unknown', 'info'],
      [null, 'jobState.unknown', 'info'],
    ])('should return fallback for %j', (details, text, color) => {
      component.jobDetails.set(details as JobDetails | null);
      expect(component.jobStateText()).toBe(text);
      expect(component.jobStateColor()).toBe(color);
    });
  });

  describe('mapToJobDetails', () => {
    function callMap(args: MapToJobDetailsArgs): JobDetails {
      return (component as unknown as JobDetailComponentInternals).mapToJobDetails.apply(component, args);
    }

    it('should map JobDetailDTO core fields', () => {
      const dto: JobDetailDTO = {
        title: 'Mapped',
        state: JobDetailDTOStateEnum.Published,
        supervisingProfessorName: 'Prof',
        researchGroup: { name: 'RG', researchGroupId: 'rg1' },
        createdAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString(),
      } as JobDetailDTO;
      const result = callMap([dto, mockAccountService.loadedUser()]);
      expect(result.title).toBe('Mapped');
      expect(result.jobState).toBe(JobDetailDTOStateEnum.Published);
    });

    it('should fall back to empty strings for missing fields', () => {
      const result = callMap([
        {
          jobId: 'j1',
          title: 'X',
          state: undefined,
          supervisingProfessorName: undefined,
          researchGroup: { name: undefined, researchGroupId: 'rgX' },
          createdAt: '',
          lastModifiedAt: '',
        } as unknown as JobDetailDTO,
        mockAccountService.loadedUser(),
      ]);
      expect(result.supervisingProfessor ?? '').toBe('');
      expect(result.researchGroup ?? '').toBe('');
      expect(result.workload ?? '').toBe('');
      expect(result.contractDuration ?? '').toBe('');
    });

    it('should override researchGroup fields from researchGroupDetails in form mode', () => {
      const result = callMap([{ title: 'Test' } as JobFormDTO, undefined, { email: 'x@test.de', street: 'Main St', city: 'X' }, true]);
      expect(result.researchGroupEmail).toBe('x@test.de');
      expect(result.researchGroupStreet).toBe('Main St');
      expect(result.researchGroupCity).toBe('X');
    });

    it('should convert workload and contractDuration to strings', () => {
      const dto: JobDetailDTO = {
        jobId: 'j1',
        title: '',
        state: JobDetailDTOStateEnum.Draft,
        researchGroup: { name: 'RG1', researchGroupId: 'rg1' },
        createdAt: '',
        lastModifiedAt: '',
        workload: 15 as unknown as number,
        contractDuration: 9 as unknown as number,
        subjectArea: JobFormDTOSubjectAreaEnum.ComputerScience,
      } as JobDetailDTO;
      const result = callMap([dto, mockAccountService.loadedUser()]);
      expect(result.workload).toBe('15');
      expect(result.contractDuration).toBe('9');
    });

    it('should set belongsToResearchGroup true when user and job share group id', () => {
      const user = { id: 'u1', name: 'Researcher', memberships: [{ researchGroupId: 'rgX', name: 'RGX' }] };
      mockAccountService.user.set(user as User);
      mockAccountService.activeResearchGroupId.set('rgX');
      const dto: JobDetailDTO = {
        title: 'RG Job',
        state: JobDetailDTOStateEnum.Published,
        supervisingProfessorName: 'ProfX',
        researchGroup: { name: 'RGX', researchGroupId: 'rgX' },
        createdAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString(),
      } as JobDetailDTO;
      expect(callMap([dto, user as User]).belongsToResearchGroup).toBe(true);
    });
  });

  describe('primaryActionButton', () => {
    type PrimaryActionSpyKey = 'onApply' | 'onEditApplication' | 'onViewApplication' | 'onEditJob';
    it.each<{ name: string; details: JobDetails; spy: PrimaryActionSpyKey }>([
      {
        name: 'apply when not in research group and no application',
        details: { belongsToResearchGroup: false, applicationState: undefined } as JobDetails,
        spy: 'onApply',
      },
      {
        name: 'edit application when application is SAVED',
        details: { belongsToResearchGroup: false, applicationState: ApplicationForApplicantDTOApplicationStateEnum.Saved } as JobDetails,
        spy: 'onEditApplication',
      },
      {
        name: 'view application when application is SENT',
        details: { belongsToResearchGroup: false, applicationState: ApplicationForApplicantDTOApplicationStateEnum.Sent } as JobDetails,
        spy: 'onViewApplication',
      },
      {
        name: 'edit job for DRAFT belonging to research group',
        details: { belongsToResearchGroup: true, jobState: JobDetailDTOStateEnum.Draft } as JobDetails,
        spy: 'onEditJob',
      },
    ])('should trigger $spy on click for: $name', ({ details, spy }) => {
      component.jobDetails.set(details);
      const onClickSpy = vi.spyOn(component, spy);
      const btn = component.primaryActionButton();
      btn?.onClick();
      expect(onClickSpy).toHaveBeenCalledOnce();
    });

    it('should set showCloseDialog true for PUBLISHED owned job', () => {
      vi.spyOn(component, 'isProfessorOrEmployee').mockReturnValue(true);
      component.jobDetails.set({ belongsToResearchGroup: true, jobState: JobDetailDTOStateEnum.Published } as JobDetails);
      component.primaryActionButton()?.onClick();
      expect(component.showCloseDialog()).toBe(true);
    });

    it.each([
      ['PUBLISHED but not owner', { belongsToResearchGroup: false, jobState: JobDetailDTOStateEnum.Published } as JobDetails, true],
      ['CLOSED owned job', { belongsToResearchGroup: true, jobState: JobDetailDTOStateEnum.Closed } as JobDetails, false],
      ['no jobDetails', null, false],
    ])('should return null for %s', (_name, details, isProfOwner) => {
      if (isProfOwner) vi.spyOn(component, 'isProfessorOrEmployee').mockReturnValue(true);
      component.jobDetails.set(details as JobDetails | null);
      expect(component.primaryActionButton()).toBeNull();
    });

    it('should return null when previewData exists', () => {
      const previewSignal = signal({ title: 'Preview job' } as JobFormDTO);
      (component as unknown as { previewData: () => typeof previewSignal }).previewData = () => previewSignal;
      expect(component.primaryActionButton()).toBeNull();
    });
  });

  describe('isOwnerOfJob', () => {
    it.each([
      ['user missing', () => mockAccountService.user.set(null as unknown as User), { belongsToResearchGroup: true } as JobDetails],
      [
        'not professor',
        () => vi.spyOn(component, 'isProfessorOrEmployee').mockReturnValue(false),
        { belongsToResearchGroup: true } as JobDetails,
      ],
      [
        'job not in research group',
        () => vi.spyOn(component, 'isProfessorOrEmployee').mockReturnValue(true),
        { belongsToResearchGroup: false } as JobDetails,
      ],
    ])('should return false when %s', (_label, setup, job) => {
      setup();
      expect((component as unknown as JobDetailComponentInternals).isOwnerOfJob(job)).toBe(false);
    });
  });

  describe('menu items', () => {
    it('should set showDeleteDialog true via DRAFT delete menu command', () => {
      component.jobDetails.set({ belongsToResearchGroup: true, jobState: JobDetailDTOStateEnum.Draft } as JobDetails);
      const deleteItem = component.menuItems().find((item: JhiMenuItem) => item.label === component.deleteButtonLabel);
      deleteItem?.command?.();
      expect(component.showDeleteDialog()).toBe(true);
    });

    it('should call onDownloadPDF when pdfButton command is invoked', () => {
      const spy = vi.spyOn(component, 'onDownloadPDF').mockResolvedValue();
      fixture.componentRef.setInput('previewData', undefined);
      component.jobDetails.set({ jobState: JobDetailDTOStateEnum.Published, belongsToResearchGroup: false } as JobDetails);
      const pdfItem = component.menuItems().find(item => item.label === 'button.downloadPDF');
      pdfItem!.command?.();
      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe('jobDescriptionForCurrentLang', () => {
    it.each([
      ['en', { jobDescriptionEN: '<p>English</p>', jobDescriptionDE: '<p>Deutsch</p>' }, '<p>English</p>'],
      ['de', { jobDescriptionEN: '<p>English</p>', jobDescriptionDE: '<p>Deutsch</p>' }, '<p>Deutsch</p>'],
      ['en', { jobDescriptionEN: '   ', jobDescriptionDE: '<p>Deutsch Fallback</p>' }, '<p>Deutsch Fallback</p>'],
    ])('lang=%s -> %s', (lang, job, expected) => {
      translate.use(lang);
      component.jobDetails.set(job as JobDetails);
      expect(component.jobDescriptionForCurrentLang()).toBe(expected);
    });

    it('should return empty string when jobDetails is null/undefined', () => {
      component.jobDetails.set(null);
      expect(component.jobDescriptionForCurrentLang()).toBe('');
      (component.jobDetails as unknown as { set(value: undefined): void }).set(undefined);
      expect(component.jobDescriptionForCurrentLang()).toBe('');
    });
  });

  it('should compute noData() via translate.instant', () => {
    const spy = vi.spyOn(translate, 'instant').mockReturnValue('No data');
    translate.use('de');
    expect(component.noData()).toBe('No data');
    expect(spy).toHaveBeenCalledWith('jobDetailPage.noData');
  });

  it('should call loadJobDetailsFromForm when previewData is provided', async () => {
    const previewJob: JobFormDTO = { title: 'PreviewJob' } as JobFormDTO;
    const fixture2 = TestBed.createComponent(JobDetailComponent);
    const comp2 = fixture2.componentInstance;
    const loadSpy = vi.spyOn(comp2 as unknown as JobDetailComponentInternals, 'loadJobDetailsFromForm').mockResolvedValue();
    fixture2.componentRef.setInput('previewData', signal(previewJob));
    fixture2.detectChanges();
    await Promise.resolve();
    expect(loadSpy).toHaveBeenCalledWith(previewJob);
  });

  describe('PDF Download', () => {
    function makePdfResponse(disposition: string | null) {
      return {
        headers: { get: vi.fn().mockReturnValue(disposition) },
        body: new Blob(['pdf content'], { type: 'application/pdf' }),
      };
    }

    it('should download PDF for normal job', async () => {
      pdfExportApi.exportJobToPDF.mockReturnValue(of(makePdfResponse('attachment; filename="test.pdf"')));
      component.jobId.set('job123');
      await component.onDownloadPDF();
      expect(pdfExportApi.exportJobToPDF).toHaveBeenCalledWith('job123', expect.any(Object));
    });

    it('should download PDF for preview job', async () => {
      pdfExportApi.exportJobPreviewToPDF.mockReturnValue(of(makePdfResponse('attachment; filename="preview.pdf"')));
      fixture.componentRef.setInput('previewData', signal({ title: 'Preview', supervisingProfessor: 'u1' } as JobFormDTO));
      await component.onDownloadPDF();
      expect(pdfExportApi.exportJobPreviewToPDF).toHaveBeenCalledOnce();
    });

    it.each([
      ['preview formData missing', () => fixture.componentRef.setInput('previewData', signal(undefined))],
      [
        'preview PDF generation throws',
        () => {
          pdfExportApi.exportJobPreviewToPDF.mockReturnValue(throwError(() => new Error('PDF error')));
          fixture.componentRef.setInput('previewData', signal({ title: 'Preview', supervisingProfessor: 'u1' } as JobFormDTO));
        },
      ],
      [
        'normal PDF generation throws',
        () => {
          pdfExportApi.exportJobToPDF.mockReturnValue(throwError(() => new Error('PDF error')));
          component.jobId.set('job123');
        },
      ],
    ])('should toast error when %s', async (_label, setup) => {
      setup();
      await component.onDownloadPDF();
      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('pdf.couldNotGeneratePdf');
    });

    it.each([
      ['Content-Disposition missing', null],
      ['Content-Disposition does not match regex', 'attachment; badformat'],
    ])('should still call API when %s', async (_label, disposition) => {
      pdfExportApi.exportJobToPDF.mockReturnValue(of(makePdfResponse(disposition)));
      component.jobId.set('job123');
      await component.onDownloadPDF();
      expect(pdfExportApi.exportJobToPDF).toHaveBeenCalledOnce();
    });
  });
});
