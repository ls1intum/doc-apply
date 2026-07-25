import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { firstValueFrom } from 'rxjs';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { UploadButtonComponent } from 'app/shared/components/atoms/upload-button/upload-button.component';
import { SelectComponent, SelectOption } from 'app/shared/components/atoms/select/select.component';
import { RatingGridComponent } from 'app/shared/components/atoms/rating-grid/rating-grid.component';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';
import { ToastService } from 'app/service/toast-service';
import TranslateDirective from 'app/shared/language/translate.directive';
import { ReferenceLetterUploadResourceApi } from 'app/generated/api/reference-letter-upload-resource-api';
import { ReferenceLetterUploadContextDTO } from 'app/generated/model/reference-letter-upload-context-dto';
import {
  DocumentInformationHolderDTO,
  DocumentInformationHolderDTODocumentTypeEnum,
} from 'app/generated/model/document-information-holder-dto';
import { ReferenceRequestDTOStatusEnum } from 'app/generated/model/reference-request-dto';
import { RecommendationType } from 'app/generated/model/recommendation-type';
import { RefereeRelationship } from 'app/generated/model/referee-relationship';
import { AcquaintanceDuration } from 'app/generated/model/acquaintance-duration';
import { AcquaintanceDepth } from 'app/generated/model/acquaintance-depth';
import { PeerRating } from 'app/generated/model/peer-rating';
import { OverallRecommendation } from 'app/generated/model/overall-recommendation';
import {
  DEPTH_OPTIONS,
  DURATION_OPTIONS,
  OVERALL_OPTIONS,
  RATING_OPTIONS,
  RATING_ROWS,
  RELATIONSHIP_OPTIONS,
} from 'app/reference/reference-assessment.constants';

/**
 * Public landing page for external referees to fill in a structured assessment and upload a
 * recommendation letter.
 */
@Component({
  selector: 'jhi-reference-letter-upload',
  standalone: true,
  imports: [
    FontAwesomeModule,
    TranslateDirective,
    ButtonComponent,
    UploadButtonComponent,
    SelectComponent,
    RatingGridComponent,
    ConfirmDialog,
  ],
  templateUrl: './reference-letter-upload.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferenceLetterUploadComponent {
  protected readonly documentType = DocumentInformationHolderDTODocumentTypeEnum.ReferenceLetter;
  protected readonly loading = signal<boolean>(true);
  protected readonly uploading = signal<boolean>(false);
  protected readonly errorKey = signal<string | undefined>(undefined);
  protected readonly justUploaded = signal<boolean>(false);
  protected readonly justDeclined = signal<boolean>(false);

  protected readonly context = signal<ReferenceLetterUploadContextDTO | undefined>(undefined);
  protected uploadedDocuments = signal<DocumentInformationHolderDTO[] | undefined>(undefined);
  protected readonly queuedFile = signal<File | undefined>(undefined);
  protected readonly hasQueuedFile = computed(() => !!this.queuedFile());

  protected readonly relationshipOptions = RELATIONSHIP_OPTIONS;
  protected readonly durationOptions = DURATION_OPTIONS;
  protected readonly depthOptions = DEPTH_OPTIONS;
  protected readonly ratingOptions = RATING_OPTIONS;
  protected readonly overallOptions = OVERALL_OPTIONS;
  protected readonly ratingRows = RATING_ROWS;

  protected readonly answers = signal<Record<string, string | undefined>>({});

  protected readonly selectedOptions = computed(() => {
    const a = this.answers();
    const resolve = (key: string, options: SelectOption[]): SelectOption | undefined => options.find(option => option.value === a[key]);
    const map: Record<string, SelectOption | undefined> = {
      relationship: resolve('relationship', this.relationshipOptions),
      acquaintanceDuration: resolve('acquaintanceDuration', this.durationOptions),
      acquaintanceDepth: resolve('acquaintanceDepth', this.depthOptions),
      overallRecommendation: resolve('overallRecommendation', this.overallOptions),
    };
    this.ratingRows.forEach(row => (map[row.key] = resolve(row.key, this.ratingOptions)));
    return map;
  });

  protected readonly allAnswered = computed(() => {
    const a = this.answers();
    return this.requiredKeys.every(key => a[key] !== undefined);
  });

  /** What the job asks recommenders to provide; defaults to both parts until the context is loaded. */
  protected readonly recommendationType = computed(() => this.context()?.recommendationType ?? RecommendationType.LetterAndEvaluation);

  /** True when the job asks for a letter upload. */
  protected readonly letterRequired = computed(() => this.recommendationType() !== RecommendationType.EvaluationOnly);

  /** True when the job asks for the structured evaluation questions. */
  protected readonly evaluationRequired = computed(() => this.recommendationType() !== RecommendationType.LetterOnly);

  protected readonly titleKey = computed(() => `reference.title.${this.recommendationType()}`);
  protected readonly successTitleKey = computed(() => `reference.success.title.${this.recommendationType()}`);
  protected readonly successMessageKey = computed(() => `reference.success.message.${this.recommendationType()}`);

  protected readonly canSubmit = computed(
    () => !this.uploading() && (!this.letterRequired() || this.hasQueuedFile()) && (!this.evaluationRequired() || this.allAnswered()),
  );

  protected readonly expired = computed(() => this.context()?.status === ReferenceRequestDTOStatusEnum.Expired);

  protected readonly declined = computed(() => this.context()?.status === ReferenceRequestDTOStatusEnum.Declined || this.justDeclined());

  /** True when the applicant withdrew their application, so the recommendation is no longer needed. */
  protected readonly cancelled = computed(() => this.context()?.status === ReferenceRequestDTOStatusEnum.Cancelled);

  /** True unless the applicant explicitly shared access; controls which confidentiality note is shown. */
  protected readonly confidential = computed(() => this.context()?.confidential !== false);

  protected readonly applicantFullName = computed(() => {
    const ctx = this.context();
    if (!ctx) {
      return '';
    }
    return [ctx.applicantFirstName, ctx.applicantLastName].filter(part => !!part).join(' ');
  });

  protected readonly alreadySubmitted = computed(
    () => this.context()?.status === ReferenceRequestDTOStatusEnum.Submitted || this.justUploaded(),
  );

  /** True while the interactive upload form is shown; the template widens the layout for the rating grid. */
  protected readonly showUploadView = computed(
    () =>
      !this.loading() &&
      this.errorKey() === undefined &&
      !this.declined() &&
      !this.alreadySubmitted() &&
      !this.expired() &&
      !this.cancelled() &&
      this.recommendationType() !== RecommendationType.LetterOnly,
  );

  private readonly requiredKeys = [
    'relationship',
    'acquaintanceDuration',
    'acquaintanceDepth',
    'ratingIntellectualAbility',
    'ratingResearchPotential',
    'ratingMotivation',
    'ratingCommunication',
    'ratingLeadership',
    'ratingCollaboration',
    'overallRecommendation',
  ];

  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ReferenceLetterUploadResourceApi);
  private readonly toastService = inject(ToastService);
  private readonly token = this.route.snapshot.paramMap.get('token') ?? '';

  constructor() {
    void this.loadContext();
  }

  /**
   * Captures the file the referee picked.
   *
   * @param files the queued file list emitted by the upload button
   */
  protected onQueuedFilesChanged(files: File[]): void {
    this.queuedFile.set(files[0]);
  }

  /**
   * Records the referee's choice for a single structured question.
   *
   * @param key    the answer key (matches the upload request parameter name)
   * @param option the selected dropdown option
   */
  protected onAnswerSelected(key: string, option: SelectOption | undefined): void {
    this.answers.update(prev => {
      const next = Object.assign({}, prev);
      next[key] = option?.value as string | undefined;
      return next;
    });
  }

  /**
   * Sends the parts the job asks for — the staged file, the structured answers, or both — to the
   * upload endpoint and switches to the success view. Stays on the upload view on failure so the
   * referee can retry.
   */
  protected async confirmUpload(): Promise<void> {
    const file = this.letterRequired() ? this.queuedFile() : undefined;
    if (this.letterRequired() && !file) {
      return;
    }
    if (this.evaluationRequired() && !this.allAnswered()) {
      return;
    }
    const a: Record<string, string | undefined> = this.evaluationRequired() ? this.answers() : {};
    this.uploading.set(true);
    try {
      await firstValueFrom(
        this.api.upload(
          this.token,
          a.acquaintanceDepth as AcquaintanceDepth,
          a.acquaintanceDuration as AcquaintanceDuration,
          file,
          a.overallRecommendation as OverallRecommendation,
          a.ratingCollaboration as PeerRating,
          a.ratingCommunication as PeerRating,
          a.ratingIntellectualAbility as PeerRating,
          a.ratingLeadership as PeerRating,
          a.ratingMotivation as PeerRating,
          a.ratingResearchPotential as PeerRating,
          a.relationship as RefereeRelationship,
        ),
      );
      this.justUploaded.set(true);
      this.toastService.showSuccessKey(`reference.uploadSuccess`);
    } catch {
      this.toastService.showErrorKey(`reference.uploadFailed`);
    } finally {
      this.uploading.set(false);
    }
  }

  /**
   * Marks the request as declined on the server and switches to the declined view. Stays on the
   * upload view on failure so the referee can retry.
   */
  protected async confirmDecline(): Promise<void> {
    try {
      await firstValueFrom(this.api.decline(this.token));
      this.justDeclined.set(true);
    } catch {
      this.toastService.showErrorKey(`reference.decline.failed`);
    }
  }

  /**
   * Loads the prefill context for the token from the server and stores it in the {@code context}
   * signal. Network or token-not-found failures populate {@code errorKey} so the template can
   * render an explanatory message instead of a blank page.
   */
  private async loadContext(): Promise<void> {
    if (!this.token) {
      this.errorKey.set(`reference.error.invalidLink`);
      this.loading.set(false);
      return;
    }
    try {
      const context = await firstValueFrom(this.api.getContext(this.token));
      this.context.set(context);
    } catch {
      this.errorKey.set(`reference.error.invalidLink`);
    } finally {
      this.loading.set(false);
    }
  }
}
