import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import ApplicationDetailForApplicantComponent from 'app/application/application-detail-for-applicant/application-detail-for-applicant.component';
import { createActivatedRouteMock, provideActivatedRouteMock } from 'util/activated-route.mock';
import { TranslateService } from '@ngx-translate/core';
import { createTranslateServiceMock, TranslateServiceMock, provideTranslateMock } from 'util/translate.mock';
import { createToastServiceMock, ToastServiceMock, provideToastServiceMock } from 'util/toast-service.mock';
import { createRouterMock, RouterMock, provideRouterMock } from 'util/router.mock';
import { createLocationMock, LocationMock, provideLocationMock } from 'util/location.mock';
import {
  createApplicationResourceApiMock,
  ApplicationResourceApiMock,
  provideApplicationResourceApiMock,
} from 'util/application-resource-api.service.mock';
import { getApplicationPDFLabels } from 'app/shared/language/pdf-labels';
import { ApplicationDetailDTO, ApplicationDetailDTOApplicationStateEnum } from 'app/generated/model/application-detail-dto';
import { ApplicationDocumentIdsDTO } from 'app/generated/model/application-document-ids-dto';
import { createPdfExportResourceApiMock, providePdfExportResourceApiMock } from 'util/pdf-export-resource-api.service.mock';
import { ReferenceRequestDTO } from 'app/generated/model/reference-request-dto';

function setupTest(paramId: string | null, appApiOverrides?: Partial<ApplicationResourceApiMock>) {
  const applicationApi: ApplicationResourceApiMock = Object.assign({}, createApplicationResourceApiMock(), appApiOverrides ?? {});

  const routeMock = createActivatedRouteMock(paramId ? { application_id: paramId } : {});
  const translate: TranslateServiceMock = createTranslateServiceMock();
  const pdfExportApi = createPdfExportResourceApiMock();
  const toast: ToastServiceMock = createToastServiceMock();
  const router: RouterMock = createRouterMock();
  const location: LocationMock = createLocationMock();

  TestBed.configureTestingModule({
    providers: [
      provideActivatedRouteMock(routeMock),
      provideApplicationResourceApiMock(applicationApi),
      providePdfExportResourceApiMock(pdfExportApi),
      provideTranslateMock(translate),
      provideToastServiceMock(toast),
      provideRouterMock(router),
      provideLocationMock(location),
    ],
    imports: [ApplicationDetailForApplicantComponent],
  });

  const fixture = TestBed.createComponent(ApplicationDetailForApplicantComponent);
  const component = fixture.componentInstance;
  return { component, applicationApi, pdfExportApi, translate, toast, router, location, routeMock };
}

const DEFAULT_APPLICATION_DETAIL: ApplicationDetailDTO = {
  applicationId: 'APP1',
  applicationState: ApplicationDetailDTOApplicationStateEnum.Sent,
  jobId: 'JOB123',
  researchGroup: '',
  supervisingProfessorName: '',
} as ApplicationDetailDTO;

function makeDetail(overrides: Partial<ApplicationDetailDTO> = {}): ApplicationDetailDTO {
  return Object.assign({}, DEFAULT_APPLICATION_DETAIL, overrides) as ApplicationDetailDTO;
}

describe('ApplicationDetailForApplicantComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('init', () => {
    it('should initialize and store application and document IDs on success', async () => {
      const appData = makeDetail({ applicationId: 'APP1', jobId: 'JOB123' });
      const docIds: ApplicationDocumentIdsDTO = { transcriptId: 'D1' } as ApplicationDocumentIdsDTO;
      const { component, applicationApi, toast } = setupTest('APP1', {
        getApplicationForDetailPage: vi.fn(() => of(appData)),
        getDocumentIds: vi.fn(() => of(docIds)),
      });
      await component.init();
      expect(component.applicationId()).toBe('APP1');
      expect(component.application()).toEqual(appData);
      expect(component.documentIds()).toEqual(docIds);
      expect(applicationApi.getApplicationForDetailPage).toHaveBeenCalledWith('APP1');
      expect(applicationApi.getDocumentIds).toHaveBeenCalledWith('APP1');
      expect(toast.showErrorKey).not.toHaveBeenCalled();
    });

    it('should show error when application id missing', async () => {
      const { component, toast } = setupTest(null, {
        getApplicationForDetailPage: vi.fn(() => of(makeDetail())),
        getDocumentIds: vi.fn(() => of({} as ApplicationDocumentIdsDTO)),
      });
      await component.init();
      expect(toast.showErrorKey).toHaveBeenCalledWith('entity.toast.applyFlow.invalidApplicationId');
    });

    it('should handle application fetch error', async () => {
      const { component, toast, applicationApi } = setupTest('APP2', {
        getApplicationForDetailPage: vi.fn(() => throwError(() => new Error('fail'))),
        getDocumentIds: vi.fn(() => of({} as ApplicationDocumentIdsDTO)),
      });
      await component.init();
      expect(toast.showErrorKey).toHaveBeenCalledWith('entity.toast.applyFlow.fetchApplicationFailed');
      expect(applicationApi.getDocumentIds).toHaveBeenCalledTimes(2);
    });

    it('should handle document ID fetch error', async () => {
      const { component, toast } = setupTest('APP3', {
        getApplicationForDetailPage: vi.fn(() => of(makeDetail({ applicationId: 'APP3' }))),
        getDocumentIds: vi.fn(() => throwError(() => new Error('fail'))),
      });
      await component.init();
      expect(toast.showErrorKey).toHaveBeenCalledWith('entity.toast.applyFlow.fetchDocumentIdsFailed');
    });
  });

  describe('onViewJobDetails', () => {
    it.each([
      ['JOBX', true, ['/job/detail', 'JOBX'], false],
      ['', false, null, true],
    ])('should navigate=%s when jobId=%j', (jobId, shouldNavigate, expectedNav, shouldToast) => {
      const { component, router, toast } = setupTest('APP', {
        getApplicationForDetailPage: vi.fn(() => of(makeDetail({ applicationId: 'APP', jobId }))),
        getDocumentIds: vi.fn(() => of({} as ApplicationDocumentIdsDTO)),
      });
      component.applicationId.set('APP');
      component.actualDetailData.set({ jobId, applicationId: 'APP' } as ApplicationDetailDTO);
      component.actualDetailDataExists.set(true);
      component.onViewJobDetails();

      if (shouldNavigate) {
        expect(router.navigate).toHaveBeenCalledWith(expectedNav);
      } else {
        expect(router.navigate).not.toHaveBeenCalled();
      }
      if (shouldToast) {
        expect(toast.showErrorKey).toHaveBeenCalledWith('entity.toast.applyFlow.jobIdNotAvailable');
      }
    });
  });

  describe('onDeleteApplication', () => {
    it('should delete successfully and navigate', () => {
      const { component, applicationApi, toast, router } = setupTest('APP6', {
        getApplicationForDetailPage: vi.fn(() => of(makeDetail({ applicationId: 'APP6' }))),
        getDocumentIds: vi.fn(() => of({} as ApplicationDocumentIdsDTO)),
        deleteApplication: vi.fn(() => of(void 0)),
      });
      component.applicationId.set('APP6');
      component.onDeleteApplication();
      expect(applicationApi.deleteApplication).toHaveBeenCalledWith('APP6');
      expect(toast.showSuccessKey).toHaveBeenCalledWith('entity.toast.applyFlow.applicationDeleted');
      expect(router.navigate).toHaveBeenCalledWith(['/application/overview']);
    });

    it('should toast error on delete failure', () => {
      const { component, toast } = setupTest('APP7', {
        getApplicationForDetailPage: vi.fn(() => of(makeDetail({ applicationId: 'APP7' }))),
        getDocumentIds: vi.fn(() => of({} as ApplicationDocumentIdsDTO)),
        deleteApplication: vi.fn(() => throwError(() => new Error('fail'))),
      });
      component.applicationId.set('APP7');
      component.onDeleteApplication();
      expect(toast.showErrorKey).toHaveBeenCalledWith('entity.toast.applyFlow.errorDeletingApplication');
    });
  });

  describe('onWithdrawApplication', () => {
    it('should withdraw successfully and re-init', () => {
      const { component, applicationApi, toast } = setupTest('APP8', {
        getApplicationForDetailPage: vi.fn(() => of(makeDetail({ applicationId: 'APP8' }))),
        getDocumentIds: vi.fn(() => of({} as ApplicationDocumentIdsDTO)),
        withdrawApplication: vi.fn(() => of(void 0)),
      });
      component.applicationId.set('APP8');
      const initSpy = vi.spyOn(component, 'init');
      component.onWithdrawApplication();
      expect(applicationApi.withdrawApplication).toHaveBeenCalledWith('APP8');
      expect(toast.showSuccessKey).toHaveBeenCalledWith('entity.toast.applyFlow.applicationWithdrawn');
      expect(initSpy).toHaveBeenCalledOnce();
    });

    it('should toast error on withdraw failure', () => {
      const { component, toast } = setupTest('APP9', {
        getApplicationForDetailPage: vi.fn(() => of(makeDetail({ applicationId: 'APP9' }))),
        getDocumentIds: vi.fn(() => of({} as ApplicationDocumentIdsDTO)),
        withdrawApplication: vi.fn(() => throwError(() => new Error('fail'))),
      });
      component.applicationId.set('APP9');
      component.onWithdrawApplication();
      expect(toast.showErrorKey).toHaveBeenCalledWith('entity.toast.applyFlow.errorWithdrawingApplication');
    });
  });

  describe('onDownloadPDF', () => {
    function setupPdf(filename: string | null) {
      const { component, pdfExportApi } = setupTest('APP10', {
        getApplicationForDetailPage: vi.fn(() => of(makeDetail({ applicationId: 'APP10' }))),
        getDocumentIds: vi.fn(() => of({} as ApplicationDocumentIdsDTO)),
      });
      component.applicationId.set('APP10');
      const anchor: { click: () => void; href: string; download: string } = { click: vi.fn(), href: '', download: '' };
      const originalCreate = document.createElement;
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
        tag === 'a' ? (anchor as unknown as HTMLElement) : originalCreate.call(document, tag),
      );
      (globalThis as unknown as { URL: typeof URL }).URL = {
        createObjectURL: vi.fn(() => 'blob:url'),
        revokeObjectURL: vi.fn(),
      } as unknown as typeof URL;

      pdfExportApi.exportApplicationToPDF.mockReturnValue(
        of({
          headers: { get: (name: string) => (name === 'Content-Disposition' && filename ? `attachment; filename="${filename}"` : null) },
          body: new Blob(['content']),
        }),
      );
      return { component, pdfExportApi, anchor };
    }

    it('should download PDF using filename from header', async () => {
      const { component, pdfExportApi, anchor } = setupPdf('app10.pdf');
      await component.onDownloadPDF();
      expect(pdfExportApi.exportApplicationToPDF).toHaveBeenCalledWith(
        expect.objectContaining({ application: expect.any(Object), labels: expect.any(Object) }),
      );
      expect(anchor.click).toHaveBeenCalledOnce();
    });

    it('should fall back to default filename when header missing', async () => {
      const { component, anchor } = setupPdf(null);
      await component.onDownloadPDF();
      expect(anchor.download).toBe('application.pdf');
    });
  });

  it('should return expected label keys from getApplicationPDFLabels', () => {
    const translate = createTranslateServiceMock();
    const labels = getApplicationPDFLabels(translate as unknown as TranslateService);
    expect(labels.application).toBe('evaluation.application');
    expect(Object.keys(labels)).toContain('grade');
  });

  describe('submittedReferenceLetters', () => {
    const submittedReference: ReferenceRequestDTO = {
      referenceRequestId: 'reference-request-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      documentId: 'reference-letter-1',
    } as ReferenceRequestDTO;
    const submittedReferenceWithoutDocument: ReferenceRequestDTO = {
      referenceRequestId: 'reference-request-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      documentId: undefined,
    } as ReferenceRequestDTO;

    it('should not expose viewer inputs when the reference has no document id', () => {
      const { component } = setupTest(null);
      component.actualDetailData.set(
        makeDetail({
          referenceLettersConfidential: true,
          references: [submittedReferenceWithoutDocument],
        }),
      );
      component.actualDetailDataExists.set(true);

      expect(component.submittedReferenceLetters()).toEqual([]);
    });

    it('should expose viewer inputs for references with document ids', () => {
      const { component } = setupTest(null);
      component.actualDetailData.set(
        makeDetail({
          referenceLettersConfidential: true,
          references: [submittedReference],
        }),
      );
      component.actualDetailDataExists.set(true);

      expect(component.submittedReferenceLetters()).toEqual([
        {
          documentId: 'reference-letter-1',
          refereeName: 'Ada Lovelace',
          viewerInput: {
            id: 'reference-letter-1',
            name: 'Ada Lovelace',
            size: 0,
          },
        },
      ]);
    });
  });

  describe('missing references badge', () => {
    function reference(status: ReferenceRequestDTO['status']): ReferenceRequestDTO {
      return { referenceRequestId: `reference-${status}`, status } as ReferenceRequestDTO;
    }

    function seedReferences(
      component: ReturnType<typeof setupTest>['component'],
      referenceLettersRequired: number,
      references: ReferenceRequestDTO[],
    ): void {
      component.actualDetailData.set(makeDetail({ referenceLettersRequired, references }));
      component.actualDetailDataExists.set(true);
    }

    it('should count only requested and submitted referees toward the requirement', () => {
      const { component } = setupTest(null);
      seedReferences(component, 3, [
        reference('REQUESTED'),
        reference('SUBMITTED'),
        reference('ADDED'),
        reference('EXPIRED'),
        reference('DECLINED'),
      ]);

      expect(component.requestedOrSubmittedCount()).toBe(2);
    });

    it.each([
      {
        description: 'fewer are requested or submitted than required',
        required: 2,
        existing: [reference('REQUESTED')],
        expected: true,
      },
      {
        description: 'the requirement is met',
        required: 2,
        existing: [reference('REQUESTED'), reference('SUBMITTED')],
        expected: false,
      },
      {
        description: 'the job requires none',
        required: 0,
        existing: [],
        expected: false,
      },
    ])('should flag appropriately when $description', ({ required, existing, expected }) => {
      const { component } = setupTest(null);
      seedReferences(component, required, existing);

      expect(component.referencesMissing()).toBe(expected);
    });

    it('should refresh the count when the manage component reports a change', () => {
      const { component } = setupTest(null);
      seedReferences(component, 2, [reference('REQUESTED')]);
      expect(component.referencesMissing()).toBe(true);

      component.onReferencesChanged([reference('REQUESTED'), reference('SUBMITTED')]);

      expect(component.requestedOrSubmittedCount()).toBe(2);
      expect(component.referencesMissing()).toBe(false);
    });
  });

  describe('grade displays', () => {
    type ApplicantOverrides = {
      user: { email: string; userId: string };
      bachelorGrade?: string;
      bachelorGradeUpperLimit?: string;
      bachelorGradeLowerLimit?: string;
      masterGrade?: string;
      masterGradeUpperLimit?: string;
      masterGradeLowerLimit?: string;
    };

    it.each(['bachelor', 'master'] as const)('should return "-" for %s display when grade missing', level => {
      const { component } = setupTest(null);
      const applicantOverrides: ApplicantOverrides = { user: { email: '', userId: '1' } };
      applicantOverrides[`${level}Grade`] = undefined;
      component.actualDetailData.set(makeDetail({ applicant: applicantOverrides as ApplicationDetailDTO['applicant'] }));
      component.actualDetailDataExists.set(true);
      const result = level === 'bachelor' ? component.bachelorGradeDisplay() : component.masterGradeDisplay();
      expect(result).toBe('-');
    });

    it.each(['bachelor', 'master'] as const)('should return grade only for %s display when limits missing', level => {
      const { component } = setupTest(null);
      const applicantOverrides: ApplicantOverrides = { user: { email: '', userId: '1' } };
      applicantOverrides[`${level}Grade`] = '2.3';
      component.actualDetailData.set(makeDetail({ applicant: applicantOverrides as ApplicationDetailDTO['applicant'] }));
      component.actualDetailDataExists.set(true);
      const result = level === 'bachelor' ? component.bachelorGradeDisplay() : component.masterGradeDisplay();
      expect(result).toBe('2.3');
    });

    it.each(['bachelor', 'master'] as const)('should return grade and scale for %s display when limits present', level => {
      const { component, translate } = setupTest(null);
      const applicantOverrides: ApplicantOverrides = { user: { email: '', userId: '' } };
      applicantOverrides[`${level}Grade`] = '1.7';
      applicantOverrides[`${level}GradeUpperLimit`] = '4.0';
      applicantOverrides[`${level}GradeLowerLimit`] = '1.0';
      component.actualDetailData.set(makeDetail({ applicant: applicantOverrides as ApplicationDetailDTO['applicant'] }));
      component.actualDetailDataExists.set(true);

      const result = level === 'bachelor' ? component.bachelorGradeDisplay() : component.masterGradeDisplay();

      expect(translate.instant).toHaveBeenCalledWith('entity.applicationPage2.helperText.gradingScale', {
        upperLimit: '4.0',
        lowerLimit: '1.0',
      });
      expect(result).toBe('1.7 (entity.applicationPage2.helperText.gradingScale)');
    });
  });
});
