import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { DividerComponent } from 'app/shared/components/atoms/divider/divider.component';
import { InterviewResourceApi } from 'app/generated/api/interview-resource-api';
import { IntervieweeDetailDTO } from 'app/generated/model/interviewee-detail-dto';
import { UpdateAssessmentDTO } from 'app/generated/model/update-assessment-dto';
import { ToastService } from 'app/service/toast-service';
import { BackButtonComponent } from 'app/shared/components/atoms/back-button/back-button.component';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { Section } from 'app/shared/components/atoms/section/section';
import { RatingComponent } from 'app/shared/components/atoms/rating/rating.component';
import { EditorComponent } from 'app/shared/components/atoms/editor/editor.component';
import { DocumentSection } from 'app/shared/components/organisms/document-section/document-section';
import { Prose } from 'app/shared/components/atoms/prose/prose';
import { UserAvatarComponent } from 'app/shared/components/atoms/user-avatar/user-avatar.component';
import { SavingBadgeComponent } from 'app/shared/components/atoms/saving-badge/saving-badge.component';
import { AutoSaveController } from 'app/shared/util/auto-save-controller';
import TranslateDirective from 'app/shared/language/translate.directive';
import { formatFullName } from 'app/shared/util/name.util';

/**
 * Assessment view for evaluating interview candidates.
 * Supports auto-saving ratings and manual notes editing with optimistic UI updates.
 */
@Component({
  selector: 'jhi-interviewee-assessment',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslateModule,
    TranslateDirective,
    FontAwesomeModule,
    DividerComponent,
    BackButtonComponent,
    ButtonComponent,
    Section,
    RatingComponent,
    EditorComponent,
    DocumentSection,
    Prose,
    UserAvatarComponent,
    SavingBadgeComponent,
  ],
  templateUrl: './interviewee-assessment.component.html',
})
export class IntervieweeAssessmentComponent {
  // Signals
  protected readonly interviewee = signal<IntervieweeDetailDTO | undefined>(undefined);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | undefined>(undefined);
  protected readonly rating = signal<number | undefined>(undefined);
  protected readonly notesControl = new FormControl<string>('', { nonNullable: true });

  protected readonly autoSave = new AutoSaveController({ save: () => this.persistNotes() });
  protected readonly params = toSignal(inject(ActivatedRoute).paramMap);
  protected readonly queryParamsSignal = toSignal(inject(ActivatedRoute).queryParams);

  // Computed
  protected readonly processId = computed(() => this.params()?.get('processId') ?? '');
  protected readonly intervieweeId = computed(() => this.params()?.get('intervieweeId') ?? '');

  protected readonly applicantName = computed(() => {
    const user = this.interviewee()?.user;
    if (!user) return '';
    return formatFullName(user.firstName, user.lastName);
  });
  protected readonly applicantAvatar = computed(() => this.interviewee()?.user?.avatar);

  protected readonly degreeName = computed(() => {
    const applicant = this.interviewee()?.application?.applicant;
    if (!applicant) return '';
    return applicant.masterDegreeName ?? '';
  });

  protected readonly universityName = computed(() => {
    const applicant = this.interviewee()?.application?.applicant;
    if (!applicant) return '';
    return applicant.masterUniversity ?? '';
  });

  // Extracts motivation text from nested application DTO
  protected readonly motivation = computed(() => this.interviewee()?.application?.motivation ?? '');
  protected readonly skills = computed(() => this.interviewee()?.application?.specialSkills ?? '');

  // Extracts projects/interests from nested application DTO
  protected readonly interests = computed(() => this.interviewee()?.application?.projects ?? '');

  // Returns document IDs for document-section component
  protected readonly documentIds = computed(() => this.interviewee()?.documents);

  // Returns persisted notes (not current editor value)
  protected readonly savedNotes = computed(() => this.interviewee()?.assessmentNotes ?? '');

  // Returns application ID as string for child components
  protected readonly applicationId = computed(() => this.interviewee()?.applicationId?.toString());

  // Returns scheduled slot info if available
  protected readonly slotInfo = computed(() => this.interviewee()?.scheduledSlot);

  // Services
  private readonly router = inject(Router);
  private readonly interviewApi = inject(InterviewResourceApi);
  private readonly toastService = inject(ToastService);
  private readonly serverRating = signal<number | undefined>(undefined);
  private readonly isInitializing = signal<boolean>(true);

  // Effects
  private readonly loadEffect = effect(() => {
    const processId = this.processId();
    const intervieweeId = this.intervieweeId();

    if (processId && intervieweeId) {
      void this.loadInterviewee(processId, intervieweeId);
    }
  });

  private readonly ratingSaveEffect = effect(() => {
    const rating = this.rating();
    const processId = this.processId();
    const intervieweeId = this.intervieweeId();

    if (this.isInitializing()) return;
    if (rating === this.serverRating()) return;
    if (!processId || !intervieweeId) return;

    void this.saveRating(processId, intervieweeId, rating);
  });

  private readonly notesValueSignal = toSignal(this.notesControl.valueChanges, { initialValue: this.notesControl.value });

  /**
   * Debounce notes edits through {@link AutoSaveController}. Skips during the initial load
   * (so simply opening the page does not flip the badge) and when the form value still matches
   * the last persisted snapshot.
   */
  private readonly notesAutoSaveEffect = effect(() => {
    const notes = this.notesValueSignal();
    if (this.isInitializing()) return;
    if (notes === (this.interviewee()?.assessmentNotes ?? '')) return;
    this.autoSave.notifyChanged();
  });

  // Navigates to process detail or overview fallback
  goBack(): void {
    const processId = this.processId();
    if (this.queryParamsSignal()?.from === 'overview') {
      void this.router.navigate(['/interviews/overview']);
      return;
    }

    if (processId) {
      void this.router.navigate(['/interviews', processId]);
    } else {
      void this.router.navigate(['/interviews/overview']);
    }
  }

  /**
   * Save callback invoked by {@link AutoSaveController} when the debounce timer fires.
   * Returns `true` on success so the controller can flip the badge to `SAVED`.
   */
  private async persistNotes(): Promise<boolean> {
    const processId = this.processId();
    const intervieweeId = this.intervieweeId();
    if (!processId || !intervieweeId) return false;

    const dto: UpdateAssessmentDTO = { notes: this.notesControl.value };

    try {
      const updated = await firstValueFrom(this.interviewApi.updateAssessment(processId, intervieweeId, dto));
      this.interviewee.set(updated);
      return true;
    } catch {
      this.toastService.showErrorKey('interview.assessment.error.saveFailed');
      return false;
    }
  }

  // Fetches interviewee details, initializes form state
  private async loadInterviewee(processId: string, intervieweeId: string): Promise<void> {
    this.loading.set(true);
    this.error.set(undefined);
    this.isInitializing.set(true);

    try {
      const data = await firstValueFrom(this.interviewApi.getIntervieweeDetails(processId, intervieweeId));

      this.interviewee.set(data);
      this.rating.set(data.rating ?? undefined);
      this.serverRating.set(data.rating ?? undefined);
      this.notesControl.setValue(data.assessmentNotes ?? '', { emitEvent: false });
    } catch (err) {
      this.handleLoadError(err);
    } finally {
      this.loading.set(false);
      this.isInitializing.set(false);
    }
  }

  private async saveRating(processId: string, intervieweeId: string, rating: number | undefined): Promise<void> {
    const dto: UpdateAssessmentDTO = rating === undefined ? { clearRating: true } : { rating };

    try {
      await firstValueFrom(this.interviewApi.updateAssessment(processId, intervieweeId, dto));
      this.serverRating.set(rating);
    } catch {
      this.toastService.showErrorKey('interview.assessment.error.saveFailed');
      this.rating.set(this.serverRating());
    }
  }

  // Maps HTTP status codes to user-facing error keys
  private handleLoadError(err: unknown): void {
    const httpError = err as { status?: number };

    if (httpError.status === 404) {
      this.error.set('interview.assessment.error.notFound');
    } else if (httpError.status === 403) {
      this.toastService.showErrorKey('interview.assessment.error.loadFailed');
      void this.router.navigate(['/interviews/overview']);
    } else {
      this.error.set('interview.assessment.error.loadFailed');
      this.toastService.showErrorKey('interview.assessment.error.loadFailed');
    }
  }
}
