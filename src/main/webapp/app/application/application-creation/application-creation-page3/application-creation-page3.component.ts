import { ChangeDetectionStrategy, Component, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TextareaModule } from 'primeng/textarea';
import { FloatLabelModule } from 'primeng/floatlabel';
import { UploadButtonComponent } from 'app/shared/components/atoms/upload-button/upload-button.component';
import { DividerModule } from 'primeng/divider';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TooltipModule } from 'primeng/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { EditorComponent } from 'app/shared/components/atoms/editor/editor.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { DatePickerComponent } from 'app/shared/components/atoms/datepicker/datepicker.component';
import { ApplicationForApplicantDTO } from 'app/generated/model/application-for-applicant-dto';
import { DocumentInformationHolderDTO } from 'app/generated/model/document-information-holder-dto';
import { htmlTextRequiredValidator } from 'app/shared/validators/custom-validators';
import { deepEqual } from 'app/core/util/deepequal-util';
import { TranslateDirective } from 'app/shared/language';

export type ApplicationCreationPage3Data = {
  desiredStartDate: string;
  motivation: string;
  skills: string;
  experiences: string;
};

export const getPage3FromApplication = (application: ApplicationForApplicantDTO): ApplicationCreationPage3Data => {
  return {
    desiredStartDate: application.desiredDate ?? '',
    motivation: application.motivation ?? '',
    skills: application.specialSkills ?? '',
    experiences: application.projects ?? '',
  };
};

@Component({
  selector: 'jhi-application-creation-page3',
  imports: [
    ReactiveFormsModule,
    FloatLabelModule,
    DividerModule,
    DatePickerComponent,
    TextareaModule,
    UploadButtonComponent,
    FontAwesomeModule,
    TooltipModule,
    TranslateModule,
    TranslateDirective,
    EditorComponent,
  ],
  templateUrl: './application-creation-page3.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
})
export default class ApplicationCreationPage3Component {
  data = model<ApplicationCreationPage3Data>();

  applicationIdForDocuments = input<string | undefined>();
  documentIdsReferences = input<DocumentInformationHolderDTO[] | undefined>();

  valid = output<boolean>();
  changed = output<boolean>();

  hasInitialized = signal(false);

  formbuilder = inject(FormBuilder);

  page3Form: FormGroup = this.formbuilder.group({
    experiences: ['', htmlTextRequiredValidator],
    motivation: ['', htmlTextRequiredValidator],
    skills: ['', htmlTextRequiredValidator],
    desiredStartDate: [''],
  });

  formValue = toSignal(this.page3Form.valueChanges.pipe(debounceTime(100)).pipe(distinctUntilChanged(deepEqual)), {
    initialValue: this.page3Form.value,
  });

  formStatus = toSignal(this.page3Form.statusChanges, {
    initialValue: this.page3Form.status,
  });

  private updateEffect = effect(() => {
    if (!this.hasInitialized()) return;
    const raw = this.formValue();
    const normalized = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v ?? ''])) as ApplicationCreationPage3Data;

    const newData = { ...this.data(), ...normalized };
    if (!deepEqual(newData, this.data())) {
      this.data.set(newData);
      this.changed.emit(true);
    }
    this.valid.emit(this.page3Form.valid);
  });

  private initializeFormEffect = effect(() => {
    if (this.hasInitialized()) return;
    const data = this.data();
    if (!data) return;
    this.page3Form.patchValue({
      experiences: data.experiences,
      motivation: data.motivation,
      skills: data.skills,
      desiredStartDate: data.desiredStartDate,
    });
    this.hasInitialized.set(true);
  });

  emitChanged(): void {
    this.changed.emit(true);
  }

  setDesiredStartDate($event: string | undefined): void {
    const currentData = this.data();
    if (currentData !== undefined) {
      this.data.set({
        ...currentData,
        desiredStartDate: $event ?? '',
      });
    }

    this.page3Form.patchValue({
      desiredStartDate: $event ?? '',
    });
    this.emitChanged();
  }
}
