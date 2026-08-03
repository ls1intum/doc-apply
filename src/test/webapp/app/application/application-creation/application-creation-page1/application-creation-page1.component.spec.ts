import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provideTranslateMock } from 'util/translate.mock';
import ApplicationCreationPage1Component, {
  getPage1FromApplication,
} from 'app/application/application-creation/application-creation-page1/application-creation-page1.component';
import { postalCodeValidator } from 'app/shared/validators/custom-validators';
import { selectGender } from 'app/shared/constants/genders';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { AccountService } from 'app/core/auth/account.service';
import { AbstractControl } from '@angular/forms';
import {
  ApplicationForApplicantDTO,
  ApplicationForApplicantDTOApplicationStateEnum,
} from 'app/generated/model/application-for-applicant-dto';
import { JobFormDTOLocationEnum, JobFormDTOSubjectAreaEnum } from 'app/generated/model/job-form-dto';
import { provideHttpClientMock } from 'util/http-client.mock';
import { provideToastServiceMock } from 'util/toast-service.mock';
import { ExtractedApplicationDataDTO } from 'app/generated/model/extracted-application-data-dto';
import { DocumentInformationHolderDTO } from 'app/generated/model/document-information-holder-dto';

describe('ApplicationPage1Component', () => {
  let accountService: Pick<AccountService, 'signedIn'>;
  let fixture: ComponentFixture<ApplicationCreationPage1Component>;
  let comp: ApplicationCreationPage1Component;
  beforeEach(async () => {
    accountService = {
      signedIn: signal<boolean>(true),
    };
    await TestBed.configureTestingModule({
      imports: [ApplicationCreationPage1Component],
      providers: [
        { provide: AccountService, useValue: accountService },
        provideRouter([]),
        provideTranslateMock(),
        provideFontAwesomeTesting(),
        provideToastServiceMock(),
        provideHttpClientMock(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ApplicationCreationPage1Component);
    comp = fixture.componentInstance;
    comp.data.set({
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
    fixture.detectChanges();
  });

  it('should be invalid initially when required fields empty', () => {
    expect(comp.page1Form().valid).toBe(false);
  });

  it.each([
    { postcode: '80331', valid: true },
    { postcode: '987877', valid: false },
    { postcode: '   ', valid: false },
  ])('postcode=$postcode -> valid=$valid for German country', ({ postcode, valid }) => {
    const countryOption = { value: 'DE', name: 'Germany' };
    comp.data.set(Object.assign({}, comp.data(), { country: countryOption }));
    const form = comp.page1Form();
    form.controls.firstName.setValue('Alice');
    form.controls.lastName.setValue('Smith');
    form.controls.email.setValue('alice@example.com');
    form.controls.phoneNumber.setValue('123456');
    form.controls.street.setValue('Main St');
    form.controls.city.setValue('Munich');
    form.controls.postcode.setValue(postcode);
    form.updateValueAndValidity();

    expect(form.valid).toBe(valid);
    if (!valid && postcode.trim().length > 0) expect(form.controls.postcode.errors).toHaveProperty('invalidPostalCode');
    if (!valid && postcode.trim().length === 0) expect(form.controls.postcode.errors).toEqual({ required: true });
  });

  it('getPage1FromApplication maps fields properly', () => {
    const fakeApp: ApplicationForApplicantDTO = {
      applicant: {
        user: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phoneNumber: '9999',
          gender: 'male',
          nationality: 'us',
          birthday: '1990-01-01',
          website: 'https://site.com',
          linkedinUrl: 'https://li.com',
        },
        street: 'Street 1',
        city: 'CityX',
        country: 'us',
        postalCode: '12345',
      },
      applicationState: ApplicationForApplicantDTOApplicationStateEnum.Saved,
      job: {
        jobId: '2345',
        professorName: 'Professor Name',
        location: JobFormDTOLocationEnum.Garching,
        title: 'Example Job',
        subjectArea: JobFormDTOSubjectAreaEnum.ComputerScience,
      },
    };

    const page1 = getPage1FromApplication(fakeApp);
    expect(page1.firstName).toBe('John');
    expect(page1.gender).toEqual(selectGender.find(g => g.value === 'male'));
    expect(page1.country?.value).toBe('us');
  });

  it('should emit changed and valid when form changes', () => {
    const form = comp.page1Form();
    const changedSpy = vi.fn();
    const validSpy = vi.fn();
    comp.changed.subscribe(changedSpy);
    comp.valid.subscribe(validSpy);
    form.controls.firstName.setValue('Bob');
    expect(changedSpy).toHaveBeenCalledOnce();
    expect(validSpy).toHaveBeenCalledTimes(2);
  });

  it('setDateOfBirth should update data and emit changed', () => {
    const changedSpy = vi.fn();
    comp.changed.subscribe(changedSpy);

    comp.setDateOfBirth('2000-12-31');
    expect(comp.data().dateOfBirth).toBe('2000-12-31');
    expect(changedSpy).toHaveBeenCalledOnce();
  });

  it('updateSelect should update select fields and emit changed', () => {
    const changedSpy = vi.fn();
    comp.changed.subscribe(changedSpy);

    const nationalityOption = { value: 'FR', name: 'France' };
    comp.updateSelect('nationality', nationalityOption);
    expect(comp.data().nationality).toBe(nationalityOption);
    expect(changedSpy).toHaveBeenCalledOnce();
  });

  it('should surface a prefilled postcode-country mismatch without user interaction', () => {
    comp.data.set({
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      phoneNumber: '123456',
      gender: undefined,
      nationality: undefined,
      dateOfBirth: '',
      website: '',
      linkedIn: '',
      street: 'Main St',
      city: 'Munich',
      country: { value: 'NL', name: 'Netherlands' },
      postcode: '80331',
    });
    fixture.detectChanges();

    expect(comp.page1Form().controls.postcode.touched).toBe(true);
    expect(comp.page1Form().controls.postcode.errors).toHaveProperty('invalidPostalCode');
  });

  it('should show the postcode mismatch error when country changes after a prefilled postcode', () => {
    const updatedData = structuredClone(comp.data());
    updatedData.country = { value: 'DE', name: 'Germany' };
    updatedData.postcode = '80331';
    comp.data.set(updatedData);
    fixture.detectChanges();

    comp.updateSelect('country', { value: 'NL', name: 'Netherlands' });
    fixture.detectChanges();

    expect(comp.page1Form().controls.postcode.touched).toBe(true);
    expect(comp.page1Form().controls.postcode.errors).toHaveProperty('invalidPostalCode');
    expect(fixture.nativeElement.textContent).toContain('entity.applicationPage1.validation.postalCode');
  });

  it('should treat a whitespace-only postcode as empty when country changes', () => {
    const updatedData = structuredClone(comp.data());
    updatedData.country = { value: 'DE', name: 'Germany' };
    updatedData.postcode = '   ';
    comp.data.set(updatedData);
    fixture.detectChanges();

    comp.updateSelect('country', { value: 'NL', name: 'Netherlands' });
    fixture.detectChanges();

    expect(comp.page1Form().controls.postcode.touched).toBe(false);
    expect(comp.page1Form().controls.postcode.errors).toEqual({ required: true });
    expect(comp.page1Form().controls.postcode.errors).not.toHaveProperty('invalidPostalCode');
  });

  it.each([
    [() => undefined, '12345', {}],
    [() => 'DE', '', {}],
    [() => 'ZZ', '12345', { invalidPostalCode: 'entity.applicationPage1.validation.postalCode' }],
  ])('postalCodeValidator with country/value -> result', (countryFn, value, expected) => {
    const validator = postalCodeValidator(countryFn as () => string | undefined);
    expect(validator({ value } as AbstractControl)).toEqual(expected);
  });

  it('updateSelect should allow setting undefined value', () => {
    const changedSpy = vi.fn();
    comp.changed.subscribe(changedSpy);
    comp.updateSelect('gender', undefined);
    expect(comp.data().gender).toBeUndefined();
    expect(changedSpy).toHaveBeenCalledOnce();
  });

  it('setDateOfBirth should handle undefined input', () => {
    const changedSpy = vi.fn();
    comp.changed.subscribe(changedSpy);
    comp.setDateOfBirth(undefined);
    expect(comp.data().dateOfBirth).toBe('');
    expect(changedSpy).toHaveBeenCalledOnce();
  });

  it('getPage1FromApplication handles missing fields gracefully', () => {
    const app: ApplicationForApplicantDTO = {
      applicationState: ApplicationForApplicantDTOApplicationStateEnum.Saved,
      job: {
        jobId: '2345',
        professorName: 'Professor Name',
        location: JobFormDTOLocationEnum.Garching,
        title: 'Example Job',
        subjectArea: JobFormDTOSubjectAreaEnum.ComputerScience,
      },
    };
    const page1 = getPage1FromApplication(app);
    expect(page1.firstName).toBe('');
    expect(page1.gender).toBeUndefined();
  });

  it.each([
    [undefined, false],
    [[], false],
    [[{ id: '1', size: 1 }], true],
  ])('cvDocsSetValidity(%j) -> cvValid=%s', (docs, expected) => {
    comp.cvDocsSetValidity(docs as DocumentInformationHolderDTO[] | undefined);
    expect(comp.cvValid()).toBe(expected);
  });

  describe('onAiDataExtracted', () => {
    it('populates country dropdown when extracted country code matches an option', () => {
      const extracted: ExtractedApplicationDataDTO = { country: 'de' };

      comp.onAiDataExtracted(extracted);

      expect(comp.data().country?.value).toBe('de');
    });

    it('leaves country dropdown empty when extracted country code is unknown', () => {
      const extracted: ExtractedApplicationDataDTO = { country: 'xx' };

      comp.onAiDataExtracted(extracted);

      expect(comp.data().country).toBeUndefined();
    });

    it('populates dateOfBirth when extracted date is in ISO format', () => {
      const extracted: ExtractedApplicationDataDTO = { dateOfBirth: '1990-01-01' };

      comp.onAiDataExtracted(extracted);

      expect(comp.data().dateOfBirth).toBe('1990-01-01');
    });

    it('does not overwrite existing country dropdown selection', () => {
      const preset = { value: 'fr', name: 'countries.fr' };
      comp.data.set(Object.assign({}, comp.data(), { country: preset }));

      const extracted: ExtractedApplicationDataDTO = { country: 'de' };
      comp.onAiDataExtracted(extracted);

      expect(comp.data().country).toBe(preset);
    });
  });

  it('should disable the inputs while AI extraction runs and re-enable them afterwards', () => {
    comp.isAiExtracting.set(true);
    fixture.detectChanges();
    expect(comp.page1Form().controls.firstName.disabled).toBe(true);
    expect(comp.page1Form().controls.postcode.disabled).toBe(true);

    comp.isAiExtracting.set(false);
    fixture.detectChanges();
    expect(comp.page1Form().controls.firstName.disabled).toBe(false);
    expect(comp.page1Form().controls.postcode.disabled).toBe(false);
  });

  it('should still apply extracted values into empty fields while the inputs are disabled', () => {
    comp.isAiExtracting.set(true);
    fixture.detectChanges();

    comp.onAiDataExtracted({ firstName: 'Ada', city: 'Munich' });

    expect(comp.data().firstName).toBe('Ada');
    expect(comp.data().city).toBe('Munich');
  });

  it.each([
    [{ id: '1', size: 1 }, [{ id: '1', size: 1 }]],
    [undefined, undefined],
  ])('computedDocumentIdsCvSet(%j) -> %j', (doc, expected) => {
    fixture.componentRef.setInput('documentIdsCv', doc);
    fixture.detectChanges();
    expect(comp.computedDocumentIdsCvSet()).toEqual(expected);
  });
});
