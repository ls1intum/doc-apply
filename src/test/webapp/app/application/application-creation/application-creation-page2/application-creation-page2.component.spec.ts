import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideTranslateMock } from 'util/translate.mock';
import ApplicationCreationPage2Component, {
  ApplicationCreationPage2Data,
  getPage2FromApplication,
} from '../../../../../../main/webapp/app/application/application-creation/application-creation-page2/application-creation-page2.component';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { DocumentInformationHolderDTO } from 'app/generated/model/document-information-holder-dto';
import { provideHttpClient as provideHttpClientMock } from '@angular/common/http';
import {
  ApplicationForApplicantDTO,
  ApplicationForApplicantDTOApplicationStateEnum,
} from 'app/generated/model/application-for-applicant-dto';
import { JobFormDTOLocationEnum, JobFormDTOSubjectAreaEnum } from 'app/generated/model/job-form-dto';
import { provideToastServiceMock } from 'util/toast-service.mock';
import { provideAccountServiceMock } from 'util/account.service.mock';
import { createDialogServiceMock, DialogServiceMock, provideDialogServiceMock } from '../../../../util/dialog.service.mock';
import { createDialogRefMock } from 'util/dialog-ref.mock';
import { firstValueFrom } from 'rxjs';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { By } from '@angular/platform-browser';
import { DegreeDocumentSectionComponent } from 'app/shared/components/molecules/degree-document-section/degree-document-section.component';

const DEFAULT_PAGE2_FORM_DATA: ApplicationCreationPage2Data = {
  bachelorDegreeName: '',
  bachelorDegreeUniversity: '',
  bachelorGrade: '',
  bachelorGradeLowerLimit: '',
  bachelorGradeUpperLimit: '',
  masterDegreeName: '',
  masterDegreeUniversity: '',
  masterGrade: '',
  masterGradeLowerLimit: '',
  masterGradeUpperLimit: '',
  noBachelorDegree: false,
  noMasterDegree: false,
  degreeStatusExplanation: '',
};

const VALID_PAGE2_FORM_DATA: ApplicationCreationPage2Data = {
  bachelorDegreeName: 'BSc',
  bachelorDegreeUniversity: 'Uni',
  bachelorGrade: '2.5',
  bachelorGradeLowerLimit: '1.0',
  bachelorGradeUpperLimit: '4.0',
  masterDegreeName: 'MSc',
  masterDegreeUniversity: 'Uni',
  masterGrade: '2.7',
  masterGradeLowerLimit: '1.0',
  masterGradeUpperLimit: '4.0',
  noBachelorDegree: false,
  noMasterDegree: false,
  degreeStatusExplanation: '',
};

function createApplicationPage2Fixture(
  inputs?: Partial<{
    data: Partial<ApplicationCreationPage2Data>;
    applicationIdForDocuments: string;
    documentIdsBachelorTranscript: DocumentInformationHolderDTO[];
    documentIdsMasterTranscript: DocumentInformationHolderDTO[];
  }>,
) {
  const fixture = TestBed.createComponent(ApplicationCreationPage2Component);
  const componentRef = fixture.componentRef;
  if (inputs) {
    if (inputs.applicationIdForDocuments !== undefined) {
      componentRef.setInput('applicationIdForDocuments', inputs.applicationIdForDocuments);
    }
    if (inputs.documentIdsBachelorTranscript !== undefined) {
      componentRef.setInput('documentIdsBachelorTranscript', inputs.documentIdsBachelorTranscript);
    }
    if (inputs.documentIdsMasterTranscript !== undefined) {
      componentRef.setInput('documentIdsMasterTranscript', inputs.documentIdsMasterTranscript);
    }
    componentRef.setInput('data', Object.assign({}, DEFAULT_PAGE2_FORM_DATA, inputs ? (inputs.data ?? {}) : {}));
  }
  fixture.detectChanges();

  return { fixture, componentRef, componentInstance: fixture.componentInstance };
}

describe('ApplicationPage2Component', () => {
  let mockDialogService: DialogServiceMock;
  beforeEach(async () => {
    mockDialogService = createDialogServiceMock();
    await TestBed.configureTestingModule({
      imports: [ApplicationCreationPage2Component],
      providers: [
        provideHttpClientMock(),
        provideRouter([]),
        provideTranslateMock(),
        provideFontAwesomeTesting(),
        provideToastServiceMock(),
        provideAccountServiceMock(),
        provideDialogServiceMock(mockDialogService),
      ],
    }).compileComponents();
  });

  it('should auto-detect grading scale when grade is set but limits missing', async () => {
    const { componentInstance, fixture } = createApplicationPage2Fixture({
      data: { bachelorGrade: '2.5', masterGrade: '3.0' },
    });
    await new Promise(resolve => setTimeout(resolve, 150));
    fixture.detectChanges();

    expect(componentInstance.bachelorGradeLimits()).not.toBeNull();
    expect(componentInstance.bachelorLimitsManuallySet()).toBe(false);
    expect(componentInstance.masterGradeLimits()).not.toBeNull();
    expect(componentInstance.masterLimitsManuallySet()).toBe(false);
  });

  describe('Form Validation', () => {
    it('should be invalid when required fields missing', () => {
      const { componentInstance } = createApplicationPage2Fixture();
      expect(componentInstance.page2Form.valid).toBe(false);
    });

    it('should be valid with correct data', () => {
      const { componentInstance } = createApplicationPage2Fixture({ data: VALID_PAGE2_FORM_DATA });
      expect(componentInstance.page2Form.valid).toBe(true);
    });
  });

  it('should not emit when form value has not changed (distinctUntilChanged)', async () => {
    const { fixture, componentInstance } = createApplicationPage2Fixture();
    componentInstance.page2Form.patchValue({ bachelorDegreeName: 'BSc', bachelorDegreeUniversity: 'Uni' });
    await new Promise(resolve => setTimeout(resolve, 100));
    fixture.detectChanges();

    const changedSpy = vi.fn();
    componentInstance.changed.subscribe(changedSpy);

    componentInstance.page2Form.patchValue({ bachelorDegreeName: 'BSc', bachelorDegreeUniversity: 'Uni' });
    await new Promise(resolve => setTimeout(resolve, 150));
    fixture.detectChanges();

    expect(changedSpy).not.toHaveBeenCalled();
  });

  it('should still propagate extracted degree values into data while the section is mid-extraction', async () => {
    const { fixture, componentInstance } = createApplicationPage2Fixture({
      applicationIdForDocuments: '12345',
      data: DEFAULT_PAGE2_FORM_DATA,
    });
    await new Promise(resolve => setTimeout(resolve, 150));
    fixture.detectChanges();

    const section = fixture.debugElement.query(By.directive(DegreeDocumentSectionComponent))
      .componentInstance as DegreeDocumentSectionComponent;
    section.isAiExtracting.set(true);
    fixture.detectChanges();

    componentInstance.onAiDataExtracted({ education: { bachelorDegreeName: 'BSc Repro', masterDegreeName: 'MSc Repro' } });
    await new Promise(resolve => setTimeout(resolve, 150));
    fixture.detectChanges();

    expect(componentInstance.data()?.bachelorDegreeName).toBe('BSc Repro');
    expect(componentInstance.data()?.masterDegreeName).toBe('MSc Repro');
  });

  it('should show warning text when grade is unusual', async () => {
    const { componentInstance, fixture } = createApplicationPage2Fixture();
    await new Promise(resolve => setTimeout(resolve, 150));
    fixture.detectChanges();

    componentInstance.page2Form.controls.bachelorGrade.setValue('#');
    componentInstance.page2Form.controls.masterGrade.setValue('#');
    await new Promise(resolve => setTimeout(resolve, 600));
    fixture.detectChanges();

    expect(componentInstance.warningTextBachelorGrade()).not.toBe('');
    expect(componentInstance.warningTextMasterGrade()).not.toBe('');
  });

  it('should render upload buttons when applicationIdForDocuments set', () => {
    const { fixture } = createApplicationPage2Fixture({
      applicationIdForDocuments: '12345',
      documentIdsBachelorTranscript: [{ id: 'id-1', size: 1 }],
      documentIdsMasterTranscript: [{ id: 'id-2', size: 2 }],
      data: DEFAULT_PAGE2_FORM_DATA,
    });
    expect(fixture.nativeElement.querySelectorAll('jhi-upload-button').length).toBe(2);
  });

  describe('Document Validation', () => {
    it.each([
      { type: 'bachelor', expected: true, value: [{ id: '1', size: 1 }] },
      { type: 'bachelor', expected: false, value: undefined },
      { type: 'bachelor', expected: false, value: [] },
      { type: 'master', expected: true, value: [{ id: '2', size: 2 }] },
      { type: 'master', expected: false, value: undefined },
      { type: 'master', expected: false, value: [] },
    ])('$type docs valid=$expected when value=$value', ({ type, expected, value }) => {
      const { componentInstance, fixture } = createApplicationPage2Fixture();
      if (type === 'bachelor') {
        componentInstance.documentIdsBachelorTranscript.set(value as DocumentInformationHolderDTO[]);
        fixture.detectChanges();
        expect(componentInstance.bachelorDocsValid()).toBe(expected);
      } else {
        componentInstance.documentIdsMasterTranscript.set(value as DocumentInformationHolderDTO[]);
        fixture.detectChanges();
        expect(componentInstance.masterDocsValid()).toBe(expected);
      }
    });

    it.each([
      { expected: true, bachelorDocs: [{ id: 'b-1', size: 1 }], masterDocs: [{ id: 'm-1', size: 1 }] },
      { expected: false, bachelorDocs: [], masterDocs: [] },
    ])('emits valid=$expected when transcripts present=$expected', async ({ expected, bachelorDocs, masterDocs }) => {
      const { componentInstance, fixture } = createApplicationPage2Fixture({
        data: VALID_PAGE2_FORM_DATA,
        documentIdsBachelorTranscript: bachelorDocs,
        documentIdsMasterTranscript: masterDocs,
      });

      const validPromise = firstValueFrom(outputToObservable(componentInstance.valid));
      fixture.detectChanges();
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(await validPromise).toBe(expected);
    });
  });

  describe('Degree status', () => {
    const waitForFormUpdate = async (fixture: { detectChanges: () => void }): Promise<void> => {
      fixture.detectChanges();
      await new Promise(resolve => setTimeout(resolve, 150));
      fixture.detectChanges();
    };

    it('should disable a ticked degree, keep its values and ask for the explanation instead', async () => {
      const { componentInstance, fixture } = createApplicationPage2Fixture({
        data: VALID_PAGE2_FORM_DATA,
        documentIdsBachelorTranscript: [{ id: 'b-1', size: 1 }],
      });
      const missingFields: string[][] = [];
      componentInstance.missingFields.subscribe(fields => missingFields.push(fields));

      componentInstance.page2Form.controls.noMasterDegree.setValue(true);
      await waitForFormUpdate(fixture);

      const controls = componentInstance.page2Form.controls;
      expect(controls.masterDegreeName.disabled).toBe(true);
      expect(controls.masterDegreeUniversity.disabled).toBe(true);
      expect(controls.masterGrade.disabled).toBe(true);
      expect(controls.bachelorDegreeName.enabled).toBe(true);
      expect(componentInstance.page2Form.getRawValue().masterDegreeName).toBe('MSc');
      expect(componentInstance.masterDocsValid()).toBe(true);
      expect(missingFields.at(-1)).toEqual(['entity.detail_card.degreeStatusExplanation']);
      expect(fixture.nativeElement.querySelector('jhi-text-area')).not.toBeNull();
    });

    it.each([
      { label: 'no', explanation: '', expected: false },
      { label: 'a too long', explanation: 'a'.repeat(1001), expected: false },
      { label: 'an', explanation: 'Writing my Master thesis', expected: true },
    ])('should emit valid=$expected for a ticked degree with $label explanation', async ({ explanation, expected }) => {
      const { componentInstance, fixture } = createApplicationPage2Fixture({
        data: VALID_PAGE2_FORM_DATA,
        documentIdsBachelorTranscript: [{ id: 'b-1', size: 1 }],
      });
      const validValues: boolean[] = [];
      componentInstance.valid.subscribe(valid => validValues.push(valid));

      componentInstance.page2Form.controls.noMasterDegree.setValue(true);
      await waitForFormUpdate(fixture);
      componentInstance.page2Form.controls.degreeStatusExplanation.setValue(explanation);
      await waitForFormUpdate(fixture);

      expect(validValues.at(-1)).toBe(expected);
      expect(componentInstance.data()?.degreeStatusExplanation).toBe(explanation);
    });

    it('should make the degree required again and drop the explanation from the check when the box is unticked', async () => {
      const { componentInstance, fixture } = createApplicationPage2Fixture({
        data: Object.assign({}, VALID_PAGE2_FORM_DATA, { noBachelorDegree: true }),
        documentIdsMasterTranscript: [{ id: 'm-1', size: 1 }],
      });
      await waitForFormUpdate(fixture);
      expect(componentInstance.page2Form.controls.bachelorDegreeName.disabled).toBe(true);

      const missingFields: string[][] = [];
      componentInstance.missingFields.subscribe(fields => missingFields.push(fields));
      componentInstance.page2Form.controls.noBachelorDegree.setValue(false);
      await waitForFormUpdate(fixture);

      expect(componentInstance.page2Form.controls.bachelorDegreeName.enabled).toBe(true);
      expect(componentInstance.page2Form.controls.degreeStatusExplanation.disabled).toBe(true);
      expect(missingFields.at(-1)).toEqual(['entity.applicationPage2.label.bachelorCertificate']);
    });

    it('should not fill a ticked degree from the certificate extraction', async () => {
      const { componentInstance, fixture } = createApplicationPage2Fixture({ data: DEFAULT_PAGE2_FORM_DATA });
      componentInstance.page2Form.controls.noBachelorDegree.setValue(true);
      await waitForFormUpdate(fixture);

      componentInstance.onAiDataExtracted({ education: { bachelorDegreeName: 'BSc Physics', masterDegreeName: 'MSc Physics' } });

      expect(componentInstance.page2Form.getRawValue().bachelorDegreeName).toBe('');
      expect(componentInstance.page2Form.getRawValue().masterDegreeName).toBe('MSc Physics');
    });
  });

  describe('getPage2FromApplication', () => {
    const application: ApplicationForApplicantDTO = {
      applicant: {
        bachelorDegreeName: 'BSc CS',
        bachelorUniversity: 'Test University',
        bachelorGradeUpperLimit: '4.0',
        bachelorGradeLowerLimit: '1.0',
        bachelorGrade: '3.5',
        masterDegreeName: 'MSc AI',
        masterUniversity: 'Test University',
        masterGradeUpperLimit: '4.0',
        masterGradeLowerLimit: '1.0',
        masterGrade: '3.8',
        noMasterDegree: true,
        degreeStatusExplanation: 'Writing my Master thesis',
        user: {},
      },
      job: {
        jobId: 'id-123',
        location: JobFormDTOLocationEnum.Garching,
        professorName: 'Pr. Test',
        title: 'Job title',
        subjectArea: JobFormDTOSubjectAreaEnum.ComputerScience,
      },
      applicationState: ApplicationForApplicantDTOApplicationStateEnum.Saved,
    };

    it('should map all applicant fields when present', () => {
      expect(getPage2FromApplication(application)).toEqual({
        bachelorDegreeName: 'BSc CS',
        bachelorDegreeUniversity: 'Test University',
        bachelorGradeUpperLimit: '4.0',
        bachelorGradeLowerLimit: '1.0',
        bachelorGrade: '3.5',
        masterDegreeName: 'MSc AI',
        masterDegreeUniversity: 'Test University',
        masterGradeUpperLimit: '4.0',
        masterGradeLowerLimit: '1.0',
        masterGrade: '3.8',
        noBachelorDegree: false,
        noMasterDegree: true,
        degreeStatusExplanation: 'Writing my Master thesis',
      });
    });

    it('should return defaults when applicant is undefined', () => {
      expect(getPage2FromApplication(Object.assign({}, application, { applicant: undefined }))).toEqual(DEFAULT_PAGE2_FORM_DATA);
    });

    it('should fill missing applicant fields with empty strings', () => {
      expect(
        getPage2FromApplication(Object.assign({}, application, { applicant: { bachelorDegreeName: 'BSc Biology', user: {} } })),
      ).toEqual(Object.assign({}, DEFAULT_PAGE2_FORM_DATA, { bachelorDegreeName: 'BSc Biology' }));
    });
  });

  describe('onChangeGradingScale', () => {
    it.each(['bachelor', 'master'] as const)('should open dialog with correct data for %s', async gradeType => {
      const { componentInstance, fixture } = createApplicationPage2Fixture({ data: VALID_PAGE2_FORM_DATA });
      await new Promise(resolve => setTimeout(resolve, 150));
      fixture.detectChanges();

      const dialogRef = createDialogRefMock();
      mockDialogService.open.mockReturnValue(dialogRef);

      componentInstance.onChangeGradingScale(gradeType);

      const expectedData =
        gradeType === 'bachelor'
          ? {
              currentGrade: VALID_PAGE2_FORM_DATA.bachelorGrade,
              currentUpperLimit: VALID_PAGE2_FORM_DATA.bachelorGradeUpperLimit,
              currentLowerLimit: VALID_PAGE2_FORM_DATA.bachelorGradeLowerLimit,
            }
          : {
              currentGrade: VALID_PAGE2_FORM_DATA.masterGrade,
              currentUpperLimit: VALID_PAGE2_FORM_DATA.masterGradeUpperLimit,
              currentLowerLimit: VALID_PAGE2_FORM_DATA.masterGradeLowerLimit,
            };

      expect(mockDialogService.open).toHaveBeenCalledOnce();
      expect(mockDialogService.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: expect.objectContaining(expectedData) }),
      );
    });

    it.each(['bachelor', 'master'] as const)('should update %s limits and set manuallySet flag on dialog result', async gradeType => {
      const { componentInstance, fixture } = createApplicationPage2Fixture();
      fixture.detectChanges();

      const dialogRef = createDialogRefMock();
      mockDialogService.open.mockReturnValue(dialogRef);

      const pending = componentInstance.onChangeGradingScale(gradeType);
      dialogRef.closed.next({ upperLimit: '5.0', lowerLimit: '1.0' });
      await pending;
      fixture.detectChanges();

      const upperKey = `${gradeType}GradeUpperLimit`;
      const lowerKey = `${gradeType}GradeLowerLimit`;
      const limitsKey: 'bachelorGradeLimits' | 'masterGradeLimits' = gradeType === 'bachelor' ? 'bachelorGradeLimits' : 'masterGradeLimits';
      const manuallyKey: 'bachelorLimitsManuallySet' | 'masterLimitsManuallySet' =
        gradeType === 'bachelor' ? 'bachelorLimitsManuallySet' : 'masterLimitsManuallySet';
      expect(componentInstance.page2Form.get(upperKey)?.value).toBe('5.0');
      expect(componentInstance.page2Form.get(lowerKey)?.value).toBe('1.0');
      expect(componentInstance[limitsKey]()).toEqual({ upperLimit: '5.0', lowerLimit: '1.0' });
      expect(componentInstance[manuallyKey]()).toBe(true);
    });

    it('should not update limits when dialog closes without result', async () => {
      const { componentInstance, fixture } = createApplicationPage2Fixture({ data: { bachelorGrade: '2.5' } });
      await new Promise(resolve => setTimeout(resolve, 150));
      fixture.detectChanges();

      const dialogRef = createDialogRefMock();
      mockDialogService.open.mockReturnValue(dialogRef);

      componentInstance.onChangeGradingScale('bachelor');
      const limitsBefore = componentInstance.bachelorGradeLimits();

      dialogRef.closed.next(undefined);
      fixture.detectChanges();

      expect(componentInstance.bachelorGradeLimits()).toEqual(limitsBefore);
      expect(componentInstance.bachelorLimitsManuallySet()).toBe(false);
    });

    it.each(['bachelor', 'master'] as const)(
      'should fall back to empty string for %s limits when control value is null',
      async gradeType => {
        const { componentInstance, fixture } = createApplicationPage2Fixture();
        componentInstance.page2Form.controls[`${gradeType}GradeUpperLimit`].setValue(null);
        componentInstance.page2Form.controls[`${gradeType}GradeLowerLimit`].setValue(null);
        fixture.detectChanges();

        const dialogRef = createDialogRefMock();
        mockDialogService.open.mockReturnValue(dialogRef);

        componentInstance.onChangeGradingScale(gradeType);
        expect(mockDialogService.open).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.objectContaining({ currentUpperLimit: '', currentLowerLimit: '' }),
          }),
        );
      },
    );
  });

  describe('initializeFormEffect — limit back-fill from AI-extracted grades', () => {
    it('populates bachelor limits when grade set but limits empty', () => {
      const { componentInstance } = createApplicationPage2Fixture({
        data: {
          bachelorDegreeName: 'CS',
          bachelorDegreeUniversity: 'TUM',
          bachelorGrade: '1.5',
          bachelorGradeUpperLimit: '',
          bachelorGradeLowerLimit: '',
        },
      });
      expect(componentInstance.page2Form.get('bachelorGradeUpperLimit')?.value).toBe('1.0');
      expect(componentInstance.page2Form.get('bachelorGradeLowerLimit')?.value).toBe('4.0');
    });

    it('populates master limits when grade set but limits empty', () => {
      const { componentInstance } = createApplicationPage2Fixture({
        data: {
          masterDegreeName: 'CS',
          masterDegreeUniversity: 'TUM',
          masterGrade: '85%',
          masterGradeUpperLimit: '',
          masterGradeLowerLimit: '',
        },
      });
      expect(componentInstance.page2Form.get('masterGradeUpperLimit')?.value).toBe('100%');
      expect(componentInstance.page2Form.get('masterGradeLowerLimit')?.value).toBe('50%');
    });

    it('does not overwrite existing limits', () => {
      const { componentInstance } = createApplicationPage2Fixture({
        data: {
          bachelorDegreeName: 'CS',
          bachelorDegreeUniversity: 'TUM',
          bachelorGrade: '1.5',
          bachelorGradeUpperLimit: '6.0',
          bachelorGradeLowerLimit: '4.0',
        },
      });
      expect(componentInstance.page2Form.get('bachelorGradeUpperLimit')?.value).toBe('6.0');
      expect(componentInstance.page2Form.get('bachelorGradeLowerLimit')?.value).toBe('4.0');
    });

    it('leaves limits empty when grade is not detectable', () => {
      const { componentInstance } = createApplicationPage2Fixture({
        data: {
          bachelorDegreeName: 'CS',
          bachelorDegreeUniversity: 'TUM',
          bachelorGrade: '???',
          bachelorGradeUpperLimit: '',
          bachelorGradeLowerLimit: '',
        },
      });
      expect(componentInstance.page2Form.get('bachelorGradeUpperLimit')?.value).toBe('');
      expect(componentInstance.page2Form.get('bachelorGradeLowerLimit')?.value).toBe('');
    });
  });
});
