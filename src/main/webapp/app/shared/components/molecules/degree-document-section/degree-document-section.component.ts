import { AbstractControl } from '@angular/forms';
import { Component, computed, inject, input, model, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { TooltipModule } from 'primeng/tooltip';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { AiExtractionBoxComponent } from 'app/shared/components/molecules/ai-extraction-box/ai-extraction-box.component';
import {
  DocumentInformationHolderDTO,
  DocumentInformationHolderDTODocumentTypeEnum,
} from 'app/generated/model/document-information-holder-dto';
import { ExtractedApplicationDataDTO } from 'app/generated/model/extracted-application-data-dto';

import { StringInputComponent } from '../../atoms/string-input/string-input.component';
import { UploadButtonComponent, UploadTarget } from '../../atoms/upload-button/upload-button.component';
import TranslateDirective from '../../../language/translate.directive';

@Component({
  selector: 'jhi-degree-document-section',
  standalone: true,
  imports: [FontAwesomeModule, StringInputComponent, TooltipModule, UploadButtonComponent, AiExtractionBoxComponent, TranslateDirective],
  templateUrl: './degree-document-section.component.html',
})
export class DegreeDocumentSectionComponent {
  applicationId = input<string | undefined>(undefined);
  deferUpload = input<boolean>(false);
  uploadTarget = input<UploadTarget>('application');
  required = input<boolean>(false);

  // Bachelor-specific bindings
  bachelorDocumentIds = model<DocumentInformationHolderDTO[] | undefined>(undefined);
  bachelorDegreeNameControl = input<AbstractControl | undefined>(undefined);
  bachelorDegreeUniversityControl = input<AbstractControl | undefined>(undefined);
  bachelorGradeControl = input<AbstractControl | undefined>(undefined);
  bachelorGradeHelperText = input<string>('');
  bachelorGradeHelperTextParams = input<Record<string, unknown>>({});
  bachelorGradeWarningText = input<string>('');
  bachelorQueuedFilesChange = output<File[]>();
  bachelorChangeScale = output();

  // Master-specific bindings
  masterDocumentIds = model<DocumentInformationHolderDTO[] | undefined>(undefined);
  masterDegreeNameControl = input<AbstractControl | undefined>(undefined);
  masterDegreeUniversityControl = input<AbstractControl | undefined>(undefined);
  masterGradeControl = input<AbstractControl | undefined>(undefined);
  masterGradeHelperText = input<string>('');
  masterGradeHelperTextParams = input<Record<string, unknown>>({});
  masterGradeWarningText = input<string>('');
  masterQueuedFilesChange = output<File[]>();
  masterChangeScale = output();

  // AI extraction integration
  saveData = input<boolean>(true);
  bachelorQueuedFiles = input<File[]>([]);
  masterQueuedFiles = input<File[]>([]);
  extracted = output<ExtractedApplicationDataDTO>();

  // Locks the degree inputs while the certificate AI extraction runs, so user edits can't race the values being written back
  isAiExtracting = signal<boolean>(false);

  readonly combinedDocumentIds = computed(() => {
    const bachelor = this.bachelorDocumentIds() ?? [];
    const master = this.masterDocumentIds() ?? [];
    return bachelor.concat(master);
  });

  readonly combinedQueuedFiles = computed(() => this.bachelorQueuedFiles().concat(this.masterQueuedFiles()));

  readonly bachelorCertificateLabelKey = 'entity.applicationPage2.label.bachelorCertificate';
  readonly masterCertificateLabelKey = 'entity.applicationPage2.label.masterCertificate';
  readonly bachelorDegreeNameLabelKey = 'entity.applicationPage2.label.bachelorDegreeName';
  readonly masterDegreeNameLabelKey = 'entity.applicationPage2.label.masterDegreeName';
  readonly bachelorDegreeUniversityLabelKey = 'entity.applicationPage2.label.bachelorDegreeUniversity';
  readonly masterDegreeUniversityLabelKey = 'entity.applicationPage2.label.masterDegreeUniversity';
  readonly bachelorGradeLabelKey = 'entity.applicationPage2.label.bachelorGrade';
  readonly masterGradeLabelKey = 'entity.applicationPage2.label.masterGrade';
  readonly bachelorGradeTooltipKey = 'entity.applicationPage2.tooltip.bachelorGrade';
  readonly masterGradeTooltipKey = 'entity.applicationPage2.tooltip.masterGrade';

  readonly filenamePrivacyTooltip = computed(() => {
    this.langChange();
    return this.translateService.instant('entity.applicationPage2.tooltip.filenamePrivacy');
  });

  protected readonly DocumentInformationHolderDTODocumentTypeEnum = DocumentInformationHolderDTODocumentTypeEnum;

  private translateService = inject(TranslateService);
  private langChange = toSignal(this.translateService.onLangChange, { initialValue: undefined });
}
