import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ApplicantResourceApi } from 'app/generated/api/applicant-resource-api';
import { ToastService } from 'app/service/toast-service';
import { CommonModule } from '@angular/common';
import { ApplicantDTO } from 'app/generated/model/applicant-dto';
import { ApplicationDocumentIdsDTO } from 'app/generated/model/application-document-ids-dto';
import { AccountService } from 'app/core/auth/account.service';
import { debounceTime, distinctUntilChanged, firstValueFrom, map } from 'rxjs';
import { DocumentInformationHolderDTO } from 'app/generated/model/document-information-holder-dto';
import { toSignal } from '@angular/core/rxjs-interop';
import { DialogService } from 'primeng/dynamicdialog';
import { SavingState } from 'app/shared/constants/saving-states';
import { deepEqual } from 'app/core/util/deepequal-util';
import {
  GradingScaleLimitsResult,
  getDetectedGradeLimitsPatch,
  getGradeHelperText,
  getGradeWarningText,
  resolveGradingScaleLimits,
} from 'app/shared/util/grading-scale.utils';
import { GradingScaleEditDialogComponent } from 'app/application/application-creation/application-creation-page2/grading-scale-edit-dialog/grading-scale-edit-dialog';
import { DegreeDocumentSectionComponent } from 'app/shared/components/molecules/degree-document-section/degree-document-section.component';
import { ExtractedApplicationDataDTO } from 'app/generated/model/extracted-application-data-dto';
import { setIfEmpty } from 'app/shared/components/molecules/ai-extraction-box/ai-extraction-box.component';
import { AutoSaveController } from 'app/shared/util/auto-save-controller';

import { UploadButtonComponent } from '../../components/atoms/upload-button/upload-button.component';
import { SavingBadgeComponent } from '../../components/atoms/saving-badge/saving-badge.component';
import { StickyFooterShellComponent } from '../../components/molecules/sticky-footer-shell/sticky-footer-shell.component';
import TranslateDirective from '../../language/translate.directive';

interface NormalizedSettingsQualificationsFormValue {
  bachelorDegreeName: string;
  bachelorDegreeUniversity: string;
  bachelorGradeUpperLimit: string;
  bachelorGradeLowerLimit: string;
  bachelorGrade: string;
  masterDegreeName: string;
  masterDegreeUniversity: string;
  masterGradeUpperLimit: string;
  masterGradeLowerLimit: string;
  masterGrade: string;
}

@Component({
  selector: 'jhi-settings-qualifications',
  standalone: true,
  imports: [
    CommonModule,
    DegreeDocumentSectionComponent,
    DividerModule,
    ReactiveFormsModule,
    TranslateModule,
    TooltipModule,
    FontAwesomeModule,
    UploadButtonComponent,
    TranslateDirective,
    SavingBadgeComponent,
    StickyFooterShellComponent,
  ],
  templateUrl: './settings-qualifications.component.html',
})
export class SettingsQualificationsComponent {
  fb = inject(FormBuilder);

  form = this.fb.group({
    bachelorDegreeName: [''],
    bachelorDegreeUniversity: [''],
    bachelorGradeUpperLimit: [''],
    bachelorGradeLowerLimit: [''],
    bachelorGrade: [''],
    masterDegreeName: [''],
    masterDegreeUniversity: [''],
    masterGradeUpperLimit: [''],
    masterGradeLowerLimit: [''],
    masterGrade: [''],
  });

  // Document tracking for upload components
  bachelorDocuments = signal<DocumentInformationHolderDTO[] | undefined>(undefined);
  masterDocuments = signal<DocumentInformationHolderDTO[] | undefined>(undefined);
  referenceDocuments = signal<DocumentInformationHolderDTO[] | undefined>(undefined);

  // Placeholder ID to render the same upload UI structure as application page 2.
  readonly uploadHostId = '00000000-0000-0000-0000-000000000000';

  hasLoaded = signal(false);
  hasInitialLimitsSet = signal(false);
  bachelorGradeLimits = signal<GradingScaleLimitsResult>(null);
  masterGradeLimits = signal<GradingScaleLimitsResult>(null);
  lastBachelorGrade = signal<string>(this.form.controls.bachelorGrade.value ?? '');
  lastMasterGrade = signal<string>(this.form.controls.masterGrade.value ?? '');
  initialFormValue = signal(this.form.getRawValue());
  hasFormChanges = computed(() => this.hasLoaded() && !deepEqual(this.normalizedFormValue(), this.initialFormValue()));
  savingState = computed<SavingState>(() => this.autoSave.state());
  hasChanges = computed(() => this.hasFormChanges());

  helperTextBachelorGrade = computed(() => getGradeHelperText(this.bachelorGradeLimits()));
  helperTextBachelorGradeKey = computed(() => this.helperTextBachelorGrade()?.key ?? '');
  helperTextBachelorGradeParams = computed(() => this.helperTextBachelorGrade()?.params ?? {});

  helperTextMasterGrade = computed(() => getGradeHelperText(this.masterGradeLimits()));
  helperTextMasterGradeKey = computed(() => this.helperTextMasterGrade()?.key ?? '');
  helperTextMasterGradeParams = computed(() => this.helperTextMasterGrade()?.params ?? {});

  warningTextBachelorGrade = computed(() => {
    this.currentLang();
    const grade = this.bachelorGradeValue() ?? '';
    return getGradeWarningText(this.translateService, grade);
  });

  warningTextMasterGrade = computed(() => {
    this.currentLang();
    const grade = this.masterGradeValue() ?? '';
    return getGradeWarningText(this.translateService, grade);
  });

  private readonly autoSave = new AutoSaveController({ save: () => this.performAutoSave() });
  private applicantApi = inject(ApplicantResourceApi);
  private toastService = inject(ToastService);
  private accountService = inject(AccountService);
  private translateService = inject(TranslateService);
  private dialogService = inject(DialogService);

  private currentLang = toSignal(this.translateService.onLangChange);
  private formChangeTick = toSignal(this.form.valueChanges.pipe(map(() => Date.now())), { initialValue: 0 });

  private bachelorGradeValue = toSignal(this.form.controls.bachelorGrade.valueChanges.pipe(debounceTime(500), distinctUntilChanged()));
  private masterGradeValue = toSignal(this.form.controls.masterGrade.valueChanges.pipe(debounceTime(500), distinctUntilChanged()));

  private bachelorGradeEffect = effect(() => {
    if (!this.hasInitialLimitsSet()) return;

    const grade = this.bachelorGradeValue();
    if (grade == null) return;
    if (grade === this.lastBachelorGrade()) return;
    this.updateBachelorGradeLimits(grade);
  });

  private masterGradeEffect = effect(() => {
    if (!this.hasInitialLimitsSet()) return;

    const grade = this.masterGradeValue();
    if (grade == null) return;
    if (grade === this.lastMasterGrade()) return;
    this.updateMasterGradeLimits(grade);
  });

  private autoSaveEffect = effect(() => {
    if (!this.hasLoaded()) return;
    if (!this.hasChanges()) return;
    this.autoSave.notifyChanged();
  });

  constructor() {
    void this.loadProfile();
  }

  onChangeGradingScale(gradeType: 'bachelor' | 'master'): void {
    const currentUpperLimit =
      gradeType === 'bachelor'
        ? (this.form.get('bachelorGradeUpperLimit')?.value ?? '')
        : (this.form.get('masterGradeUpperLimit')?.value ?? '');

    const currentLowerLimit =
      gradeType === 'bachelor'
        ? (this.form.get('bachelorGradeLowerLimit')?.value ?? '')
        : (this.form.get('masterGradeLowerLimit')?.value ?? '');

    const dialogRef = this.dialogService.open(GradingScaleEditDialogComponent, {
      header: this.translateService.instant('entity.applicationPage2.helperText.changeScale'),
      width: '40rem',
      style: { background: 'var(--color-background-default)' },
      closable: true,
      draggable: false,
      modal: true,
      data: {
        gradeType,
        currentGrade: gradeType === 'bachelor' ? this.form.get('bachelorGrade')?.value : this.form.get('masterGrade')?.value,
        currentUpperLimit,
        currentLowerLimit,
      },
    });

    dialogRef?.onClose.subscribe((result?: { upperLimit: string; lowerLimit: string }) => {
      if (!result) return;
      if (gradeType === 'bachelor') {
        this.form.patchValue({
          bachelorGradeUpperLimit: result.upperLimit,
          bachelorGradeLowerLimit: result.lowerLimit,
        });
        this.bachelorGradeLimits.set({ upperLimit: result.upperLimit, lowerLimit: result.lowerLimit });
      } else {
        this.form.patchValue({
          masterGradeUpperLimit: result.upperLimit,
          masterGradeLowerLimit: result.lowerLimit,
        });
        this.masterGradeLimits.set({ upperLimit: result.upperLimit, lowerLimit: result.lowerLimit });
      }
    });
  }

  async performAutoSave(): Promise<boolean> {
    if (!this.hasChanges()) {
      return true;
    }

    try {
      const loadedUser = this.accountService.loadedUser();
      if (loadedUser?.id == null || loadedUser.id === '') {
        this.toastService.showErrorKey('settings.qualifications.saveFailed');
        return false;
      }

      const applicantDTO: ApplicantDTO = {
        user: {
          userId: loadedUser.id,
          email: undefined,
          firstName: undefined,
          lastName: undefined,
          phoneNumber: undefined,
          gender: undefined,
          nationality: undefined,
          birthday: undefined,
          website: undefined,
          linkedinUrl: undefined,
        },
        street: undefined,
        postalCode: undefined,
        city: undefined,
        country: undefined,
        bachelorDegreeName: this.form.get('bachelorDegreeName')?.value ?? undefined,
        bachelorUniversity: this.form.get('bachelorDegreeUniversity')?.value ?? undefined,
        bachelorGradeUpperLimit: this.form.get('bachelorGradeUpperLimit')?.value ?? undefined,
        bachelorGradeLowerLimit: this.form.get('bachelorGradeLowerLimit')?.value ?? undefined,
        bachelorGrade: this.form.get('bachelorGrade')?.value ?? undefined,
        masterDegreeName: this.form.get('masterDegreeName')?.value ?? undefined,
        masterUniversity: this.form.get('masterDegreeUniversity')?.value ?? undefined,
        masterGradeUpperLimit: this.form.get('masterGradeUpperLimit')?.value ?? undefined,
        masterGradeLowerLimit: this.form.get('masterGradeLowerLimit')?.value ?? undefined,
        masterGrade: this.form.get('masterGrade')?.value ?? undefined,
      };

      await firstValueFrom(this.applicantApi.updateApplicantDocumentSettings(applicantDTO));
      this.initialFormValue.set(this.normalizedFormValue());
      return true;
    } catch {
      this.toastService.showErrorKey('settings.qualifications.saveFailed');
      return false;
    }
  }

  onAiDataExtracted(extractedData: ExtractedApplicationDataDTO): void {
    const form = this.form;
    const patch: Record<string, string> = {};

    const edu = extractedData.education;
    if (edu) {
      setIfEmpty(form, patch, 'bachelorDegreeName', edu.bachelorDegreeName);
      setIfEmpty(form, patch, 'bachelorDegreeUniversity', edu.bachelorUniversity);
      setIfEmpty(form, patch, 'bachelorGrade', edu.bachelorGrade);
      setIfEmpty(form, patch, 'masterDegreeName', edu.masterDegreeName);
      setIfEmpty(form, patch, 'masterDegreeUniversity', edu.masterUniversity);
      setIfEmpty(form, patch, 'masterGrade', edu.masterGrade);
    }

    form.patchValue(patch);
  }

  // Loads the persisted profile + document state and resets the change-tracking baseline to that backend snapshot.
  private async loadProfile(): Promise<void> {
    try {
      this.hasInitialLimitsSet.set(false);

      const profile = await firstValueFrom(this.applicantApi.getApplicantProfile());
      const profileDocumentIds = await firstValueFrom(this.applicantApi.getApplicantProfileDocumentIds());
      this.applyProfileDocumentIds(profileDocumentIds);

      this.form.patchValue({
        bachelorDegreeName: profile.bachelorDegreeName ?? '',
        bachelorDegreeUniversity: profile.bachelorUniversity ?? '',
        bachelorGradeUpperLimit: profile.bachelorGradeUpperLimit ?? '',
        bachelorGradeLowerLimit: profile.bachelorGradeLowerLimit ?? '',
        bachelorGrade: profile.bachelorGrade ?? '',
        masterDegreeName: profile.masterDegreeName ?? '',
        masterDegreeUniversity: profile.masterUniversity ?? '',
        masterGradeUpperLimit: profile.masterGradeUpperLimit ?? '',
        masterGradeLowerLimit: profile.masterGradeLowerLimit ?? '',
        masterGrade: profile.masterGrade ?? '',
      });

      const bachelorGrade = profile.bachelorGrade ?? '';
      const masterGrade = profile.masterGrade ?? '';
      this.lastBachelorGrade.set(bachelorGrade);
      this.lastMasterGrade.set(masterGrade);

      if (bachelorGrade !== '') {
        this.bachelorGradeLimits.set(
          resolveGradingScaleLimits(bachelorGrade, {
            upperLimit: profile.bachelorGradeUpperLimit,
            lowerLimit: profile.bachelorGradeLowerLimit,
          }),
        );
      } else {
        this.bachelorGradeLimits.set(null);
      }

      if (masterGrade !== '') {
        this.masterGradeLimits.set(
          resolveGradingScaleLimits(masterGrade, {
            upperLimit: profile.masterGradeUpperLimit,
            lowerLimit: profile.masterGradeLowerLimit,
          }),
        );
      } else {
        this.masterGradeLimits.set(null);
      }

      this.hasInitialLimitsSet.set(true);
      this.initialFormValue.set(this.normalizedFormValue());
      this.hasLoaded.set(true);
    } catch {
      this.toastService.showErrorKey('settings.qualifications.loadFailed');
    }
  }

  private updateBachelorGradeLimits(grade: string): void {
    this.lastBachelorGrade.set(grade);
    const limits = getDetectedGradeLimitsPatch(grade);
    this.bachelorGradeLimits.set(resolveGradingScaleLimits(grade));

    this.form.patchValue({
      bachelorGradeUpperLimit: limits.upperLimit,
      bachelorGradeLowerLimit: limits.lowerLimit,
    });
  }

  private updateMasterGradeLimits(grade: string): void {
    this.lastMasterGrade.set(grade);
    const limits = getDetectedGradeLimitsPatch(grade);
    this.masterGradeLimits.set(resolveGradingScaleLimits(grade));

    this.form.patchValue({
      masterGradeUpperLimit: limits.upperLimit,
      masterGradeLowerLimit: limits.lowerLimit,
    });
  }

  private normalizedFormValue(): NormalizedSettingsQualificationsFormValue {
    this.formChangeTick();
    const value = this.form.getRawValue();
    return {
      bachelorDegreeName: value.bachelorDegreeName ?? '',
      bachelorDegreeUniversity: value.bachelorDegreeUniversity ?? '',
      bachelorGradeUpperLimit: value.bachelorGradeUpperLimit ?? '',
      bachelorGradeLowerLimit: value.bachelorGradeLowerLimit ?? '',
      bachelorGrade: value.bachelorGrade ?? '',
      masterDegreeName: value.masterDegreeName ?? '',
      masterDegreeUniversity: value.masterDegreeUniversity ?? '',
      masterGradeUpperLimit: value.masterGradeUpperLimit ?? '',
      masterGradeLowerLimit: value.masterGradeLowerLimit ?? '',
      masterGrade: value.masterGrade ?? '',
    };
  }

  private applyProfileDocumentIds(documentIds: ApplicationDocumentIdsDTO): void {
    this.bachelorDocuments.set(documentIds.bachelorDocumentIds ?? []);
    this.masterDocuments.set(documentIds.masterDocumentIds ?? []);
    this.referenceDocuments.set(documentIds.referenceDocumentIds ?? []);
  }
}
