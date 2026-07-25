import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DividerModule } from 'primeng/divider';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AccountService } from 'app/core/auth/account.service';
import { ToastService } from 'app/service/toast-service';
import { firstValueFrom } from 'rxjs';
import { ExtractedApplicationDataDTO } from 'app/generated/model/extracted-application-data-dto';
import { TranslateDirective } from 'app/shared/language';
import { ApplicantResourceApi } from 'app/generated/api/applicant-resource-api';
import { ApplicantDTO } from 'app/generated/model/applicant-dto';
import { DocumentInformationHolderDTO } from 'app/generated/model/document-information-holder-dto';
import { selectCountries } from 'app/shared/language/countries';
import { selectNationality } from 'app/shared/language/nationalities';
import { selectGender } from 'app/shared/constants/genders';
import { SavingState } from 'app/shared/constants/saving-states';
import { postalCodeValidator } from 'app/shared/validators/custom-validators';
import { deepEqual } from 'app/core/util/deepequal-util';
import { AiExtractionBoxComponent, setIfEmpty } from 'app/shared/components/molecules/ai-extraction-box/ai-extraction-box.component';
import { AutoSaveController } from 'app/shared/util/auto-save-controller';

import { SelectComponent, SelectOption } from '../../components/atoms/select/select.component';
import { DatePickerComponent } from '../../components/atoms/datepicker/datepicker.component';
import { StringInputComponent } from '../../components/atoms/string-input/string-input.component';
import { UploadButtonComponent } from '../../components/atoms/upload-button/upload-button.component';
import { SavingBadgeComponent } from '../../components/atoms/saving-badge/saving-badge.component';
import { StickyFooterShellComponent } from '../../components/molecules/sticky-footer-shell/sticky-footer-shell.component';

export interface ApplicationInformationData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  gender?: SelectOption;
  nationality?: SelectOption;
  dateOfBirth: string;
  website: string;
  linkedIn: string;
  street: string;
  city: string;
  country?: SelectOption;
  postcode: string;
}

interface ApplicationInformationSnapshot {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  gender?: string | number;
  nationality?: string | number;
  dateOfBirth: string;
  website: string;
  linkedIn: string;
  street: string;
  city: string;
  country?: string | number;
  postcode: string;
}

@Component({
  selector: 'jhi-application-information-settings',
  imports: [
    ReactiveFormsModule,
    DividerModule,
    SelectComponent,
    DatePickerComponent,
    StringInputComponent,
    TranslateModule,
    TranslateDirective,
    UploadButtonComponent,
    AiExtractionBoxComponent,
    SavingBadgeComponent,
    StickyFooterShellComponent,
  ],
  templateUrl: './application-information-settings.component.html',
  standalone: true,
})
export class ApplicationInformationSettingsComponent {
  data = signal<ApplicationInformationData>({
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

  // Document tracking for CV
  cvDocuments = signal<DocumentInformationHolderDTO[] | undefined>(undefined);

  readonly uploadHostId = '00000000-0000-0000-0000-000000000000';

  isValid = signal<boolean>(false);
  loadedProfile = signal<ApplicantDTO | undefined>(undefined);
  initialDataSnapshot = signal<ApplicationInformationSnapshot | undefined>(undefined);
  savingState = computed<SavingState>(() => this.autoSave.state());
  hasChanges = computed(() => {
    const initial = this.initialDataSnapshot();
    if (initial === undefined) {
      return false;
    }
    return !deepEqual(this.toSnapshot(this.data()), initial);
  });

  readonly disabledEmail = true;

  // Locks the form inputs while the CV AI extraction runs, so user edits can't race the values being written back
  isAiExtracting = signal<boolean>(false);

  readonly minDate = new Date(1900, 0, 1);
  readonly maxDate = (() => {
    const today = new Date();
    return new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  })(); // ensures minimum age of 18
  readonly defaultBirthDate = new Date(2000, 0, 1);

  selectGenderLocal = selectGender;
  selectNationalityLocal = selectNationality;
  accountService = inject(AccountService);
  translate = inject(TranslateService);
  formbuilder = inject(FormBuilder);
  applicantApi = inject(ApplicantResourceApi);
  toastService = inject(ToastService);

  currentLang = toSignal(this.translate.onLangChange);

  // Computed signal that adds translated labels to country options for filtering
  selectCountriesLocal = computed(() => {
    void this.currentLang();

    return selectCountries
      .map(option => ({
        value: option.value,
        name: this.translate.instant(option.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  // Computed signal that adds translated labels to nationality options for filtering
  selectNationalityComputed = computed(() => {
    void this.currentLang();

    return selectNationality
      .map(option => ({
        value: option.value,
        name: this.translate.instant(option.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  applicationInfoForm = computed(() => {
    const currentData = this.data();
    return this.formbuilder.group({
      firstName: [currentData.firstName],
      lastName: [currentData.lastName],
      email: [{ value: currentData.email, disabled: this.disabledEmail }, Validators.email],
      phoneNumber: [currentData.phoneNumber],

      street: [currentData.street],
      city: [currentData.city],
      country: [currentData.country],
      postcode: [currentData.postcode, [postalCodeValidator(() => this.data().country?.value as string)]],

      // Optional fields
      gender: [currentData.gender ?? null],
      nationality: [currentData.nationality ?? null],
      dateOfBirth: [currentData.dateOfBirth],
      website: [currentData.website],
      linkedIn: [currentData.linkedIn],
    });
  });

  formEffect = effect(onCleanup => {
    const form = this.applicationInfoForm();
    const data = this.data();
    const valueSubscription = form.valueChanges.subscribe(() => {
      const normalizedValue = Object.fromEntries(Object.entries(form.getRawValue()).map(([key, val]) => [key, val ?? '']));
      const nextData: ApplicationInformationData = {
        firstName: normalizedValue.firstName as string,
        lastName: normalizedValue.lastName as string,
        email: normalizedValue.email as string,
        phoneNumber: normalizedValue.phoneNumber as string,
        gender: data.gender,
        nationality: data.nationality,
        dateOfBirth: data.dateOfBirth,
        website: normalizedValue.website as string,
        linkedIn: normalizedValue.linkedIn as string,
        street: normalizedValue.street as string,
        city: normalizedValue.city as string,
        country: data.country,
        postcode: normalizedValue.postcode as string,
      };
      this.data.set(nextData);
      this.queueAutoSaveIfNeeded();
    });

    const statusSubscription = form.statusChanges.subscribe(() => {
      this.isValid.set(form.valid);
    });

    this.isValid.set(form.valid);
    this.revealPostcodeCountryMismatch();

    onCleanup(() => {
      valueSubscription.unsubscribe();
      statusSubscription.unsubscribe();
    });
  });

  private readonly autoSave = new AutoSaveController({ save: () => this.performAutoSave() });

  constructor() {
    // Load initial data from backend API
    void this.loadApplicationInformation();
  }

  async loadApplicationInformation(): Promise<void> {
    try {
      // Load current applicant profile directly from database (like createApplication does)
      const profile = await firstValueFrom(this.applicantApi.getApplicantProfile());
      const profileDocumentIds = await firstValueFrom(this.applicantApi.getApplicantProfileDocumentIds());

      // Map ApplicantDTO to ApplicationInformationData
      const applicationInformation: ApplicationInformationData = {
        firstName: profile.user.firstName ?? '',
        lastName: profile.user.lastName ?? '',
        email: profile.user.email ?? '',
        phoneNumber: profile.user.phoneNumber ?? '',
        gender: profile.user.gender != null ? { value: profile.user.gender, name: `genders.${profile.user.gender}` } : undefined,
        nationality:
          profile.user.nationality != null
            ? { value: profile.user.nationality, name: `nationalities.${profile.user.nationality}` }
            : undefined,
        dateOfBirth: profile.user.birthday ?? '',
        website: profile.user.website ?? '',
        linkedIn: profile.user.linkedinUrl ?? '',
        street: profile.street ?? '',
        city: profile.city ?? '',
        country: profile.country != null ? { value: profile.country, name: `countries.${profile.country}` } : undefined,
        postcode: profile.postalCode ?? '',
      };

      this.loadedProfile.set(profile);
      this.data.set(applicationInformation);
      this.initialDataSnapshot.set(this.toSnapshot(applicationInformation));
      this.cvDocuments.set(profileDocumentIds.cvDocumentId != null ? [profileDocumentIds.cvDocumentId] : []);
    } catch {
      this.toastService.showErrorKey('settings.applicationInformation.loadFailed');
    }
  }

  setDateOfBirth($event: string | undefined): void {
    const updatedData = structuredClone(this.data());
    updatedData.dateOfBirth = $event ?? '';
    this.data.set(updatedData);
    this.queueAutoSaveIfNeeded();
  }

  updateSelect(field: keyof ApplicationInformationData, value: SelectOption | undefined): void {
    const updatedData = structuredClone(this.data());
    updatedData[field] = value as never;
    this.data.set(updatedData);
    if (field === 'country') {
      this.revealPostcodeCountryMismatch();
    }
    this.queueAutoSaveIfNeeded();
  }

  async performAutoSave(): Promise<boolean> {
    try {
      const form = this.applicationInfoForm();
      if (!form.valid) {
        return false;
      }

      const loadedUser = this.accountService.loadedUser();
      if (loadedUser?.id == null) {
        this.toastService.showErrorKey('settings.applicationInformation.saveFailed');
        return false;
      }

      const data = this.data();

      // Build ApplicantDTO payload
      const applicantDTO: ApplicantDTO = {
        user: {
          userId: loadedUser.id,
          email: data.email || undefined,
          firstName: data.firstName || undefined,
          lastName: data.lastName || undefined,
          phoneNumber: data.phoneNumber || undefined,
          gender: data.gender?.value as string | undefined,
          nationality: data.nationality?.value as string | undefined,
          birthday: data.dateOfBirth || undefined,
          website: data.website || undefined,
          linkedinUrl: data.linkedIn || undefined,
        },
        street: data.street || undefined,
        postalCode: data.postcode || undefined,
        city: data.city || undefined,
        country: data.country?.value as string | undefined,
        bachelorDegreeName: undefined,
        bachelorGradeUpperLimit: undefined,
        bachelorGradeLowerLimit: undefined,
        bachelorGrade: undefined,
        bachelorUniversity: undefined,
        masterDegreeName: undefined,
        masterGradeUpperLimit: undefined,
        masterGradeLowerLimit: undefined,
        masterGrade: undefined,
        masterUniversity: undefined,
      };

      await firstValueFrom(this.applicantApi.updateApplicantPersonalInformation(applicantDTO));
      this.loadedProfile.update(current => (current != null ? { ...current, ...applicantDTO } : current));
      this.initialDataSnapshot.set(this.toSnapshot(this.data()));
      return true;
    } catch {
      this.toastService.showErrorKey('settings.applicationInformation.saveFailed');
      return false;
    }
  }

  onAiDataExtracted(extractedData: ExtractedApplicationDataDTO): void {
    const form = this.applicationInfoForm();
    const patch: Record<string, string> = {};

    setIfEmpty(form, patch, 'firstName', extractedData.firstName);
    setIfEmpty(form, patch, 'lastName', extractedData.lastName);
    setIfEmpty(form, patch, 'phoneNumber', extractedData.phoneNumber);
    setIfEmpty(form, patch, 'website', extractedData.website);
    setIfEmpty(form, patch, 'linkedIn', extractedData.linkedinUrl);
    setIfEmpty(form, patch, 'street', extractedData.street);
    setIfEmpty(form, patch, 'city', extractedData.city);
    setIfEmpty(form, patch, 'postcode', extractedData.postalCode);

    form.patchValue(patch);
  }

  private toSnapshot(data: ApplicationInformationData): ApplicationInformationSnapshot {
    return {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phoneNumber: data.phoneNumber,
      gender: data.gender?.value,
      nationality: data.nationality?.value,
      dateOfBirth: data.dateOfBirth,
      website: data.website,
      linkedIn: data.linkedIn,
      street: data.street,
      city: data.city,
      country: data.country?.value,
      postcode: data.postcode,
    };
  }

  private revealPostcodeCountryMismatch(): void {
    const postcodeControl = this.applicationInfoForm().controls.postcode;
    postcodeControl.updateValueAndValidity({ emitEvent: false });
    if (postcodeControl.hasError('invalidPostalCode')) {
      postcodeControl.markAsTouched();
    }
  }

  private queueAutoSaveIfNeeded(): void {
    if (this.initialDataSnapshot() === undefined) {
      return;
    }

    const form = this.applicationInfoForm();
    this.isValid.set(form.valid);
    if (form.valid && this.hasChanges()) {
      this.autoSave.notifyChanged();
      return;
    }

    this.autoSave.reset();
  }
}
