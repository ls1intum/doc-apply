import { ReactiveFormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { ApplicantDTO } from 'app/generated/model/applicant-dto';
import { ApplicationInformationData, ApplicationInformationSettingsComponent } from 'app/shared/settings/application-information-settings';
import { AUTO_SAVE_DELAY_MS } from 'app/shared/constants/saving-states';
import { createAccountServiceMock, provideAccountServiceMock } from 'util/account.service.mock';
import { createToastServiceMock, provideToastServiceMock } from 'util/toast-service.mock';
import { createTranslateServiceMock, provideTranslateMock } from 'util/translate.mock';
import { createApplicantResourceApiMock, provideApplicantResourceApiMock } from 'util/applicant-resource-api.service.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';

type Mutable<T> = { -readonly [P in keyof T]: T[P] extends object ? Mutable<T[P]> : T[P] };

describe('ApplicationInformationSettingsComponent', () => {
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
    bachelorGradeUpperLimit: '1.0',
    bachelorGradeLowerLimit: '4.0',
    bachelorGrade: '1.3',
    bachelorUniversity: 'TUM',
    masterDegreeName: 'MSc Computer Science',
    masterGradeUpperLimit: '1.0',
    masterGradeLowerLimit: '4.0',
    masterGrade: '1.1',
    masterUniversity: 'TUM',
  });

  const flushAsyncWork = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
  };

  const createComponent = async (): Promise<ApplicationInformationSettingsComponent> => {
    const component = TestBed.runInInjectionContext(() => new ApplicationInformationSettingsComponent());
    await flushAsyncWork();
    return component;
  };

  const applicantApiMock = createApplicantResourceApiMock();
  const accountServiceMock = createAccountServiceMock();
  const toastServiceMock = createToastServiceMock();
  const translateServiceMock = createTranslateServiceMock();
  const instantMock = vi.mocked(translateServiceMock.instant);

  beforeEach(() => {
    vi.clearAllMocks();
    accountServiceMock.user.set({
      id: 'user-1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      authorities: [],
    });
    applicantApiMock.getApplicantProfile.mockReturnValue(of(createProfile()));
    applicantApiMock.updateApplicantPersonalInformation.mockReturnValue(of(createProfile()));

    instantMock.mockReset();
    instantMock.mockImplementation((key: string | string[]) => (Array.isArray(key) ? key.join(',') : key));

    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, ApplicationInformationSettingsComponent],
      providers: [
        provideApplicantResourceApiMock(applicantApiMock),
        provideAccountServiceMock(accountServiceMock),
        provideToastServiceMock(toastServiceMock),
        provideTranslateMock(translateServiceMock),
        provideFontAwesomeTesting(),
      ],
    });
  });

  describe('loading profile', () => {
    it('should load and map the applicant profile on construction', async () => {
      const component = await createComponent();

      expect(applicantApiMock.getApplicantProfile).toHaveBeenCalledOnce();
      expect(component.loadedProfile()).toEqual(createProfile());
      expect(component.data()).toEqual({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phoneNumber: '+491234567',
        gender: { value: 'female', name: 'genders.female' },
        nationality: { value: 'de', name: 'nationalities.de' },
        dateOfBirth: '1990-12-10',
        website: 'https://ada.example.com',
        linkedIn: 'https://linkedin.com/in/ada',
        street: 'Main Street 1',
        city: 'Munich',
        country: { value: 'de', name: 'countries.de' },
        postcode: '80333',
      });
      expect(component.hasChanges()).toBe(false);
    });

    it('should show an error toast when loading application information fails', async () => {
      applicantApiMock.getApplicantProfile.mockReturnValue(throwError(() => new Error('load failed')));

      const component = await createComponent();

      expect(toastServiceMock.showErrorKey).toHaveBeenCalledWith('settings.applicationInformation.loadFailed');
      expect(component.loadedProfile()).toBeUndefined();
    });

    it('should map missing optional profile fields to undefined or empty strings', async () => {
      const profile = createProfile();
      if (profile.user) {
        Object.assign(profile.user, {
          firstName: undefined,
          lastName: undefined,
          email: undefined,
          phoneNumber: undefined,
          gender: undefined,
          nationality: undefined,
          birthday: undefined,
          website: undefined,
          linkedinUrl: undefined,
        });
      }
      profile.street = undefined;
      profile.postalCode = undefined;
      profile.city = undefined;
      profile.country = undefined;

      applicantApiMock.getApplicantProfile.mockReturnValue(of(profile));

      const component = await createComponent();

      expect(component.data()).toEqual({
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
    });
  });

  describe('option lists', () => {
    it('should translate and sort country and nationality options', async () => {
      instantMock.mockImplementation((key: string | string[]) => {
        if (Array.isArray(key)) {
          return key.join(',');
        }
        if (key === 'countries.de') {
          return 'Bravo';
        }
        if (key === 'countries.at') {
          return 'Alpha';
        }
        if (key === 'nationalities.de') {
          return 'Bravo';
        }
        if (key === 'nationalities.at') {
          return 'Alpha';
        }
        return `zz-${key}`;
      });

      const component = await createComponent();
      const countries = component.selectCountriesLocal();
      const nationalities = component.selectNationalityComputed();

      expect(countries[0]).toEqual({ value: 'at', name: 'Alpha' });
      expect(countries[1]).toEqual({ value: 'de', name: 'Bravo' });
      expect(nationalities[0]).toEqual({ value: 'at', name: 'Alpha' });
      expect(nationalities[1]).toEqual({ value: 'de', name: 'Bravo' });
    });
  });

  describe('form behavior', () => {
    it('should update date and select fields', async () => {
      const component = await createComponent();

      component.setDateOfBirth('1991-01-01');
      expect(component.data().dateOfBirth).toBe('1991-01-01');

      component.setDateOfBirth(undefined);
      expect(component.data().dateOfBirth).toBe('');

      component.updateSelect('gender', { value: 'other', name: 'genders.other' });
      expect(component.data().gender).toEqual({ value: 'other', name: 'genders.other' });

      component.updateSelect('country', undefined);
      expect(component.data().country).toBeUndefined();
      component['autoSave'].reset();
    });

    it('should mark postcode invalid and touched when country no longer matches a prefilled postcode', async () => {
      const fixture = TestBed.createComponent(ApplicationInformationSettingsComponent);
      await flushAsyncWork();
      fixture.detectChanges();

      const component = fixture.componentInstance;
      const updatedData: ApplicationInformationData = structuredClone(component.data());
      updatedData.country = { value: 'de', name: 'countries.de' };
      updatedData.postcode = '80333';
      component.data.set(updatedData);
      fixture.detectChanges();

      component.updateSelect('country', { value: 'NL', name: 'countries.NL' });
      fixture.detectChanges();

      expect(component.applicationInfoForm().controls.postcode.touched).toBe(true);
      expect(component.applicationInfoForm().controls.postcode.errors).toHaveProperty('invalidPostalCode');
      expect(fixture.nativeElement.textContent).toContain('entity.applicationPage1.validation.postalCode');
      component['autoSave'].reset();
    });

    it('should treat a whitespace-only postcode as empty when country changes', async () => {
      const fixture = TestBed.createComponent(ApplicationInformationSettingsComponent);
      await flushAsyncWork();
      fixture.detectChanges();

      const component = fixture.componentInstance;
      const updatedData: ApplicationInformationData = structuredClone(component.data());
      updatedData.country = { value: 'de', name: 'countries.de' };
      updatedData.postcode = '   ';
      component.data.set(updatedData);
      fixture.detectChanges();

      component.updateSelect('country', { value: 'NL', name: 'countries.NL' });
      fixture.detectChanges();

      expect(component.applicationInfoForm().controls.postcode.touched).toBe(false);
      expect(component.applicationInfoForm().controls.postcode.errors).toBeNull();
      component['autoSave'].reset();
    });

    it('should disable the inputs while AI extraction runs and re-enable them afterwards', async () => {
      const fixture = TestBed.createComponent(ApplicationInformationSettingsComponent);
      await flushAsyncWork();
      fixture.detectChanges();

      const component = fixture.componentInstance;
      component.isAiExtracting.set(true);
      fixture.detectChanges();
      expect(component.applicationInfoForm().controls.firstName.disabled).toBe(true);
      expect(component.applicationInfoForm().controls.postcode.disabled).toBe(true);

      component.isAiExtracting.set(false);
      fixture.detectChanges();
      expect(component.applicationInfoForm().controls.firstName.disabled).toBe(false);
      expect(component.applicationInfoForm().controls.postcode.disabled).toBe(false);
    });

    it('should autosave when the country select is cleared', async () => {
      vi.useFakeTimers();
      const component = await createComponent();
      vi.clearAllMocks();

      component.updateSelect('country', undefined);
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS);

      expect(applicantApiMock.updateApplicantPersonalInformation).toHaveBeenCalledWith(
        expect.objectContaining({
          country: undefined,
        }),
      );

      component['autoSave'].reset();
      vi.useRealTimers();
    });

    it('should cancel a pending autosave when the form becomes invalid before debounce expiry', async () => {
      vi.useFakeTimers();
      const fixture = TestBed.createComponent(ApplicationInformationSettingsComponent);
      await flushAsyncWork();
      fixture.detectChanges();

      const component = fixture.componentInstance;
      vi.clearAllMocks();

      component.applicationInfoForm().controls.city.setValue('Berlin');
      fixture.detectChanges();

      component.updateSelect('country', { value: 'NL', name: 'countries.NL' });
      fixture.detectChanges();

      await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS);

      expect(component.applicationInfoForm().valid).toBe(false);
      expect(applicantApiMock.updateApplicantPersonalInformation).not.toHaveBeenCalled();

      component['autoSave'].reset();
      vi.useRealTimers();
    });
  });

  describe('change tracking', () => {
    it('should mark the component as changed when data differs from the initial snapshot', async () => {
      const component = await createComponent();
      expect(component.hasChanges()).toBe(false);

      const originalData: ApplicationInformationData = structuredClone(component.data());
      const updatedData: ApplicationInformationData = structuredClone(component.data());
      updatedData.city = 'Berlin';
      component.data.set(updatedData);

      expect(component.hasChanges()).toBe(true);

      component.data.set(originalData);

      expect(component.hasChanges()).toBe(false);
    });
  });

  describe('saving', () => {
    it('should save application information with the expected payload and reset change tracking', async () => {
      const updatedProfile = createProfile();
      if (updatedProfile.user) {
        Object.assign(updatedProfile.user, {
          firstName: 'Grace',
          email: undefined,
          phoneNumber: undefined,
          nationality: undefined,
          birthday: undefined,
          website: undefined,
          linkedinUrl: undefined,
        });
      }
      updatedProfile.street = undefined;
      updatedProfile.postalCode = undefined;
      updatedProfile.city = 'Berlin';
      updatedProfile.country = 'DE';

      applicantApiMock.updateApplicantPersonalInformation.mockReturnValue(of(updatedProfile));

      const component = await createComponent();
      vi.clearAllMocks();

      const updatedData: ApplicationInformationData = structuredClone(component.data());
      Object.assign(updatedData, {
        firstName: 'Grace',
        email: '',
        phoneNumber: '',
        nationality: undefined,
        dateOfBirth: '',
        website: '',
        linkedIn: '',
        street: '',
        postcode: '',
        city: 'Berlin',
        country: { value: 'DE', name: 'countries.DE' },
      });
      component.data.set(updatedData);

      await component.performAutoSave();

      expect(applicantApiMock.updateApplicantPersonalInformation).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            userId: 'user-1',
            firstName: 'Grace',
            lastName: 'Lovelace',
            email: undefined,
            phoneNumber: undefined,
            gender: 'female',
            birthday: undefined,
          }),
          city: 'Berlin',
          country: 'DE',
          street: undefined,
          postalCode: undefined,
        }),
      );
      expect(toastServiceMock.showErrorKey).not.toHaveBeenCalled();
      expect(component.initialDataSnapshot()).toMatchObject({
        firstName: 'Grace',
        city: 'Berlin',
        country: 'DE',
      });
      expect(component.hasChanges()).toBe(false);
    });

    it('should map blank first name, last name and city to undefined when saving', async () => {
      const component = await createComponent();
      vi.clearAllMocks();

      const updatedData: ApplicationInformationData = structuredClone(component.data());
      updatedData.firstName = '';
      updatedData.lastName = '';
      updatedData.city = '';
      component.data.set(updatedData);

      await component.performAutoSave();

      expect(applicantApiMock.updateApplicantPersonalInformation).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            userId: 'user-1',
            firstName: undefined,
            lastName: undefined,
            email: 'ada@example.com',
          }),
          city: undefined,
          country: 'de',
        }),
      );
    });

    it('should show an error toast when saving application information fails', async () => {
      applicantApiMock.updateApplicantPersonalInformation.mockReturnValue(throwError(() => new Error('save failed')));

      const component = await createComponent();
      vi.clearAllMocks();

      await component.performAutoSave();

      expect(toastServiceMock.showErrorKey).toHaveBeenCalledWith('settings.applicationInformation.saveFailed');
      expect(toastServiceMock.showSuccessKey).not.toHaveBeenCalled();
    });

    it('should not persist when performAutoSave runs while the form is invalid', async () => {
      const fixture = TestBed.createComponent(ApplicationInformationSettingsComponent);
      await flushAsyncWork();
      fixture.detectChanges();

      const component = fixture.componentInstance;
      vi.clearAllMocks();

      const updatedData: ApplicationInformationData = structuredClone(component.data());
      updatedData.country = { value: 'NL', name: 'countries.NL' };
      component.data.set(updatedData);
      fixture.detectChanges();
      component['revealPostcodeCountryMismatch']();
      fixture.detectChanges();

      const saved = await component.performAutoSave();

      expect(component.applicationInfoForm().valid).toBe(false);
      expect(saved).toBe(false);
      expect(applicantApiMock.updateApplicantPersonalInformation).not.toHaveBeenCalled();
      component['autoSave'].reset();
    });
  });
});
