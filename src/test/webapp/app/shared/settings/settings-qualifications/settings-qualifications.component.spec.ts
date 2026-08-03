import { ReactiveFormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';

import { ApplicantDTO } from 'app/generated/model/applicant-dto';
import { ApplicationDocumentIdsDTO } from 'app/generated/model/application-document-ids-dto';
import { SavingStates } from 'app/shared/constants/saving-states';
import { SettingsQualificationsComponent } from 'app/shared/settings/settings-qualifications/settings-qualifications.component';

type Mutable<T> = { -readonly [P in keyof T]: T[P] extends object ? Mutable<T[P]> : T[P] };
import { createApplicantResourceApiMock, provideApplicantResourceApiMock } from 'util/applicant-resource-api.service.mock';
import { createAccountServiceMock, provideAccountServiceMock } from 'util/account.service.mock';
import { createToastServiceMock, provideToastServiceMock } from 'util/toast-service.mock';
import { createTranslateServiceMock, provideTranslateMock } from 'util/translate.mock';
import { createDialogServiceMock, provideDialogServiceMock } from 'util/dialog.service.mock';
import { createHttpClientMock, provideHttpClientMock } from 'util/http-client.mock';
import { GradingScaleEditDialogComponent } from 'app/application/application-creation/application-creation-page2/grading-scale-edit-dialog/grading-scale-edit-dialog';

describe('SettingsQualificationsComponent', () => {
  type SettingsQualificationsPrototype = {
    loadProfile(this: SettingsQualificationsComponent): Promise<void>;
  };

  const createProfile = (): Mutable<ApplicantDTO> => ({
    user: {
      userId: 'user-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phoneNumber: '+491234567',
      gender: 'female',
      nationality: 'de',
      birthday: '1990-12-10',
      website: 'https://ada.example.com',
      linkedinUrl: 'https://linkedin.com/in/ada',
    },
    street: 'Main Street 1',
    postalCode: '80333',
    city: 'Munich',
    country: 'de',
    bachelorDegreeName: 'BSc Computer Science',
    bachelorUniversity: 'TUM',
    bachelorGradeUpperLimit: '1.0',
    bachelorGradeLowerLimit: '4.0',
    bachelorGrade: '1.3',
    masterDegreeName: 'MSc Computer Science',
    masterUniversity: 'TUM',
    masterGradeUpperLimit: '1.0',
    masterGradeLowerLimit: '4.0',
    masterGrade: '1.1',
  });

  const createDocumentIds = (): ApplicationDocumentIdsDTO => ({
    bachelorDocumentIds: [{ id: 'bachelor-doc-1', name: 'bachelor.pdf', size: 100 }],
    masterDocumentIds: [{ id: 'master-doc-1', name: 'master.pdf', size: 100 }],
    cvDocumentId: { id: 'cv-doc-1', name: 'cv.pdf', size: 100 },
    referenceDocumentIds: [{ id: 'reference-doc-1', name: 'reference.pdf', size: 100 }],
  });

  const createComponent = async (): Promise<SettingsQualificationsComponent> => {
    const prototype = SettingsQualificationsComponent.prototype as unknown as SettingsQualificationsPrototype;
    const originalLoadProfile = prototype.loadProfile;
    let loadProfilePromise: Promise<void> | undefined;
    const loadProfileSpy = vi.spyOn(prototype, 'loadProfile').mockImplementation(function (this: SettingsQualificationsComponent) {
      loadProfilePromise = originalLoadProfile.call(this);
      return loadProfilePromise;
    });

    try {
      const component = TestBed.runInInjectionContext(() => new SettingsQualificationsComponent());
      if (loadProfilePromise == null) {
        throw new Error('Expected constructor to trigger loadProfile()');
      }
      await loadProfilePromise;
      return component;
    } finally {
      loadProfileSpy.mockRestore();
    }
  };

  const applicantApiMock = createApplicantResourceApiMock();
  const accountServiceMock = createAccountServiceMock();
  const toastServiceMock = createToastServiceMock();
  const translateServiceMock = createTranslateServiceMock();
  const dialogServiceMock = createDialogServiceMock();
  const httpClientMock = createHttpClientMock();

  beforeEach(() => {
    vi.clearAllMocks();

    accountServiceMock.user.set({
      id: 'user-1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      authorities: [],
    });

    applicantApiMock.getApplicantProfile.mockReturnValue(of(createProfile()));
    applicantApiMock.getApplicantProfileDocumentIds.mockReturnValue(of(createDocumentIds()));
    applicantApiMock.updateApplicantDocumentSettings.mockReturnValue(of(createProfile()));
    applicantApiMock.deleteApplicantProfileDocument.mockReturnValue(of(undefined));
    applicantApiMock.renameApplicantProfileDocument.mockReturnValue(of(undefined));
    httpClientMock.post.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        provideApplicantResourceApiMock(applicantApiMock),
        provideAccountServiceMock(accountServiceMock),
        provideToastServiceMock(toastServiceMock),
        provideTranslateMock(translateServiceMock),
        provideDialogServiceMock(dialogServiceMock),
        provideHttpClientMock(httpClientMock),
      ],
    });
  });

  describe('loading', () => {
    it('should load profile data and document ids on construction', async () => {
      const component = await createComponent();

      expect(applicantApiMock.getApplicantProfile).toHaveBeenCalledOnce();
      expect(applicantApiMock.getApplicantProfileDocumentIds).toHaveBeenCalledOnce();
      expect(component.hasLoaded()).toBe(true);
      expect(component.form.getRawValue()).toMatchObject({
        bachelorDegreeName: 'BSc Computer Science',
        masterDegreeName: 'MSc Computer Science',
      });
      expect(component.bachelorDocuments()?.[0]?.id).toBe('bachelor-doc-1');
      expect(component.referenceDocuments()?.[0]?.id).toBe('reference-doc-1');
      expect(component.bachelorGradeLimits()).toEqual({ upperLimit: '1.0', lowerLimit: '4.0', isPercentage: false });
      expect(component.masterGradeLimits()).toEqual({ upperLimit: '1.0', lowerLimit: '4.0', isPercentage: false });
    });

    it('should show an error toast when loading document settings fails', async () => {
      applicantApiMock.getApplicantProfile.mockReturnValue(throwError(() => new Error('load failed')));

      const component = await createComponent();

      expect(toastServiceMock.showErrorKey).toHaveBeenCalledWith('settings.qualifications.loadFailed');
      expect(component.hasLoaded()).toBe(false);
    });

    it('should set grade limits to null when the loaded grades are empty', async () => {
      const profile = createProfile();
      Object.assign(profile, {
        bachelorGrade: '',
        bachelorGradeUpperLimit: '',
        bachelorGradeLowerLimit: '',
        masterGrade: '',
        masterGradeUpperLimit: '',
        masterGradeLowerLimit: '',
      });
      applicantApiMock.getApplicantProfile.mockReturnValue(of(profile));

      const component = await createComponent();

      expect(component.bachelorGradeLimits()).toBeNull();
      expect(component.masterGradeLimits()).toBeNull();
    });

    it('should map missing profile fields and document ids to empty values on load', async () => {
      applicantApiMock.getApplicantProfile.mockReturnValue(of({ user: { userId: 'user-1' } } as ApplicantDTO));
      applicantApiMock.getApplicantProfileDocumentIds.mockReturnValue(of({} as ApplicationDocumentIdsDTO));

      const component = await createComponent();

      expect(component.form.getRawValue()).toMatchObject({
        bachelorDegreeName: '',
        masterDegreeName: '',
        bachelorGrade: '',
        masterGrade: '',
      });
      expect(component.bachelorDocuments()).toEqual([]);
      expect(component.referenceDocuments()).toEqual([]);
    });
  });

  describe('state tracking', () => {
    it('should detect form and document changes relative to the loaded snapshot', async () => {
      const component = await createComponent();

      component.form.patchValue({
        bachelorDegreeName: 'Updated Degree',
      });

      expect(component.hasFormChanges()).toBe(true);
      expect(component.hasChanges()).toBe(true);

      component.referenceDocuments.set([{ id: 'reference-doc-1', name: 'reference-renamed.pdf', size: 100 }]);

      expect(component.hasChanges()).toBe(true);
    });
  });

  describe('grading scale', () => {
    it('should apply returned grading scale limits for bachelor and master grades', async () => {
      const dialogCloseSubject = new Subject<{ upperLimit: string; lowerLimit: string } | undefined>();
      dialogServiceMock.open.mockReturnValue({ onClose: dialogCloseSubject.asObservable() });
      const component = await createComponent();

      component.onChangeGradingScale('bachelor');
      expect(dialogServiceMock.open).toHaveBeenCalledWith(
        GradingScaleEditDialogComponent,
        expect.objectContaining({ data: expect.objectContaining({ gradeType: 'bachelor', currentGrade: '1.3' }) }),
      );
      dialogCloseSubject.next({ upperLimit: '100%', lowerLimit: '60%' });

      expect(component.form.controls.bachelorGradeUpperLimit.value).toBe('100%');
      expect(component.form.controls.bachelorGradeLowerLimit.value).toBe('60%');
      expect(component.bachelorGradeLimits()).toEqual({ upperLimit: '100%', lowerLimit: '60%' });
    });

    it('should keep master grading scale values unchanged when the dialog closes without a result', async () => {
      const dialogCloseSubject = new Subject<{ upperLimit: string; lowerLimit: string } | undefined>();
      dialogServiceMock.open.mockReturnValue({ onClose: dialogCloseSubject.asObservable() });

      const component = await createComponent();
      component.form.patchValue({ masterGradeUpperLimit: null, masterGradeLowerLimit: null });

      component.onChangeGradingScale('master');
      dialogCloseSubject.next(undefined);

      expect(dialogServiceMock.open).toHaveBeenCalledOnce();
      expect(dialogServiceMock.open.mock.calls[0][1]).toMatchObject({
        data: { gradeType: 'master', currentGrade: '1.1', currentUpperLimit: '', currentLowerLimit: '' },
      });
      expect(component.form.controls.masterGradeUpperLimit.value).toBeNull();
      expect(component.form.controls.masterGradeLowerLimit.value).toBeNull();
    });

    it('should derive limits and warnings for bachelor grades after debounce', async () => {
      vi.useFakeTimers();
      const component = await createComponent();

      component.form.controls.bachelorGrade.setValue('84%');
      await vi.advanceTimersByTimeAsync(600);

      expect(component.form.controls.bachelorGradeUpperLimit.value).toBe('100%');
      expect(component.form.controls.bachelorGradeLowerLimit.value).toBe('50%');

      component.form.controls.bachelorGrade.setValue('12345');
      await vi.advanceTimersByTimeAsync(600);

      expect(component.warningTextBachelorGrade()).toBe('entity.applicationPage2.warnText');
      vi.useRealTimers();
    });
  });

  describe('saving', () => {
    it('should still persist extracted degree values while the inputs are disabled', async () => {
      const component = await createComponent();
      vi.clearAllMocks();

      component.form.controls.bachelorDegreeName.setValue('');
      component.form.controls.bachelorDegreeName.disable({ emitEvent: false });

      component.onAiDataExtracted({ education: { bachelorDegreeName: 'BSc Extracted' } });
      await component.performAutoSave();

      expect(applicantApiMock.updateApplicantDocumentSettings).toHaveBeenCalledWith(
        expect.objectContaining({ bachelorDegreeName: 'BSc Extracted' }),
      );
    });

    it('should save document settings with the expected payload and reset the local baseline', async () => {
      const component = await createComponent();
      vi.clearAllMocks();

      component.form.patchValue({
        masterDegreeName: 'Updated Master Degree',
      });

      await component.performAutoSave();

      expect(applicantApiMock.updateApplicantDocumentSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({ userId: 'user-1' }),
          masterDegreeName: 'Updated Master Degree',
        }),
      );
      expect(toastServiceMock.showSuccessKey).not.toHaveBeenCalled();
      expect(component.initialFormValue()).toMatchObject({
        masterDegreeName: 'Updated Master Degree',
      });
      expect(component.savingState()).toBe(SavingStates.SAVED);
    });

    it('should normalize null form values to undefined in the save payload', async () => {
      const component = await createComponent();
      vi.clearAllMocks();

      component.form.patchValue({
        bachelorDegreeName: null,
        bachelorDegreeUniversity: null,
        bachelorGradeUpperLimit: null,
        bachelorGradeLowerLimit: null,
        bachelorGrade: null,
        masterDegreeName: null,
        masterDegreeUniversity: null,
        masterGradeUpperLimit: null,
        masterGradeLowerLimit: null,
        masterGrade: null,
      });

      await component.performAutoSave();

      expect(applicantApiMock.updateApplicantDocumentSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          bachelorDegreeName: undefined,
          bachelorUniversity: undefined,
          bachelorGradeUpperLimit: undefined,
          bachelorGradeLowerLimit: undefined,
          bachelorGrade: undefined,
          masterDegreeName: undefined,
          masterUniversity: undefined,
          masterGradeUpperLimit: undefined,
          masterGradeLowerLimit: undefined,
          masterGrade: undefined,
        }),
      );
    });

    it('should not batch document mutations into metadata autosave anymore', async () => {
      const component = await createComponent();
      vi.clearAllMocks();

      component.bachelorDocuments.set([]);
      component.referenceDocuments.set([
        { id: 'reference-doc-1', name: 'reference-renamed.pdf', size: 100 },
        { id: 'temp-upload-1', name: 'new-reference.pdf', size: 123 },
      ]);

      await component.performAutoSave();

      expect(applicantApiMock.deleteApplicantProfileDocument).not.toHaveBeenCalled();
      expect(applicantApiMock.renameApplicantProfileDocument).not.toHaveBeenCalled();
      expect(httpClientMock.post).not.toHaveBeenCalled();
      expect(applicantApiMock.updateApplicantDocumentSettings).not.toHaveBeenCalled();
    });

    it('should show an error and skip saving when the loaded user id is missing', async () => {
      const component = await createComponent();
      vi.clearAllMocks();
      accountServiceMock.user.set(undefined);
      component.form.patchValue({
        bachelorDegreeName: 'Updated Degree',
      });

      const saved = await component.performAutoSave();

      expect(applicantApiMock.updateApplicantDocumentSettings).not.toHaveBeenCalled();
      expect(toastServiceMock.showErrorKey).toHaveBeenCalledWith('settings.qualifications.saveFailed');
      expect(saved).toBe(false);
    });

    it('should show an error toast when saving document settings fails', async () => {
      applicantApiMock.updateApplicantDocumentSettings.mockReturnValue(throwError(() => new Error('save failed')));

      const component = await createComponent();
      vi.clearAllMocks();
      applicantApiMock.updateApplicantDocumentSettings.mockReturnValue(throwError(() => new Error('save failed')));
      component.form.patchValue({
        bachelorDegreeName: 'Updated Degree',
      });

      const saved = await component.performAutoSave();

      expect(toastServiceMock.showErrorKey).toHaveBeenCalledWith('settings.qualifications.saveFailed');
      expect(saved).toBe(false);
    });
  });
});
