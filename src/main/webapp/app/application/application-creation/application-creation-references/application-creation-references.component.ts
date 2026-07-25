import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { DividerModule } from 'primeng/divider';
import { SelectModule } from 'primeng/select';
import { firstValueFrom } from 'rxjs';
import { ButtonComponent } from 'app/shared/components/atoms/button/button.component';
import { StringInputComponent } from 'app/shared/components/atoms/string-input/string-input.component';
import { CheckboxComponent } from 'app/shared/components/atoms/checkbox/checkbox.component';
import { ToastService } from 'app/service/toast-service';
import TranslateDirective from 'app/shared/language/translate.directive';
import { ReferenceRequestResourceApi } from 'app/generated/api/reference-request-resource-api';
import { ReferenceRequestDTO } from 'app/generated/model/reference-request-dto';
import { RecommendationType } from 'app/generated/model/recommendation-type';
import { SelectComponent, SelectOption } from 'app/shared/components/atoms/select/select.component';

const TITLE_OPTIONS: readonly string[] = ['Prof. Dr.', 'Prof.', 'Dr.'];

const TOAST_PREFIX = 'entity.applicationReferences';

/**
 * Manages the referee contacts (title / first name / last name / email) of an application.
 * Used both as a step in the application creation flow and on the application detail page after
 * submission, letting the applicant add, edit and remove referees. Referees whose letter has already
 * been submitted are shown but cannot be edited or removed.
 */
@Component({
  selector: 'jhi-application-creation-references',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    TranslateDirective,
    FontAwesomeModule,
    DividerModule,
    SelectModule,
    ButtonComponent,
    StringInputComponent,
    SelectComponent,
    CheckboxComponent,
  ],
  templateUrl: './application-creation-references.component.html',
})
export default class ApplicationCreationReferencesComponent {
  applicationId = input.required<string>();
  requiredCount = input<number>(0);
  descriptionKey = input<string>('entity.applicationReferences.description');
  applicationCreation = input<boolean>(true);
  referenceLettersConfidential = input<boolean>(true);
  recommendationType = input<RecommendationType | undefined>(undefined);

  /** References the parent already loaded (e.g. inlined in the ApplicationDetailDTO on the detail page). */
  preloadedReferences = input<ReferenceRequestDTO[] | undefined>(undefined);

  changed = output<boolean>();
  referencesChanged = output<ReferenceRequestDTO[]>();
  referenceLettersConfidentialChanged = output<boolean>();

  references = signal<ReferenceRequestDTO[]>([]);
  loading = signal<boolean>(false);
  readonly editingId = signal<string | undefined>(undefined);

  readonly descriptionParams = computed(() => {
    const type = this.recommendationType();
    return { type: type ?? 'other' };
  });

  readonly titleOptions: SelectOption[] = TITLE_OPTIONS.map(value => ({ name: value, value }));
  readonly selectedTitleOption = signal<SelectOption | undefined>(undefined);

  readonly formBuilder = inject(FormBuilder);

  readonly addForm = this.formBuilder.nonNullable.group({
    title: this.formBuilder.nonNullable.control(''),
    firstName: this.formBuilder.nonNullable.control('', Validators.required),
    lastName: this.formBuilder.nonNullable.control('', Validators.required),
    email: this.formBuilder.nonNullable.control('', [Validators.required, Validators.email, Validators.pattern(/.+\..{2,}$/)]),
  });

  /** Whether the applicant waives access to the submitted letters (only the professor sees them). */
  readonly confidentialControl = this.formBuilder.nonNullable.control(true);

  private readonly initialized = signal<boolean>(false);
  private readonly toastService = inject(ToastService);
  private readonly referenceApi = inject(ReferenceRequestResourceApi);

  /**
   * Seeds the list once the active applicationId becomes available: reuses the references passed in
   * via {@link preloadedReferences} when the parent already loaded them, otherwise fetches them from
   * the server. Independent of auto-save: each add/remove is persisted directly.
   */
  private readonly loadEffect = effect(() => {
    const id = this.applicationId();
    if (!id || this.initialized()) return;
    this.initialized.set(true);
    this.confidentialControl.setValue(this.referenceLettersConfidential(), { emitEvent: false });

    const preloaded = this.preloadedReferences();
    if (preloaded !== undefined) {
      this.references.set(preloaded);
      this.referencesChanged.emit(preloaded);
      return;
    }
    void this.refresh();
  });

  /**
   * Updates the bound form control whenever the title dropdown selection changes.
   *
   * @param option the newly selected option, or undefined when the selection is cleared
   */
  onTitleSelected(option: SelectOption | undefined): void {
    const selected: SelectOption | undefined = option ?? undefined;
    this.selectedTitleOption.set(selected);
    this.addForm.controls.title.setValue(typeof selected?.value === 'string' ? selected.value : '');
  }

  /**
   * Submits the form: saves edits to the referee currently being edited, or adds a new one.
   */
  async onSubmit(): Promise<void> {
    const currentId = this.editingId();
    if (currentId !== undefined && currentId !== '') {
      await this.onUpdate();
    } else {
      await this.onAdd();
    }
  }

  /**
   * Adds a new referee to the application by sending the entered data to the server.
   * On success, the new entry is added to the local list and the form is reset.
   */
  async onAdd(): Promise<void> {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    try {
      const created = await firstValueFrom(this.referenceApi.add(this.applicationId(), this.buildPayload()));
      this.references.update(list => list.concat(created));
      if (!this.applicationCreation()) {
        this.toastService.showSuccessKey(`${TOAST_PREFIX}.toast.emailSent`);
      }
      this.referencesChanged.emit(this.references());
      this.resetForm();
    } catch {
      this.toastService.showErrorKey(`${TOAST_PREFIX}.toast.addFailed`);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Saves edits to the referee currently being edited by sending the entered data to the server.
   * On success, the matching entry in the local list is replaced with the server's response.
   */
  async onUpdate(): Promise<void> {
    const id = this.editingId();
    if (id === undefined || id === '') return;
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    try {
      const updated = await firstValueFrom(this.referenceApi.update(this.applicationId(), id, this.buildPayload()));
      this.references.update(list => list.map(reference => (reference.referenceRequestId === id ? updated : reference)));
      this.referencesChanged.emit(this.references());
      this.resetForm();
    } catch {
      this.toastService.showErrorKey(`${TOAST_PREFIX}.toast.updateFailed`);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Loads the given referee into the form so its title, name and email can be edited.
   *
   * @param reference the referee entry to edit
   */
  onEdit(reference: ReferenceRequestDTO): void {
    if (reference.referenceRequestId === undefined || reference.referenceRequestId === '') return;
    this.selectedTitleOption.set(this.titleOptions.find(option => option.value === reference.title));
    this.addForm.reset({
      title: reference.title ?? '',
      firstName: reference.firstName ?? '',
      lastName: reference.lastName ?? '',
      email: reference.email ?? '',
    });
    this.editingId.set(reference.referenceRequestId);
  }

  /**
   * Discards the in-progress edit and returns the form to add mode.
   */
  onCancelEdit(): void {
    this.resetForm();
  }

  /**
   * Removes the given referee from the application by sending a delete request to the server.
   * On success, the entry is removed from the local list.
   *
   * @param reference the referee entry to remove
   */
  async onRemove(reference: ReferenceRequestDTO): Promise<void> {
    if (reference.referenceRequestId === undefined || reference.referenceRequestId === '') return;
    this.loading.set(true);
    try {
      await firstValueFrom(this.referenceApi.remove(this.applicationId(), reference.referenceRequestId));
      this.references.update(list => list.filter(r => r.referenceRequestId !== reference.referenceRequestId));
      if (this.editingId() === reference.referenceRequestId) {
        this.resetForm();
      }
      this.referencesChanged.emit(this.references());
    } catch {
      this.toastService.showErrorKey(`${TOAST_PREFIX}.toast.removeFailed`);
    } finally {
      this.loading.set(false);
    }
  }

  onConfidentialChange(confidential: boolean): void {
    this.referenceLettersConfidentialChanged.emit(confidential);
    this.changed.emit(true);
  }

  /**
   * Builds the request payload from the current form values, trimming whitespace and
   * omitting an empty title.
   */
  private buildPayload(): { title?: string; firstName: string; lastName: string; email: string } {
    const raw = this.addForm.getRawValue();
    return {
      title: raw.title.trim() || undefined,
      firstName: raw.firstName.trim(),
      lastName: raw.lastName.trim(),
      email: raw.email.trim(),
    };
  }

  /**
   * Clears the form value and resets validation and edit state so the inputs render as
   * pristine and untouched after a successful submit or a cancelled edit.
   */
  private resetForm(): void {
    this.editingId.set(undefined);
    this.selectedTitleOption.set(undefined);
    this.addForm.reset({ title: '', firstName: '', lastName: '', email: '' });
    this.addForm.markAsPristine();
    this.addForm.markAsUntouched();
    Object.values(this.addForm.controls).forEach(control => {
      control.markAsPristine();
      control.markAsUntouched();
    });
  }

  /**
   * Loads the current list of references from the server and updates the local state.
   */
  private async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const list = await firstValueFrom(this.referenceApi.getReferences(this.applicationId()));
      this.references.set(list);
      this.referencesChanged.emit(this.references());
    } catch {
      this.toastService.showErrorKey(`${TOAST_PREFIX}.toast.loadFailed`);
    } finally {
      this.loading.set(false);
    }
  }
}
