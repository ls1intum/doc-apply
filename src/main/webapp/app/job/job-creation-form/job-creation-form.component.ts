import { CommonModule, Location } from '@angular/common';
import { Component, TemplateRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { Language, TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { DividerModule } from 'primeng/divider';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CheckboxModule } from 'primeng/checkbox';
import { TooltipModule } from 'primeng/tooltip';
import { TranslateDirective } from 'app/shared/language';
import { ProgressStepperComponent, StepData } from 'app/shared/components/molecules/progress-stepper/progress-stepper.component';
import { ButtonColor, ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';
import { DialogComponent } from 'app/shared/components/atoms/dialog/dialog.component';
import { EditorComponent } from 'app/shared/components/atoms/editor/editor.component';
import { DatePickerComponent } from 'app/shared/components/atoms/datepicker/datepicker.component';
import { StringInputComponent } from 'app/shared/components/atoms/string-input/string-input.component';
import { SelectComponent } from 'app/shared/components/atoms/select/select.component';
import { NumberInputComponent } from 'app/shared/components/atoms/number-input/number-input.component';
import { ProgressSpinnerComponent } from 'app/shared/components/atoms/progress-spinner/progress-spinner.component';
import { InfoBoxComponent } from 'app/shared/components/atoms/info-box/info-box.component';
import { InfoIconComponent } from 'app/shared/components/atoms/info-icon/info-icon.component';
import { MessageComponent } from 'app/shared/components/atoms/message/message.component';
import { SegmentedToggleComponent, SegmentedToggleValue } from 'app/shared/components/atoms/segmented-toggle/segmented-toggle.component';
import { SavingStates } from 'app/shared/constants/saving-states';
import { AutoSaveController } from 'app/shared/util/auto-save-controller';
import { SavingBadgeComponent } from 'app/shared/components/atoms/saving-badge/saving-badge.component';
import { htmlTextMaxLengthValidator, htmlTextRequiredValidator } from 'app/shared/validators/custom-validators';
import { INVALID_DATE_ORDER_ERROR, dateOrderValidator } from 'app/shared/validators/date-order-validator';
import { AiResourceApi } from 'app/generated/api/ai-resource-api';
import { UserResourceApi } from 'app/generated/api/user-resource-api';
import { AiStreamingService } from 'app/service/ai-streaming.service';
import { AiFeatureStatusService } from 'app/service/ai-feature-status.service';
import { AccountService } from 'app/core/auth/account.service';
import { ToastService } from 'app/service/toast-service';
import { JobResourceApi } from 'app/generated/api/job-resource-api';
import { JobFormDTO, JobFormDTOTvlGradeEnum } from 'app/generated/model/job-form-dto';
import { JobDTO } from 'app/generated/model/job-dto';
import { ImageResourceApi } from 'app/generated/api/image-resource-api';
import { ImageDTO } from 'app/generated/model/image-dto';
import { ResearchGroupResourceApi } from 'app/generated/api/research-group-resource-api';
import { parseLocalDateString } from 'app/shared/util/date-time.util';
import { extractCompleteHtmlTags, unescapeJsonString } from 'app/shared/util/util';
import { extractTextFromHtml } from 'app/shared/util/text.util';
import {
  ImageUploadButtonComponent,
  ImageUploadError,
} from 'app/shared/components/atoms/image-upload-button/image-upload-button.component';
import { CheckboxComponent } from 'app/shared/components/atoms/checkbox/checkbox.component';
import {
  JobFormDTOFundingTypeEnum,
  JobFormDTOLocationEnum,
  JobFormDTOStateEnum,
  JobFormDTOSubjectAreaEnum,
} from 'app/generated/model/job-form-dto';
import { AiAssistantCardComponent } from 'app/shared/components/molecules/ai-assistant-card/ai-assistant-card.component';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';
import { RecommendationType } from 'app/generated/model/recommendation-type';
import { ComplianceIssue, ComplianceIssueCategoryEnum } from 'app/generated/model/compliance-issue';
import { CompliancePopoverComponent } from 'app/shared/components/molecules/ai-compliance-popover/ai-compliance-popover.component';

import { JobDetailComponent } from '../job-detail/job-detail.component';
import * as DropdownOptions from '.././dropdown-options';
import { tvlGrades } from '.././dropdown-options';

/** Represents the mode of the job creation form: creating a new job or editing an existing one */
type JobFormMode = 'create' | 'edit';

const REFERENCE_LETTERS_REQUIRED_OPTIONS: { value: number; name: string }[] = [0, 1, 2, 3, 4, 5].map(n => ({
  value: n,
  name: String(n),
}));

const DEFAULT_RECOMMENDATION_TYPE_OPTION =
  DropdownOptions.recommendationTypes.find(option => option.value === RecommendationType.LetterAndEvaluation) ??
  DropdownOptions.recommendationTypes[0];

/**
 * JobCreationFormComponent
 *
 * A multi-step form for creating and editing job postings.
 * Features:
 * - 4-step form wizard (Basic Info → Position Details → Image Selection → Summary)
 * - Dual-language support (EN/DE) with automatic AI translation
 * - AI-powered job description generation
 * - Auto-save functionality with 2-second debounce
 * - Image upload and selection for job banners
 *
 */
@Component({
  selector: 'jhi-job-creation-form',
  standalone: true,
  templateUrl: './job-creation-form.component.html',
  styleUrls: ['./job-creation-form.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    FontAwesomeModule,
    DatePickerComponent,
    StringInputComponent,
    ProgressStepperComponent,
    TranslateModule,
    TranslateDirective,
    SelectComponent,
    NumberInputComponent,
    EditorComponent,
    ConfirmDialog,
    DialogComponent,
    JobDetailComponent,
    DividerModule,
    ButtonComponent,
    ProgressSpinnerModule,
    CheckboxModule,
    ProgressSpinnerComponent,
    InfoBoxComponent,
    InfoIconComponent,
    MessageComponent,
    SegmentedToggleComponent,
    ImageUploadButtonComponent,
    CheckboxComponent,
    AiAssistantCardComponent,
    CompliancePopoverComponent,
    TooltipModule,
    SavingBadgeComponent,
  ],
  providers: [JobResourceApi],
})
export class JobCreationFormComponent {
  /* eslint-disable @typescript-eslint/member-ordering */

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════
  readonly publishButtonSeverity = 'primary' as ButtonColor;
  readonly publishButtonIcon = 'paper-plane';
  readonly stepContainerClass = 'mx-auto w-full max-w-4xl px-4 sm:px-5 md:px-6 lg:px-8 xl:px-10';
  /** Width of the compliance popover, used to clamp its position within the viewport.
   * matches the width w-72 set in ai-compliance-popover.component.html.
   */
  private readonly POPOVER_WIDTH = 288;

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE & META SIGNALS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Current form mode: 'create' for new jobs, 'edit' for existing jobs */
  mode = signal<JobFormMode>('create');

  jobId = signal<string>('');

  userId = signal<string>('');

  isLoading = signal<boolean>(true);

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVING STATE SIGNALS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Debounced auto-save controller. Owns the 3 s timer and the badge state. */
  readonly autoSave = new AutoSaveController({ save: () => this.runAutoSave() });

  /** Snapshot of the last successfully saved job data (used for change detection) */
  lastSavedData = signal<JobFormDTO | undefined>(undefined);

  // ═══════════════════════════════════════════════════════════════════════════
  // JOB DESCRIPTION SIGNALS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Current content of the job description editor */
  jobDescriptionSignal = signal<string>('');

  /** Currently selected language tab for the job description editor */
  currentDescriptionLanguage = signal<Language>('en');

  /** Stores the English version of the job description */
  jobDescriptionEN = signal<string>('');

  /** Stores the German version of the job description */
  jobDescriptionDE = signal<string>('');

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSLATION STATE SIGNALS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Indicates whether AI translation is in progress */
  isTranslating = signal<boolean>(false);

  /** The target language of the active translation, or undefined if idle */
  translationTargetLang = signal<Language | undefined>(undefined);

  /** Whether the editor currently shows the language being translated (AI-streamed content). */
  readonly isViewingTranslationTarget = computed(
    () => this.isTranslating() && this.translationTargetLang() === this.currentDescriptionLanguage(),
  );

  /** AbortController for cancelling active translation streams */
  private translationAbortController: AbortController | undefined;

  /** Last successfully translated English text (used to avoid redundant translations) */
  lastTranslatedEN = signal<string>('');

  /** Last successfully translated German text (used to avoid redundant translations) */
  lastTranslatedDE = signal<string>('');

  /** Tracks the currently in-flight translation request to deduplicate identical calls. */
  private activeTranslationRequest: { sourceLang: Language; sourceText: string; targetLang: Language } | undefined;

  /** Last analyzed description text per language (used to avoid redundant compliance analysis) */
  private lastAnalyzedText: Record<string, string> = {};

  // ═══════════════════════════════════════════════════════════════════════════
  // AI GENERATION SIGNALS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Indicates whether AI is currently generating a job description draft */
  isGeneratingDraft = signal<boolean>(false);

  /** Controls visibility of the AI generation panel and AI translation invocation, synced with user settings */
  aiToggleSignal = signal<boolean>(true);

  /** Tracks if the rewrite button should be shown (after first generation) */
  rewriteButtonSignal = signal<boolean>(false);

  /** Computed: returns the placeholder key based on the editor's language toggle (not app locale) */
  jobDescriptionPlaceholder = computed(() =>
    this.currentDescriptionLanguage() === 'en'
      ? 'jobCreationForm.positionDetailsSection.jobDescription.placeholderEN'
      : 'jobCreationForm.positionDetailsSection.jobDescription.placeholderDE',
  );

  /** Computed: direction labels shown during translation (e.g. "EN → DE") */
  translationDirectionLabels = computed(() => {
    const target = this.translationTargetLang();
    if (!target) return null;
    return {
      source: target === 'de' ? 'EN' : 'DE',
      target: target === 'de' ? 'DE' : 'EN',
    };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // IMAGE UPLOAD SIGNALS
  // ═══════════════════════════════════════════════════════════════════════════

  /** List of default job banner images provided by the system */
  defaultImages = signal<ImageDTO[]>([]);

  /** List of custom images uploaded by the research group */
  researchGroupImages = signal<ImageDTO[]>([]);

  /** Currently selected image for the job banner */
  selectedImage = signal<ImageDTO | undefined>(undefined);

  /** Indicates whether an image upload is in progress */
  isUploadingImage = signal<boolean>(false);

  /** Computed: checks if the selected image is a custom upload (not a default) */
  hasCustomImage = computed(() => {
    const image = this.selectedImage();
    return image !== undefined && image.imageType !== 'DEFAULT_JOB_BANNER';
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DEPENDENCY INJECTION
  // ═══════════════════════════════════════════════════════════════════════════

  private fb = inject(FormBuilder);
  private jobApi = inject(JobResourceApi);
  private imageApi = inject(ImageResourceApi);
  private accountService = inject(AccountService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  private toastService = inject(ToastService);
  private aiApi = inject(AiResourceApi);
  private userApi = inject(UserResourceApi);
  private aiStreamingService = inject(AiStreamingService);
  private aiFeatureStatusService = inject(AiFeatureStatusService);
  private researchGroupApi = inject(ResearchGroupResourceApi);

  // ═══════════════════════════════════════════════════════════════════════════
  // AI SIGNALS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Whether AI features are available system-wide (kill switch / circuit breaker). */
  readonly aiSystemEnabled = this.aiFeatureStatusService.aiSystemEnabled;

  /** Whether AI is currently unavailable because the circuit breaker is open. */
  readonly aiCircuitBreakerOpen = this.aiFeatureStatusService.circuitBreakerOpen;

  /** Score shown in the AI sidebar (undefined = not yet calculated) */
  readonly aiScore = signal<number | undefined>(undefined);

  /** Whether compliance analysis is currently running */
  readonly isAnalyzing = signal(false);

  /** Whether score-affecting processing is active (translation, analysis, or generation) */
  readonly isScoreProcessing = computed(() => this.isGeneratingDraft() || this.isTranslating() || this.isAnalyzing());

  /** List of detected compliance issues to update the UI and editor highlights */
  readonly complianceIssues = signal<ComplianceIssue[]>([]);

  /** Total number of compliance issues */
  readonly complianceCount = computed(() => this.complianceIssues().length);

  /** Total number of critical compliance issues */
  readonly complianceCriticalCount = computed(
    () => this.complianceIssues().filter(i => i.category === ComplianceIssueCategoryEnum.CriticalAgg).length,
  );

  /** Whether any critical compliance issue exists */
  readonly hasCriticalCompliance = computed(() => this.complianceCriticalCount() > 0);

  /** The compliance issue currently shown in the popover (undefined = none is hovered). */
  readonly activePopoverIssue = signal<ComplianceIssue | undefined>(undefined);

  /** Horizontal screen position of popover. */
  readonly popoverX = signal<number>(0);

  /** Vertical screen position of popover. */
  readonly popoverY = signal<number>(0);

  /** When set, only issues of this category are highlighted in the editor. (undefined = all categories shown) */
  readonly activeComplianceFilter = signal<string | undefined>(undefined);

  /** Returns the explanation of a compliance issue whose text appears in the job title, if any. */
  readonly titleComplianceError = computed(() => {
    this.basicInfoFormValueSignal();
    const title = (this.basicInfoForm.get('title')?.value ?? '').toLowerCase();
    if (!title) return undefined;
    for (const issue of this.complianceIssues()) {
      if (issue.text && title.includes(issue.text.toLowerCase())) {
        return issue.explanation;
      }
    }
    return undefined;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FORM GROUPS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Step 1: Basic job information (title, research area, field, location, description) */
  basicInfoForm = this.createBasicInfoForm();

  /** Step 2: Position details (funding, dates, workload, contract duration) */
  positionDetailsForm = this.createPositionDetailsForm();

  /** Step 3: Image selection for job banner */
  imageForm = this.createImageForm();

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATE REFERENCES (ViewChild)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Template for Step 1: Basic Info panel */
  panel1 = viewChild<TemplateRef<HTMLDivElement>>('panel1');

  /** Template for Step 2: Position Details panel */
  panel2 = viewChild<TemplateRef<HTMLDivElement>>('panel2');

  /** Template for Step 3: Image Selection panel */
  panel3 = viewChild<TemplateRef<HTMLDivElement>>('panel3');

  /** Template for Step 4: Summary/Preview panel */
  panel4 = viewChild<TemplateRef<HTMLDivElement>>('panel4');

  /** Template for the saving state indicator */
  savingStatePanel = viewChild<TemplateRef<HTMLDivElement>>('savingStatePanel');

  /** Reference to the progress stepper */
  stepper = viewChild<ProgressStepperComponent>('stepper');

  /** Signal controlling publish confirmation dialog visibility */
  showPublishDialog = signal(false);

  /** Signal controlling AI info dialog visibility */
  aiInfoDialogVisible = signal(false);

  /** Reference to the job description rich-text editor */
  jobDescriptionEditor = viewChild<EditorComponent>('jobDescriptionEditor');

  // ═══════════════════════════════════════════════════════════════════════════
  // FORM VALIDITY SIGNALS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Tracks validity of Step 1 (Basic Info) */
  basicInfoValid = signal(false);

  /** Tracks validity of Step 2 (Position Details) */
  positionDetailsValid = signal(false);

  /** Computed: true when all required forms are valid */
  allFormsValid = computed(() => this.basicInfoValid() && this.positionDetailsValid());

  /** Computed: true when an image has been selected */
  imageSelected = computed(() => this.selectedImage() !== undefined);

  // ═══════════════════════════════════════════════════════════════════════════
  // REACTIVE FORM STATUS SIGNALS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Signal that emits when basicInfoForm status changes */
  basicInfoChanges = toSignal(this.basicInfoForm.statusChanges, { initialValue: this.basicInfoForm.status });

  /** Signal that emits when positionDetailsForm status changes */
  positionDetailsChanges = toSignal(this.positionDetailsForm.statusChanges, { initialValue: this.positionDetailsForm.status });

  /** Computed: true when both EN and DE job descriptions have non-empty text content
   * and neither matches the default template text.
   * Uses jobDescriptionSignal for the active language (updates on every keystroke)
   * and the stored signal for the inactive language (synced on tab switch / save).
   * Strips HTML tags before checking so that empty editor markup (e.g. `<p></p>`) is treated as empty. */
  bothDescriptionsFilled = computed(() => {
    const currentLang = this.currentDescriptionLanguage();
    const currentHtml = this.jobDescriptionSignal() || '';

    // 1) Resolve current HTML for both languages
    const enHtml = currentLang === 'en' ? currentHtml : this.jobDescriptionEN();
    const deHtml = currentLang === 'de' ? currentHtml : this.jobDescriptionDE();

    // Helper to completely strip ALL whitespace, newlines, and non-breaking spaces for a strict comparison
    const stripAllWhitespace = (str: string): string => (str || '').replace(/[\s\u00A0\n\r]+/g, '');

    // 2) Extract plain text from the user's input
    const enText = stripAllWhitespace(extractTextFromHtml(enHtml));
    const deText = stripAllWhitespace(extractTextFromHtml(deHtml));

    // 3) Fetch default templates and extract their plain text
    const templateEnHtml = this.translate.instant('jobCreationForm.positionDetailsSection.jobDescription.templateEN') as string;
    const templateDeHtml = this.translate.instant('jobCreationForm.positionDetailsSection.jobDescription.templateDE') as string;

    const templateEnText = stripAllWhitespace(extractTextFromHtml(templateEnHtml));
    const templateDeText = stripAllWhitespace(extractTextFromHtml(templateDeHtml));

    // 4) Validate that text exists and does not exactly match the template
    const isEnValid = enText.length > 0 && enText !== templateEnText;
    const isDeValid = deText.length > 0 && deText !== templateDeText;

    return isEnValid && isDeValid;
  });

  /**
   * Effect: Updates validity signals whenever form status changes.
   * This keeps the stepper navigation buttons in sync with form state.
   */
  formValidationEffect = effect(() => {
    this.basicInfoChanges();
    this.positionDetailsChanges();
    this.jobDescriptionSignal();

    this.basicInfoValid.set(this.basicInfoForm.valid && this.bothDescriptionsFilled());
    this.positionDetailsValid.set(this.positionDetailsForm.valid);
  });

  /** Computed: Returns the job DTO ready for publishing, or undefined if forms are invalid */
  publishableJobData = computed<JobFormDTO | undefined>(() =>
    this.allFormsValid() ? this.createJobDTO(JobFormDTOStateEnum.Published) : undefined,
  );

  /** Computed: Detects if there are unsaved changes by comparing current data with last saved */
  hasUnsavedChanges = computed(() => {
    const current = this.currentJobData();
    const lastSaved = this.lastSavedData();
    return JSON.stringify(current) !== JSON.stringify(lastSaved);
  });

  /** Computed: Returns the appropriate page title translation key based on mode */
  readonly pageTitle = computed(() =>
    this.mode() === 'edit' ? 'jobCreationForm.header.title.edit' : 'jobCreationForm.header.title.create',
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // STEPPER CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Computed: Builds the configuration for the multi-step wizard.
   * Each step defines its panel template, navigation buttons, and validation state.
   */
  readonly stepData = computed<StepData[]>(() => this.buildStepData());

  // ═══════════════════════════════════════════════════════════════════════════
  // LANGUAGE TOGGLE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Computed: maps the current description language to the segmented toggle position */
  segmentValueForCurrentLang = computed<SegmentedToggleValue>(() => (this.currentDescriptionLanguage() === 'en' ? 'left' : 'right'));

  /**
   * Converts a segmented toggle value to the corresponding language code.
   *
   * @param toggleValue - The toggle position ('left' or 'right')
   * @returns 'en' for left, 'de' for right
   */
  langForSegmentValue(toggleValue: SegmentedToggleValue): Language {
    return toggleValue === 'left' ? 'en' : 'de';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSLATED DROPDOWN OPTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Signal that tracks the current UI language for dropdown translations */
  currentLang = toSignal(this.translate.onLangChange);

  /** Computed: Returns localized and sorted subject area options */
  translatedSubjectAreas = computed(() => {
    void this.currentLang();
    return DropdownOptions.subjectAreas
      .map(option => ({ value: option.value, name: this.translate.instant(option.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  /** Computed: Returns localized and sorted location options */
  translatedLocations = computed(() => {
    void this.currentLang();
    return DropdownOptions.locations
      .map(option => ({ value: option.value, name: this.translate.instant(option.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  /** Computed: Returns localized and sorted funding type options */
  translatedFundingTypes = computed(() => {
    void this.currentLang();
    return DropdownOptions.fundingTypes
      .map(option => ({ value: option.value, name: this.translate.instant(option.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  /** Computed: Returns localized recommendation type options (letter / evaluation / both), in fixed order */
  translatedRecommendationTypes = computed(() => {
    void this.currentLang();
    return DropdownOptions.recommendationTypes.map(option => ({ value: option.value, name: this.translate.instant(option.name) }));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPERVISING PROFESSOR OPTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Professors belonging to the current research group */
  supervisingProfessorOptions = signal<{ value: string; name: string }[]>([]);

  // ═══════════════════════════════════════════════════════════════════════════
  // FORM VALUE SIGNALS (for change detection)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Signal that emits the current basicInfoForm values */
  basicInfoFormValueSignal = toSignal(this.basicInfoForm.valueChanges, {
    initialValue: this.basicInfoForm.getRawValue(),
  });

  /** Signal that emits the current positionDetailsForm values */
  positionDetailsFormValueSignal = toSignal(this.positionDetailsForm.valueChanges, {
    initialValue: this.positionDetailsForm.getRawValue(),
  });

  /** Computed: whether the job asks for recommendations at all; controls the recommendation type select */
  readonly recommendationTypeVisible = computed(() => {
    const required = this.positionDetailsFormValueSignal().referenceLettersRequired as { value?: number } | undefined;
    return (required?.value ?? 0) > 0;
  });

  /** Computed: earliest selectable start date, based on the chosen application deadline */
  readonly startDateMinDate = computed(() => {
    const applicationDeadline = this.positionDetailsFormValueSignal().applicationDeadline;
    return parseLocalDateString(applicationDeadline);
  });

  /** Computed: latest selectable application deadline, based on the chosen start date */
  readonly applicationDeadlineMaxDate = computed(() => {
    const startDate = this.positionDetailsFormValueSignal().startDate;
    return parseLocalDateString(startDate);
  });

  /** Computed: true when start date is before the application deadline */
  readonly hasInvalidDateOrder = computed(() => {
    this.positionDetailsChanges();
    return this.positionDetailsForm.hasError(INVALID_DATE_ORDER_ERROR);
  });

  /** Signal that emits the current imageForm values */
  imageFormValueSignal = toSignal(this.imageForm.valueChanges, {
    initialValue: this.imageForm.getRawValue(),
  });

  /** Computed: Aggregates all form data into a JobFormDTO for saving */
  currentJobData = computed<JobFormDTO>(() => {
    this.basicInfoFormValueSignal();
    this.positionDetailsFormValueSignal();
    this.imageFormValueSignal();
    return this.createJobDTO(JobFormDTOStateEnum.Draft);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-SAVE INTERNALS
  // ═══════════════════════════════════════════════════════════════════════════

  /** The currently in-flight auto-save promise, or undefined if none is running. */
  private autoSaveInFlight: Promise<boolean> | undefined;

  /** Flag to prevent auto-save from triggering during initial form population */
  private autoSaveInitialized = false;

  private isAutoScrolling = false;

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  constructor() {
    void this.loadAiConsent();
    this.init();
    this.setupAutoSave();
  }

  /** Loads the user's AI consent preference from the server and applies it to the toggle. */
  private async loadAiConsent(): Promise<void> {
    try {
      const isEnabled = await firstValueFrom(this.userApi.getAiConsent());
      this.aiToggleSignal.set(isEnabled);
    } catch {
      this.toastService.showErrorKey('settings.aiFeatures.loadFailed');
    }
  }

  /**
   * Persists the AI consent toggle change to the server.
   * Reverts the toggle on failure.
   *
   * @param value - Whether AI features should be enabled
   */
  async onAiToggleChanged(value: boolean): Promise<void> {
    try {
      await firstValueFrom(this.userApi.updateAiConsent(value));
      this.aiToggleSignal.set(value);
    } catch {
      this.aiToggleSignal.set(!value);
      this.toastService.showErrorKey('settings.aiFeatures.saveFailed');
    }
  }

  /** Opens the AI features info dialog. */
  openAiInfoDialog(): void {
    this.aiInfoDialogVisible.set(true);
  }

  /** Aborts the active translation stream (if any) and resets translation state. */
  private cancelTranslation(): void {
    if (this.translationAbortController) {
      this.translationAbortController.abort();
      this.translationAbortController = undefined;
    }
    this.activeTranslationRequest = undefined;
    this.isTranslating.set(false);
    this.translationTargetLang.set(undefined);
  }

  /**
   * Clears the transient translation state for a run, but only when it is still
   * the active one. A newer translation that superseded this run owns the state.
   *
   * @param abortController - The AbortController created for this run
   * @param activeRequest - The dedup descriptor created for this run
   */
  private clearTranslationState(
    abortController: AbortController,
    activeRequest: { sourceLang: Language; sourceText: string; targetLang: Language },
  ): void {
    if (this.translationAbortController === abortController) {
      this.isTranslating.set(false);
      this.translationTargetLang.set(undefined);
      this.translationAbortController = undefined;
    }
    if (this.activeTranslationRequest === activeRequest) {
      this.activeTranslationRequest = undefined;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LANGUAGE SWITCHING METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Switches the job description editor to a different language tab.
   * Ensures pending saves are flushed before switching to prevent data loss.
   *
   * @param newLang - The target language ('en' or 'de')
   */
  changeDescriptionLanguage(newLang: Language): void {
    const currentLang = this.currentDescriptionLanguage();
    if (newLang === currentLang) return;

    // Only flush when there are unsaved edits. A pure view switch must not start
    // a save/translation cycle — otherwise toggling languages re-translates even
    // though the content never changed. When edits are pending, flushing runs
    // syncCurrentEditorIntoLanguageSignals to preserve them before the switch.
    if (this.autoSave.hasPending()) {
      void this.autoSave.flush();
    }

    this.currentDescriptionLanguage.set(newLang);
  }

  /**
   * Syncs the current editor content into the appropriate language signal (EN or DE).
   * Called before saving or switching languages to ensure no content is lost.
   */
  private syncCurrentEditorIntoLanguageSignals(): void {
    const lang = this.currentDescriptionLanguage();
    // Don't sync if viewing the translation target (editor shows AI-streamed content)
    if (this.isTranslating() && this.translationTargetLang() === lang) return;

    const description = this.basicInfoForm.get('jobDescription')?.value ?? '';
    if (lang === 'en') {
      this.jobDescriptionEN.set(description);
    } else {
      this.jobDescriptionDE.set(description);
    }
  }

  /**
   * Effect: Automatically updates the editor when the description language changes.
   * Loads the stored content for the selected language into the editor.
   */
  languageChangeEffect = effect(() => {
    const newLanguage = this.currentDescriptionLanguage();
    const translating = this.isTranslating();
    const translationTarget = this.translationTargetLang();
    if (!this.autoSaveInitialized) return;

    // If switching to a language that is currently being translated, show placeholder
    if (translating && translationTarget === newLanguage) {
      const placeholder = `<p><em>${this.translate.instant('jobCreationForm.positionDetailsSection.jobDescription.translatingPlaceholder') as string}</em></p>`;
      this.basicInfoForm.get('jobDescription')?.setValue('', { emitEvent: false });
      this.jobDescriptionSignal.set('');
      this.jobDescriptionEditor()?.forceUpdate(placeholder);
      return;
    }

    const targetContent = newLanguage === 'en' ? this.jobDescriptionEN() : this.jobDescriptionDE();

    this.basicInfoForm.get('jobDescription')?.setValue(targetContent, { emitEvent: false });
    this.jobDescriptionSignal.set(targetContent);
    this.jobDescriptionEditor()?.forceUpdate(targetContent, () => {
      this.applyHighlights(this.complianceIssues(), newLanguage);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLISH METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Publishes the job posting after validation.
   * Requires privacy consent and valid forms.
   * Navigates to the return route on success.
   *
   * Before sending the Published DTO, cancels any pending debounced autosave
   * and waits for an in-flight autosave to settle. Otherwise a Draft autosave
   * could land on the server *after* the publish call and silently revert the
   * job to Draft.
   */
  async publishJob(): Promise<void> {
    const jobData = this.publishableJobData();

    if (!jobData) return;

    this.autoSave.dispose();
    if (this.autoSaveInFlight) {
      await this.autoSaveInFlight;
    }

    try {
      const saved = await firstValueFrom(this.jobApi.updateJob(this.jobId(), jobData));
      // refresh local truth from server response
      this.applyServerJobForm(saved);
      this.toastService.showSuccessKey('toast.published');
      this.onBack();
    } catch {
      this.toastService.showErrorKey('toast.publishFailed');
    }
  }

  /**
   * Navigates back to the previous page in browser history.
   */
  onBack(): void {
    this.location.back();
  }

  /**
   * Navigate the stepper back to the first step.
   */
  private goToFirstStep(): void {
    this.stepper()?.goToStep(1);
  }

  /**
   * Handles clicks on the message to navigate back to the first step.
   * @param event - The DOM event triggered by the user
   */
  handleMessageClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (target.classList.contains('stepper-link')) {
      event.preventDefault();
      this.goToFirstStep();
    }
  }

  /**
   * Performs a save after changing the step.
   */
  async onStepChange(): Promise<void> {
    await this.autoSave.flush();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMAGE MANAGEMENT METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Handle successful image upload from the shared component
   */
  async onImageUploaded(uploadedImage: ImageDTO): Promise<void> {
    this.selectedImage.set(uploadedImage);
    this.imageForm.patchValue({ imageId: uploadedImage.imageId });

    try {
      const researchGroupImages = await firstValueFrom(this.imageApi.getResearchGroupJobBanners());
      this.researchGroupImages.set(researchGroupImages);
    } catch {
      // If refresh fails, add to local array
      this.researchGroupImages.update(images => [...images, uploadedImage]);
    }

    this.toastService.showSuccessKey('jobCreationForm.imageSection.uploadSuccess');
  }

  /**
   * Handle upload errors from the shared component
   */
  onUploadError(error: ImageUploadError): void {
    this.toastService.showErrorKey(error.errorKey);
  }

  /**
   * Selects an image from the available options as the job banner.
   *
   * @param image - The image DTO to select
   */
  selectImage(image: ImageDTO): void {
    this.selectedImage.set(image);
    this.imageForm.patchValue({ imageId: image.imageId });
  }

  /**
   * Clears the current image selection.
   */
  clearImageSelection(): void {
    this.selectedImage.set(undefined);
    this.imageForm.patchValue({ imageId: null });
  }

  /**
   * Deletes an uploaded image from the server.
   *
   * @param imageId - The ID of the image to delete
   */
  async deleteImage(imageId: string | undefined): Promise<void> {
    if (!imageId) return;

    try {
      await firstValueFrom(this.imageApi.deleteImage(imageId));

      if (this.selectedImage()?.imageId === imageId) {
        this.clearImageSelection();
      }

      try {
        const researchGroupImages = await firstValueFrom(this.imageApi.getResearchGroupJobBanners());
        this.researchGroupImages.set(researchGroupImages);
      } catch {
        this.researchGroupImages.set(this.researchGroupImages().filter(img => img.imageId !== imageId));
      }

      this.toastService.showSuccessKey('jobCreationForm.imageSection.deleteImageSuccess');
    } catch {
      this.toastService.showErrorKey('jobCreationForm.imageSection.deleteImageFailed');
    }
  }

  /**
   * Deletes the currently selected image.
   */
  async deleteSelectedImage(): Promise<void> {
    await this.deleteImage(this.selectedImage()?.imageId);
  }

  /**
   * Loads available images (defaults and research group uploads) from the server.
   */
  async loadImages(): Promise<void> {
    try {
      try {
        const defaults = await firstValueFrom(this.imageApi.getMyDefaultJobBanners());
        this.defaultImages.set(defaults);
      } catch {
        this.defaultImages.set([]);
      }

      const researchGroupImages = await firstValueFrom(this.imageApi.getResearchGroupJobBanners());
      this.researchGroupImages.set(researchGroupImages);
    } catch {
      this.toastService.showErrorKey('jobCreationForm.imageSection.loadImagesFailed');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AI COMPLIANCE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Applies highlights to the editor based on compliance issues.
   * Filters issues by language and skips those with missing text or category.
   *
   * @param compliance List of issues to process
   * @param lang The current language of the editor content
   */
  private applyHighlights(compliance: ComplianceIssue[] | undefined, lang: string): void {
    const highlights = (compliance ?? []).flatMap(issue =>
      issue.text && issue.category && (!issue.language || issue.language === lang) ? [{ text: issue.text, category: issue.category }] : [],
    );
    this.jobDescriptionEditor()?.highlightTexts(highlights);
  }

  /**
   * Handles hover events from highlighted spans in the editor.
   * Finds the matching compliance issue and positions the popover.
   */
  onHighlightHovered(event: { text: string; x: number; y: number } | undefined): void {
    if (!event) {
      this.activePopoverIssue.set(undefined);
      return;
    }
    const lang = this.currentDescriptionLanguage();
    const match = this.complianceIssues().find(i => i.language === lang && i.text?.toLowerCase() === event.text.toLowerCase());
    this.activePopoverIssue.set(match);
    this.popoverX.set(Math.min(event.x, window.innerWidth - this.POPOVER_WIDTH));
    this.popoverY.set(event.y);
  }

  /**
   * Handles category filter changes from the AI assistant sidebar.
   * Updates filter signal to show only the selected category
   */
  onComplianceFilterChange(category: string | undefined): void {
    this.activeComplianceFilter.set(category);
  }

  /**
   * Handles highlights after reload, page switches, language switches or new analysis.
   * Skips while AI is actively generating new draft or translating.
   */
  private highlightsEffect = effect(() => {
    const editor = this.jobDescriptionEditor();
    const lang = this.currentDescriptionLanguage();
    const issues = this.complianceIssues();
    const filter = this.activeComplianceFilter();
    if (!editor) return;
    if (untracked(() => this.isGeneratingDraft() || (this.isTranslating() && this.translationTargetLang() === lang))) return;
    const filtered = filter ? issues.filter(i => i.category === filter) : issues;

    this.applyHighlights(filtered, lang);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AI GENERATION METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generates a job description draft using AI.
   * Uses current form values as context for generation.
   * Shows "Generating..." initially, then displays partial content as it streams in.
   * After generation completes, the final content is force-updated to ensure correctness.
   */
  async generateJobApplicationDraft(): Promise<void> {
    if (!this.aiSystemEnabled()) {
      const reasonKey = this.aiCircuitBreakerOpen() ? 'ai.featureToggle.circuitBreakerOpen' : 'ai.featureToggle.systemDisabled';
      this.toastService.showErrorKey(reasonKey);
      return;
    }
    const originalContent = this.basicInfoForm.get('jobDescription')?.value;
    const language = this.currentDescriptionLanguage();

    // Abort any in-flight translation. Generation will re-trigger a fresh
    // translation in postGenerationSaveAndProcess once it completes, so an
    // active translation against the soon-to-be-replaced text is wasted work.
    if (this.isTranslating()) {
      this.cancelTranslation();
    }

    // 1) Enter generation mode and show placeholder
    this.isGeneratingDraft.set(true);
    this.rewriteButtonSignal.set(true);
    this.isAutoScrolling = true;
    this.jobDescriptionEditor()?.forceUpdate(
      `<p><em>${this.translate.instant('jobCreationForm.positionDetailsSection.jobDescription.aiFillerText') as string}</em></p>`,
    );

    try {
      // 2) Sync current editor content and build the AI prompt request
      this.syncCurrentEditorIntoLanguageSignals();
      const request: JobFormDTO = {
        title: this.basicInfoForm.get('title')?.value ?? '',
        researchArea: this.basicInfoForm.get('researchArea')?.value ?? '',
        subjectArea: this.basicInfoForm.get('subjectArea')?.value?.value as JobFormDTOSubjectAreaEnum,
        supervisingProfessor: this.userId(),
        location: this.basicInfoForm.get('location')?.value?.value as JobFormDTOLocationEnum,
        jobDescriptionEN: this.jobDescriptionEN() || '',
        jobDescriptionDE: this.jobDescriptionDE() || '',
        state: JobFormDTOStateEnum.Draft,
      };
      this.autoScrollStreaming();

      // 3) Stream the AI response, updating the editor with each chunk
      let lastRendered = '';
      const accumulatedContent = await this.aiStreamingService.generateJobApplicationDraftStream(language, request, content => {
        const extractedContent = this.extractJobDescriptionFromStream(content);
        if (!extractedContent?.startsWith('<')) return;
        const safeHtml = extractCompleteHtmlTags(extractedContent);
        if (safeHtml && safeHtml !== lastRendered) {
          lastRendered = safeHtml;
          this.jobDescriptionEditor()?.forceUpdate(safeHtml);
        }
      });
      this.isAutoScrolling = false;

      // 4) Finalize: parse the complete response and update form + signals
      if (accumulatedContent) {
        const finalContent = this.extractJobDescriptionFromStream(accumulatedContent);

        if (finalContent && finalContent.length > 0) {
          // Use emitEvent:false to avoid triggering the autosave effect —
          // postGenerationSaveAndProcess handles saving directly.
          this.basicInfoForm.get('jobDescription')?.setValue(finalContent, { emitEvent: false });
          this.basicInfoForm.get('jobDescription')?.markAsDirty();
          this.jobDescriptionSignal.set(finalContent);
          this.jobDescriptionEditor()?.forceUpdate(finalContent);
          this.basicInfoValid.set(this.basicInfoForm.valid);

          // 5) Persist to the correct language bucket
          if (language === 'en') {
            this.jobDescriptionEN.set(finalContent);
          } else {
            this.jobDescriptionDE.set(finalContent);
          }

          // 6) Immediately save + analyze + translate (skip autosave delay).
          //    Pre-set isAnalyzing so isScoreProcessing stays true when
          //    isGeneratingDraft goes false in finally (postGenerationSaveAndProcess
          //    is async and hasn't reached its own pre-set yet).
          this.syncCurrentEditorIntoLanguageSignals();
          this.isAnalyzing.set(true);
          void this.postGenerationSaveAndProcess(language, finalContent);
        } else {
          this.jobDescriptionEditor()?.forceUpdate(originalContent);
          this.toastService.showErrorKey('jobCreationForm.toastMessages.aiGenerationFailed');
        }
      }
    } catch (error) {
      this.jobDescriptionEditor()?.forceUpdate(originalContent);
      this.isAutoScrolling = false;
      if (error instanceof Error && error.message.includes('HTTP error')) {
        this.toastService.showErrorKey('jobCreationForm.toastMessages.aiGenerationFailed');
      } else {
        this.toastService.showErrorKey('jobCreationForm.toastMessages.saveFailed');
      }
    } finally {
      this.isAutoScrolling = false;
      this.isGeneratingDraft.set(false);
    }
  }

  /**
   * Immediately saves the generated content and fires analysis + translation in parallel.
   * Called directly after AI draft generation to skip the 5s autosave delay.
   */
  private async postGenerationSaveAndProcess(sourceLang: Language, sourceText: string): Promise<void> {
    const currentData = this.createJobDTO(JobFormDTOStateEnum.Draft);
    this.autoSave.setState(SavingStates.SAVING);

    try {
      // 1) Persist the generated content to the server
      const saved = await this.saveDraft(currentData);

      // 2) Sync local state with server response
      this.lastSavedData.set(saved);
      this.jobDescriptionEN.set(saved.jobDescriptionEN ?? this.jobDescriptionEN());
      this.jobDescriptionDE.set(saved.jobDescriptionDE ?? this.jobDescriptionDE());
      this.autoSave.setState(SavingStates.SAVED);

      // 3) Analyze source language first so the user sees highlights + score immediately.
      if (this.aiToggleSignal() && this.aiSystemEnabled()) {
        void Promise.all([this.analyzeAndUpdateScore(sourceLang), this.translateAndStoreOtherLanguage(sourceLang, sourceText)]);
      }
    } catch {
      this.autoSave.setState(SavingStates.FAILED);
      this.isAnalyzing.set(false);
      this.toastService.showErrorKey('toast.saveFailed');
    }
  }

  /**
   * Extracts the jobDescription content from the AI response.
   */
  private extractJobDescriptionFromStream(content: string): string | null {
    return this.extractJsonFieldFromStream(content, 'jobDescription');
  }

  /**
   * Extracts the translatedText content from the AI translation response.
   */
  private extractTranslatedTextFromStream(content: string): string | null {
    return this.extractJsonFieldFromStream(content, 'translatedText');
  }

  /**
   * Extracts a named field from a streaming JSON response.
   * The AI returns JSON like: {"fieldName":"<html content>"}
   * This method extracts the HTML content from the JSON wrapper.
   *
   * @param content The complete streamed content (should be valid JSON when complete)
   * @param fieldName The JSON field name to extract
   * @returns The extracted HTML content, or null if extraction fails
   */
  private extractJsonFieldFromStream(content: string, fieldName: string): string | null {
    if (!content || content.trim().length === 0) {
      return null;
    }

    const trimmed = content.trim();

    // Method 1: Try to parse as complete JSON (most reliable)
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed[fieldName] && typeof parsed[fieldName] === 'string') {
        return parsed[fieldName];
      }
    } catch {
      // JSON parsing failed, try manual extraction
    }

    // Method 2: Manual extraction from JSON structure
    const startMarker = `"${fieldName}"`;
    const startIndex = trimmed.indexOf(startMarker);

    if (startIndex === -1) {
      // Not a JSON response, return as-is (might be plain HTML)
      return trimmed;
    }

    // Find the opening quote after the colon
    const colonIndex = trimmed.indexOf(':', startIndex);
    if (colonIndex === -1) return null;

    // Find the first quote after the colon (start of value)
    let valueStart = trimmed.indexOf('"', colonIndex + 1);
    if (valueStart === -1) return null;
    valueStart++; // Move past the opening quote

    // Find the closing quote - need to handle escaped quotes
    let valueEnd = valueStart;
    while (valueEnd < trimmed.length) {
      const char = trimmed[valueEnd];
      if (char === '\\') {
        // Skip escaped character
        valueEnd += 2;
      } else if (char === '"') {
        // Found the closing quote
        break;
      } else {
        valueEnd++;
      }
    }

    if (valueEnd >= trimmed.length) {
      // No closing quote found - incomplete JSON
      // Try to extract what we have
      let extracted = trimmed.substring(valueStart);
      // Remove trailing incomplete parts
      if (extracted.endsWith('"')) {
        extracted = extracted.slice(0, -1);
      }
      if (extracted.endsWith('"}')) {
        extracted = extracted.slice(0, -2);
      }
      // Unescape
      return unescapeJsonString(extracted);
    }

    // Extract the value between quotes
    const rawValue = trimmed.substring(valueStart, valueEnd);
    return unescapeJsonString(rawValue);
  }

  /**
   * Automatically scrolls the editor to the bottom during AI streaming.
   * Runs every 200ms while isAutoScrolling is true.
   */
  private autoScrollStreaming(): void {
    const editorContainer = document.querySelector('.ql-editor') as HTMLElement;
    let lastScrollTop = editorContainer.scrollTop;

    const smoothScroll = (): void => {
      if (!this.isAutoScrolling) return;
      if (editorContainer.scrollTop < lastScrollTop) {
        this.isAutoScrolling = false;
        return;
      }
      editorContainer.scrollTo({
        top: editorContainer.scrollHeight,
        behavior: 'smooth',
      });
      lastScrollTop = editorContainer.scrollTop;
      setTimeout(() => requestAnimationFrame(smoothScroll), 200);
    };
    requestAnimationFrame(smoothScroll);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORM CREATION METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Creates the Step 1 form group with validation rules.
   * Required fields: title, research area, subject area, location, supervising professor, job description
   */
  private createBasicInfoForm(): FormGroup {
    return this.fb.group({
      title: ['', [Validators.required]],
      researchArea: ['', [Validators.required]],
      subjectArea: [undefined, [Validators.required]],
      location: [undefined, [Validators.required]],
      supervisingProfessor: [undefined, Validators.required],
      jobDescription: ['', [htmlTextRequiredValidator, htmlTextMaxLengthValidator(5000)]],
    });
  }

  /**
   * Creates the Step 2 form group for optional position details.
   * All fields are optional: funding type, start date, deadline, workload, duration
   */
  private createPositionDetailsForm(): FormGroup {
    return this.fb.group(
      {
        // Position Details Form: Currently required for publishing a job
        fundingType: [undefined],
        tvlGrade: [undefined],
        startDate: [''],
        startDateByArrangement: [false],
        applicationDeadline: [''],
        workload: [undefined],
        contractDuration: [undefined],
        suitableForDisabled: [true],
        referenceLettersRequired: [REFERENCE_LETTERS_REQUIRED_OPTIONS[0]],
        recommendationType: [DEFAULT_RECOMMENDATION_TYPE_OPTION],
      },
      {
        validators: [dateOrderValidator('applicationDeadline', 'startDate')],
      },
    );
  }

  /**
   * Creates the Step 3 form group for image selection.
   */
  private createImageForm(): FormGroup {
    return this.fb.group({
      imageId: [undefined],
    });
  }

  /**
   * Constructs a JobFormDTO from all form values.
   * Combines data from all steps into a single DTO for API submission.
   *
   * @param state - The job state ('DRAFT' or 'PUBLISHED')
   * @returns The complete job form DTO
   */
  private createJobDTO(state: JobFormDTOStateEnum): JobFormDTO {
    const basicInfoValue = this.basicInfoForm.getRawValue();
    const positionDetailsValue = this.positionDetailsForm.getRawValue();
    const imageValue = this.imageForm.getRawValue();

    // Ensure current editor content is always included in the right language bucket.
    // When viewing the translation target during active streaming, the editor shows AI content
    // and the form value is empty — fall back to the signal to avoid saving empty content.
    const lang = this.currentDescriptionLanguage();
    const isViewingTranslationTarget = this.isTranslating() && this.translationTargetLang() === lang;
    const currentText = isViewingTranslationTarget ? '' : (basicInfoValue.jobDescription ?? '').trim();

    const supervisingProfessorRaw = basicInfoValue.supervisingProfessor;
    const supervisingProfessorId =
      (typeof supervisingProfessorRaw === 'object' && supervisingProfessorRaw !== null
        ? (supervisingProfessorRaw as { value?: string }).value
        : supervisingProfessorRaw) ??
      this.preferredSupervisingProfessorId() ??
      this.userId();

    const jobDescriptionEN = !isViewingTranslationTarget && lang === 'en' ? currentText : this.jobDescriptionEN();
    const jobDescriptionDE = !isViewingTranslationTarget && lang === 'de' ? currentText : this.jobDescriptionDE();

    return {
      jobId: this.jobId() || undefined,
      title: this.basicInfoForm.get('title')?.value ?? '',
      researchArea: basicInfoValue.researchArea?.trim() ?? '',
      subjectArea: basicInfoValue.subjectArea?.value as JobFormDTOSubjectAreaEnum,
      supervisingProfessor: supervisingProfessorId ?? '',
      location: basicInfoValue.location?.value as JobFormDTOLocationEnum,

      jobDescriptionEN: jobDescriptionEN ?? undefined,
      jobDescriptionDE: jobDescriptionDE ?? undefined,

      startDate: positionDetailsValue.startDate ?? undefined,
      startDateByArrangement: positionDetailsValue.startDateByArrangement ?? false,
      endDate: positionDetailsValue.applicationDeadline ?? undefined,
      workload: positionDetailsValue.workload,
      contractDuration: positionDetailsValue.contractDuration,
      fundingType: positionDetailsValue.fundingType?.value as JobFormDTOFundingTypeEnum,
      tvlGrade: positionDetailsValue.tvlGrade?.value as JobFormDTOTvlGradeEnum,
      imageId: imageValue.imageId ?? null,
      suitableForDisabled: positionDetailsValue.suitableForDisabled ?? true,
      referenceLettersRequired: positionDetailsValue.referenceLettersRequired?.value as number,
      recommendationType: positionDetailsValue.recommendationType?.value as RecommendationType,
      state,
    } as JobFormDTO;
  }

  /**
   * Applies server-returned job data to local state.
   * Used after save operations to sync with server-side changes.
   * Also reads genderBiasScore from the server response to update the AI score ring.
   *
   * @param saved - The job form DTO returned from the server
   */
  private applyServerJobForm(saved: JobFormDTO): void {
    // refresh local truth from server (important for autosave / server-side adjustments)
    this.jobDescriptionEN.set(saved.jobDescriptionEN ?? '');
    this.jobDescriptionDE.set(saved.jobDescriptionDE ?? '');
    this.lastSavedData.set(saved);

    if (saved.genderBiasScore !== undefined) {
      this.aiScore.set(saved.genderBiasScore);
    }
    if (saved.complianceIssues) {
      this.complianceIssues.set(saved.complianceIssues);
    }

    // keep editor in sync with selected language (without triggering autosave loop)
    const lang = this.currentDescriptionLanguage();
    const content = lang === 'en' ? this.jobDescriptionEN() : this.jobDescriptionDE();
    this.basicInfoForm.get('jobDescription')?.setValue(content, { emitEvent: false });
    this.jobDescriptionSignal.set(content);
    this.jobDescriptionEditor()?.forceUpdate(content, () => {
      this.applyHighlights(this.complianceIssues(), lang);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initializes the component based on the route.
   * - Validates user authentication
   * - Loads available images
   * - Determines mode (create/edit) from URL
   * - Fetches existing job data in edit mode
   */
  private async init(): Promise<void> {
    try {
      // 1) Validate user authentication
      const userId = this.accountService.loadedUser()?.id ?? '';
      if (!userId) {
        this.router.navigate(['/login']);
        return;
      }
      this.userId.set(userId);

      // 2) Determine mode (create/edit) from URL segments
      const segments = await firstValueFrom(this.route.url);
      const mode = segments[1]?.path as JobFormMode;
      const loadImagesPromise = this.loadImages();

      if (mode === 'create') {
        // 3a) Create mode: load images + professors in parallel, then populate empty form
        this.mode.set('create');
        await Promise.all([loadImagesPromise, this.loadSupervisingProfessors()]);
        this.populateForm();
        this.setDefaultSupervisingProfessor();
      } else {
        // 3b) Edit mode: load job data + images + professors in parallel, then populate form
        this.mode.set('edit');
        const jobId = this.route.snapshot.paramMap.get('job_id') ?? '';
        if (!jobId) {
          this.router.navigate(['/my-positions']);
          return;
        }

        this.jobId.set(jobId);
        const [job] = await Promise.all([
          firstValueFrom(this.jobApi.getJobById(jobId)),
          loadImagesPromise,
          this.loadSupervisingProfessors(),
        ]);
        this.populateForm(job);
        this.setDefaultSupervisingProfessor(job.supervisingProfessor);
      }

      // 4) Prevent autosave from firing immediately after initialization
      this.autoSaveInitialized = false;
    } catch {
      this.toastService.showErrorKey('toast.loadFailed');
      this.router.navigate(['/my-positions']);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Populates all forms with initial/existing job data.
   * Sets up dual-language description signals.
   *
   * @param job - Optional existing job data (undefined for create mode)
   */
  private populateForm(job?: JobDTO): void {
    // Default tab EN
    this.currentDescriptionLanguage.set('en');

    const en =
      job?.jobDescriptionEN ??
      (job === undefined ? this.translate.instant('jobCreationForm.positionDetailsSection.jobDescription.templateEN') : '');
    const de =
      job?.jobDescriptionDE ??
      (job === undefined ? this.translate.instant('jobCreationForm.positionDetailsSection.jobDescription.templateDE') : '');

    const supervisingProfessorId = job?.supervisingProfessor ?? this.basicInfoForm.get('supervisingProfessor')?.value;

    this.jobDescriptionEN.set(en);
    this.lastTranslatedEN.set(en);
    this.jobDescriptionDE.set(de);
    this.lastTranslatedDE.set(de);
    this.lastAnalyzedText['en'] = en;
    this.lastAnalyzedText['de'] = de;

    if (job?.genderBiasScore !== undefined) {
      this.aiScore.set(job.genderBiasScore);
    }
    if (job?.complianceIssues) {
      this.complianceIssues.set(job.complianceIssues);
    }

    this.basicInfoForm.patchValue({
      title: job?.title ?? '',
      researchArea: job?.researchArea ?? '',
      supervisingProfessor: supervisingProfessorId,
      subjectArea: this.findDropdownOption(DropdownOptions.subjectAreas, job?.subjectArea),
      location: this.findDropdownOption(DropdownOptions.locations, job?.location),
      jobDescription: en,
    });

    this.jobDescriptionSignal.set(en);

    this.positionDetailsForm.patchValue({
      startDate: job?.startDate ?? '',
      startDateByArrangement: job?.startDateByArrangement ?? false,
      applicationDeadline: job?.endDate ?? '',
      workload: job?.workload ?? undefined,
      contractDuration: job?.contractDuration ?? undefined,
      fundingType: this.findDropdownOption(DropdownOptions.fundingTypes, job?.fundingType),
      tvlGrade: this.findDropdownOption(DropdownOptions.tvlGrades, job?.tvlGrade),
      suitableForDisabled: job?.suitableForDisabled ?? true,
      referenceLettersRequired:
        this.findDropdownOption(this.referenceLettersRequiredOptions, job?.referenceLettersRequired ?? 0) ??
        this.referenceLettersRequiredOptions[0],
      recommendationType:
        this.findDropdownOption(DropdownOptions.recommendationTypes, job?.recommendationType) ?? DEFAULT_RECOMMENDATION_TYPE_OPTION,
    });

    if (job?.imageId !== undefined && job.imageUrl !== undefined) {
      this.imageForm.patchValue({ imageId: job.imageId });

      const isDefaultImage = this.defaultImages().some(img => img.imageId === job.imageId);
      const imageType = isDefaultImage ? 'DEFAULT_JOB_BANNER' : 'JOB_BANNER';

      this.selectedImage.set({
        imageId: job.imageId,
        url: job.imageUrl,
        imageType: imageType as 'JOB_BANNER' | 'DEFAULT_JOB_BANNER' | 'PROFILE_PICTURE',
      });
    }

    this.lastSavedData.set(this.createJobDTO(JobFormDTOStateEnum.Draft));
  }

  /**
   * Loads professors for the supervising-professor select.
   * Admins see every professor in the system; everyone else sees only their research group's professors.
   */
  private async loadSupervisingProfessors(): Promise<void> {
    try {
      const isAdmin = this.accountService.userAuthorities?.includes(UserShortDTORolesEnum.Admin) ?? false;
      const response = isAdmin
        ? await firstValueFrom(this.userApi.getAllProfessors())
        : await firstValueFrom(this.researchGroupApi.getResearchGroupProfessors());
      const options = response
        .filter(member => member.roles?.includes(UserShortDTORolesEnum.Professor) && member.userId)
        .map(member => {
          const displayName = `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim();
          const fallback = (member.email ?? member.userId ?? '').trim();
          const name = displayName !== '' ? displayName : fallback !== '' ? fallback : 'Unnamed Professor';
          return { value: member.userId as string, name };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      this.supervisingProfessorOptions.set(options);
    } catch {
      this.toastService.showErrorKey('toast.loadFailed');
    }
  }

  /**
   * Selects a sensible default supervising professor (preselect, current user if professor, otherwise first option).
   */
  private setDefaultSupervisingProfessor(preselectId?: string): void {
    const options = this.supervisingProfessorOptions();
    const control = this.basicInfoForm.get('supervisingProfessor');
    if (!control) return;

    const rawValue = control.value as unknown;
    const hasObjectValue = typeof rawValue === 'object' && rawValue !== null;
    const currentValue = hasObjectValue ? (rawValue as { value?: string }).value : (rawValue as string | undefined);
    const matchedPreselect = preselectId && options.some(option => option.value === preselectId) ? preselectId : undefined;
    const fallbackId = this.preferredSupervisingProfessorId();
    const nextValue = matchedPreselect ?? currentValue ?? fallbackId;

    if (nextValue) {
      const match = options.find(opt => opt.value === nextValue);
      if (match && (!hasObjectValue || currentValue !== nextValue)) {
        control.setValue(match);
      } else if (!match && currentValue !== nextValue) {
        control.setValue(nextValue);
      }
    }
  }

  /**
   * Determines the preferred supervising professor ID based on the logged-in professor or first option.
   */
  private preferredSupervisingProfessorId(): string | undefined {
    const options = this.supervisingProfessorOptions();
    if (!options.length) return undefined;

    const currentUserId = this.userId();
    const isCurrentUserProfessor = this.accountService.userAuthorities?.includes(UserShortDTORolesEnum.Professor);

    if (isCurrentUserProfessor && currentUserId) {
      const match = options.find(option => option.value === currentUserId);
      if (match) {
        return match.value;
      }
    }

    return options[0]?.value;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-SAVE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Wires up the auto-save controller to track every form-value signal.
   * Each value change debounces a save through {@link AutoSaveController}.
   * Skips during initial population and AI generation.
   */
  private setupAutoSave(): void {
    effect(() => {
      // 1) Track form value signals — these are the ONLY triggers for the effect
      const description = this.basicInfoForm.get('jobDescription')?.value ?? '';
      this.basicInfoFormValueSignal();
      this.positionDetailsFormValueSignal();
      this.imageFormValueSignal();

      // 2) Skip during initial form population
      if (!this.autoSaveInitialized) {
        this.autoSaveInitialized = true;
        return;
      }

      // 3) Skip while generating or while viewing the translation target
      //    (editor shows AI-streamed content, not user content).
      //    Read via untracked() so these signals don't become effect dependencies.
      if (untracked(() => this.isGeneratingDraft())) {
        return;
      }
      if (untracked(() => this.isTranslating() && this.translationTargetLang() === this.currentDescriptionLanguage())) {
        return;
      }

      // 4) Update the description signal and (re)start the debounce timer.
      //    The badge stays on its current state until the timer fires, so the
      //    user does not see "Saving changes..." flicker on every keystroke.
      this.jobDescriptionSignal.set(description);
      this.autoSave.notifyChanged();
    });
  }

  /**
   * Save callback invoked by the {@link AutoSaveController} when its timer fires.
   * Returns `true` on success so the controller can flip the badge to `SAVED`.
   */
  private runAutoSave(): Promise<boolean> {
    const work = this.executeAutoSave();
    this.autoSaveInFlight = work;
    void work.finally(() => {
      if (this.autoSaveInFlight === work) {
        this.autoSaveInFlight = undefined;
      }
    });
    return work;
  }

  private async executeAutoSave(): Promise<boolean> {
    // 1) Capture current form state before any async work
    this.syncCurrentEditorIntoLanguageSignals();
    const currentLang = this.currentDescriptionLanguage();
    const description = this.basicInfoForm.get('jobDescription')?.value ?? '';
    const currentData = this.createJobDTO(JobFormDTOStateEnum.Draft);

    try {
      // 2) Create or update the job on the server
      const saved = await this.saveDraft(currentData);

      // 3) Sync local state with server response
      this.lastSavedData.set(saved);
      this.jobDescriptionEN.set(saved.jobDescriptionEN ?? this.jobDescriptionEN());
      this.jobDescriptionDE.set(saved.jobDescriptionDE ?? this.jobDescriptionDE());

      // 4) Fire translation (fire-and-forget). Analysis runs once at the end
      //    of translation after both languages are available — avoids duplicate
      //    analysis calls that cause score flash issues.
      if (this.aiToggleSignal() && this.aiSystemEnabled()) {
        // highlighting before translation
        void Promise.all([this.analyzeAndUpdateScore(currentLang), this.translateAndStoreOtherLanguage(currentLang, description)]);
      }
      return true;
    } catch {
      this.toastService.showErrorKey('toast.saveFailed');
      return false;
    }
  }

  /**
   * Persists the current form data as a draft, creating the job on the first
   * save and updating it afterwards.
   *
   * On creation, the new id is reflected in the URL (`/job/create` →
   * `/job/edit/:id`) via `replaceState`, so refreshing the page reloads the
   * saved draft through the edit route instead of opening a new empty form.
   * `replaceState` keeps the component mounted (no mid-edit reload) and avoids
   * leaving `/job/create` in the history, where Back would start another draft.
   *
   * @param currentData - the draft job data to persist
   * @returns the job as returned by the server
   */
  private async saveDraft(currentData: JobFormDTO): Promise<JobFormDTO> {
    if (this.jobId()) {
      return firstValueFrom(this.jobApi.updateJob(this.jobId(), currentData));
    }

    const saved = await firstValueFrom(this.jobApi.createJob(currentData));
    const newJobId = saved.jobId ?? '';
    this.jobId.set(newJobId);
    if (newJobId) {
      this.location.replaceState(`/job/edit/${newJobId}`);
    }
    return saved;
  }

  /**
   * Translates the job description to the other language via SSE streaming.
   * Supports cancellation (new edits cancel the previous translation) and
   * live editor updates when the user is viewing the target language tab.
   *
   * @param currentLang - The language the user wrote in ('en' or 'de')
   * @param currentText - The source text to translate
   */
  private async translateAndStoreOtherLanguage(currentLang: Language, currentText: string): Promise<void> {
    const text = currentText.trim();
    if (!text) return;

    const targetLang: Language = currentLang === 'en' ? 'de' : 'en';
    // If an identical translation is already in flight, skips the call to avoid a redundant LLM request.
    const active = this.activeTranslationRequest;
    if (active?.sourceLang === currentLang && active.sourceText === text && active.targetLang === targetLang) {
      return;
    }

    // 1) Skip if the text hasn't changed since the last translation
    const lastBaseline = currentLang === 'en' ? this.lastTranslatedEN() : this.lastTranslatedDE();
    if (text === lastBaseline) return;

    // 2) Cancel any active translation and set up fresh state
    this.cancelTranslation();
    const abortController = new AbortController();
    // If a newer request exists, keep it to avoid breaking duplicate checks.
    const activeRequest = { sourceLang: currentLang, sourceText: text, targetLang };
    this.activeTranslationRequest = activeRequest;
    this.translationAbortController = abortController;
    this.isTranslating.set(true);
    this.translationTargetLang.set(targetLang);

    // 3) If user is already viewing the target language, show placeholder
    if (this.currentDescriptionLanguage() === targetLang) {
      const placeholder = `<p><em>${this.translate.instant('jobCreationForm.positionDetailsSection.jobDescription.translatingPlaceholder') as string}</em></p>`;
      this.jobDescriptionEditor()?.forceUpdate(placeholder);
    }

    try {
      // 4) Stream the translation, updating the editor in real-time if user is on target tab
      let lastRendered = '';
      const accumulatedContent = await this.aiStreamingService.translateJobDescriptionStream(
        targetLang,
        text,
        content => {
          const extracted = this.extractTranslatedTextFromStream(content);
          if (!extracted?.startsWith('<')) return;
          const safeHtml = extractCompleteHtmlTags(extracted);
          if (safeHtml && safeHtml !== lastRendered) {
            lastRendered = safeHtml;
            if (this.currentDescriptionLanguage() === targetLang) {
              this.jobDescriptionEditor()?.forceUpdate(safeHtml);
            }
          }
        },
        abortController.signal,
      );

      const finalContent = accumulatedContent ? this.extractTranslatedTextFromStream(accumulatedContent) : undefined;
      let hasTranslation = false;

      if (finalContent && finalContent.length > 0) {
        hasTranslation = true;
        // 5) Update the target language signal and translation baselines
        if (targetLang === 'en') {
          this.jobDescriptionEN.set(finalContent);
          this.lastTranslatedEN.set(finalContent);
          this.lastTranslatedDE.set(text);
        } else {
          this.jobDescriptionDE.set(finalContent);
          this.lastTranslatedDE.set(finalContent);
          this.lastTranslatedEN.set(text);
        }

        // 6) If user is viewing the target language, finalize the editor
        if (this.currentDescriptionLanguage() === targetLang) {
          this.basicInfoForm.get('jobDescription')?.setValue(finalContent, { emitEvent: false });
          this.jobDescriptionSignal.set(finalContent);
          this.jobDescriptionEditor()?.forceUpdate(finalContent);
        }
      }

      // 7) Streaming is done. For the active run, hand off from "translating" to
      //    "analyzing": pre-set isAnalyzing so the sidebar score keeps loading,
      //    then clear the translation spinner so the editor shows the finished
      //    translation immediately instead of waiting for compliance analysis.
      const jobId = this.jobId();
      const runAnalysis = this.translationAbortController === abortController && hasTranslation && !!jobId;
      if (runAnalysis) {
        this.isAnalyzing.set(true);
      }
      this.clearTranslationState(abortController, activeRequest);

      // 8) Persist the translated content and run compliance analysis for the
      //    freshly translated language, decoupled from the translation spinner.
      if (runAnalysis) {
        try {
          const currentData = this.createJobDTO(JobFormDTOStateEnum.Draft);
          const saved = await firstValueFrom(this.jobApi.updateJob(jobId, currentData));
          this.lastSavedData.set(saved);
          await this.analyzeAndUpdateScore(targetLang);
        } catch {
          // Silent save failure — will be caught by next autosave
          this.isAnalyzing.set(false);
        }
      }
    } catch (e) {
      this.clearTranslationState(abortController, activeRequest);
      if (e instanceof DOMException && e.name === 'AbortError') {
        return; // Cancelled — silently ignore
      }
      this.toastService.showErrorKey('jobCreationForm.toastMessages.aiTranslationFailed');
    }
  }

  /**
   * Runs compliance analysis on the job description for the given language
   * and updates the inclusivity score in the sidebar.
   *
   * @param lang - The language to analyze ('en' or 'de')
   */
  private async analyzeAndUpdateScore(lang: string): Promise<void> {
    const jobId = this.jobId();
    if (!jobId) return;

    // 1) Build a fresh DTO and skip if the description hasn't changed since last analysis
    const jobForm = this.createJobDTO(JobFormDTOStateEnum.Draft);
    const userLang = this.translate.currentLang;
    const descriptionText = lang === 'en' ? (jobForm.jobDescriptionEN ?? '') : (jobForm.jobDescriptionDE ?? '');
    if (!descriptionText.trim() || descriptionText === this.lastAnalyzedText[lang]) {
      this.isAnalyzing.set(false); // Clear flag in case caller pre-set it
      return;
    }

    this.isAnalyzing.set(true);
    try {
      // 2) Send the description to the analysis endpoint (persists score on the backend)
      const compliance = await firstValueFrom(this.aiApi.analyzeJobDescriptionForCompliance(lang, jobForm, userLang));
      this.lastAnalyzedText[lang] = descriptionText;
      // Keep issues from other languages, but replace all issues for the current language with the latest analysis.
      const otherLang = lang === 'en' ? 'de' : 'en';
      const existingLang = this.complianceIssues().filter(issue => issue.language === otherLang);

      this.complianceIssues.set(existingLang.concat(compliance));

      // 3) Fetch the updated job to retrieve the persisted score.
      //    Retry once with a short delay if the score is still missing
      //    (DB transaction may not have committed yet).
      for (let attempt = 0; attempt < 2; attempt++) {
        const updatedJob = await firstValueFrom(this.jobApi.getJobById(jobId));
        if (updatedJob.genderBiasScore !== undefined) {
          this.aiScore.set(updatedJob.genderBiasScore);
          break;
        }
        if (attempt === 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      const currentLang = this.currentDescriptionLanguage();
      if (currentLang === lang) {
        this.applyHighlights(compliance, lang);
      }
    } catch {
      this.toastService.showErrorKey('jobCreationForm.toastMessages.aiComplianceFailed');
    } finally {
      this.isAnalyzing.set(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEPPER CONFIGURATION BUILDER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Builds the configuration array for the progress stepper component.
   * Defines 4 steps with their templates, navigation buttons, and validation states:
   *
   * 1. Basic Info - Back exits, Next requires basicInfoValid
   * 2. Position Details - Disabled until Step 1 is valid
   * 3. Image Selection - Disabled until Steps 1 and 2 are valid
   * 4. Summary - Shows publish button instead of next
   *
   * @returns Array of StepData objects for the ProgressStepperComponent
   */
  private buildStepData(): StepData[] {
    const steps: StepData[] = [];
    const templates = {
      panel1: this.panel1(),
      panel2: this.panel2(),
      panel3: this.panel3(),
      panel4: this.panel4(),
      status: this.savingStatePanel(),
    };

    if (templates.panel1) {
      steps.push({
        name: 'jobCreationForm.header.steps.basicInfo.name',
        panelTemplate: templates.panel1,
        shouldTranslate: true,
        buttonGroupPrev: [
          {
            variant: 'outlined',
            severity: 'info',
            icon: 'arrow-left',
            onClick: () => this.onBack(),
            disabled: false,
            label: 'button.back',
            changePanel: false,
            shouldTranslate: true,
          },
        ],
        buttonGroupNext: [
          {
            severity: 'primary',
            icon: 'chevron-right',
            onClick: () => {
              void this.onStepChange();
            },
            disabled: !this.basicInfoValid(),
            label: 'button.next',
            shouldTranslate: true,
            changePanel: true,
          },
        ],
        status: templates.status,
      });
    }

    if (templates.panel2) {
      steps.push({
        name: 'jobCreationForm.header.steps.employmentTerms.name',
        panelTemplate: templates.panel2,
        shouldTranslate: true,
        buttonGroupPrev: [
          {
            variant: 'outlined',
            severity: 'primary',
            icon: 'chevron-left',
            onClick() {},
            disabled: false,
            label: 'button.back',
            shouldTranslate: true,
            changePanel: true,
          },
        ],
        buttonGroupNext: [
          {
            severity: 'primary',
            icon: 'chevron-right',
            onClick() {},
            disabled: !this.positionDetailsValid(),
            label: 'button.next',
            shouldTranslate: true,
            changePanel: true,
          },
        ],
        disabled: !this.basicInfoValid(),
        status: templates.status,
      });
    }

    if (templates.panel3) {
      steps.push({
        name: 'jobCreationForm.header.steps.imageSelection.name',
        panelTemplate: templates.panel3,
        shouldTranslate: true,
        buttonGroupPrev: [
          {
            variant: 'outlined',
            severity: 'primary',
            icon: 'chevron-left',
            onClick() {},
            disabled: false,
            label: 'button.back',
            shouldTranslate: true,
            changePanel: true,
          },
        ],
        buttonGroupNext: [
          {
            severity: 'primary',
            icon: 'chevron-right',
            onClick() {},
            disabled: false,
            label: 'button.next',
            shouldTranslate: true,
            changePanel: true,
          },
        ],
        disabled: !(this.basicInfoValid() && this.positionDetailsValid()),
        status: templates.status,
      });
    }

    if (templates.panel4) {
      steps.push({
        name: 'jobCreationForm.header.steps.summary.name',
        panelTemplate: templates.panel4,
        shouldTranslate: true,
        buttonGroupPrev: [
          {
            variant: 'outlined',
            severity: 'primary',
            icon: 'chevron-left',
            onClick() {},
            disabled: false,
            label: 'button.back',
            shouldTranslate: true,
            changePanel: true,
          },
        ],
        buttonGroupNext: [
          {
            severity: this.publishButtonSeverity,
            icon: this.publishButtonIcon,
            onClick: () => this.showPublishDialog.set(true),
            disabled: !this.allFormsValid(),
            label: 'button.publish',
            shouldTranslate: true,
            changePanel: false,
          },
        ],
        disabled: !(this.basicInfoValid() && this.positionDetailsValid()),
        status: templates.status,
      });
    }

    return steps;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Finds a dropdown option by its value.
   * Used to pre-select dropdown values when editing existing jobs.
   *
   * @param options - Array of dropdown options
   * @param value - The value to find
   * @returns The matching option or undefined
   */
  private findDropdownOption<T extends { value: unknown }>(options: T[], value: unknown): T | undefined {
    return options.find(opt => opt.value === value);
  }

  protected readonly tvlGrades = tvlGrades;

  protected readonly referenceLettersRequiredOptions = REFERENCE_LETTERS_REQUIRED_OPTIONS;
}
