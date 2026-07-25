import { Component, computed, effect, inject, input, model, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HttpResponse } from '@angular/common/http';

import { DocumentViewerComponent } from '../../atoms/document-viewer/document-viewer.component';
import { SubSection } from '../../atoms/sub-section/sub-section';
import TranslateDirective from '../../../language/translate.directive';
import { ToastService } from '../../../../service/toast-service';
import { ApplicationDocumentIdsDTO } from '../../../../generated/model/application-document-ids-dto';
import { ReferenceRequestDTO } from '../../../../generated/model/reference-request-dto';
import { ApplicationEvaluationResourceApi } from '../../../../generated/api/application-evaluation-resource-api';
import type { DocumentHolder } from '../../../models/document-holder';
import { DocumentDialog } from '../../molecules/document-dialog/document-dialog';
@Component({
  selector: 'jhi-document-section',
  imports: [DocumentViewerComponent, SubSection, TranslateDirective, DocumentDialog],
  templateUrl: './document-section.html',
})
export class DocumentSection {
  idsDTO = input<ApplicationDocumentIdsDTO | undefined>(undefined);
  applicationId = input.required<string | undefined>();

  /** External reference letters uploaded by referees, to be merged into the listed documents. */
  referenceLetters = input<ReferenceRequestDTO[]>([]);

  documents = signal<DocumentHolder[]>([]);
  extraDocuments = signal<DocumentHolder[]>([]);

  allDocuments = computed(() => [...this.documents(), ...this.extraDocuments()]);

  dialogVisible = model<boolean>(false);

  /** Id of the document the dialog should focus when it opens. */
  selectedDocumentId = signal<string | undefined>(undefined);

  documentsCount = signal<number>(0);

  readonly NUMBER_OF_DOCUMENTS = 3;

  evaluationApi = inject(ApplicationEvaluationResourceApi);
  toastService = inject(ToastService);

  hasDocuments = computed(() => this.documents().length > 0);

  idChangeEffect = effect(() => {
    const dto = this.idsDTO();
    const letters = this.referenceLetters();

    if (!dto && letters.length === 0) {
      this.documents.set([]);
      this.extraDocuments.set([]);
      this.documentsCount.set(0);
      return;
    }

    const result: DocumentHolder[] = [];

    dto?.masterDocumentIds?.forEach(d =>
      result.push({ label: 'evaluation.details.documentTypeMaster', document: d, shouldTranslateLabel: true }),
    );

    if (dto?.cvDocumentId) {
      result.push({ label: 'evaluation.details.documentTypeCV', document: dto.cvDocumentId, shouldTranslateLabel: true });
    }

    dto?.bachelorDocumentIds?.forEach(d =>
      result.push({ label: 'evaluation.details.documentTypeBachelor', document: d, shouldTranslateLabel: true }),
    );

    dto?.referenceDocumentIds?.forEach(d =>
      result.push({ label: 'evaluation.details.documentTypeReference', document: d, shouldTranslateLabel: true }),
    );

    letters
      .filter((letter): letter is ReferenceRequestDTO & { documentId: string } => !!letter.documentId)
      .forEach(letter => {
        const refereeName = [letter.title, letter.firstName, letter.lastName].filter(part => !!part).join(' ');
        result.push({
          label: 'evaluation.details.documentTypeReferenceLetter',
          labelParams: { name: refereeName },
          shouldTranslateLabel: true,
          document: { id: letter.documentId, name: refereeName, size: 0 },
        });
      });

    this.documentsCount.set(result.length);

    // Split into "shown" and "extra"
    this.documents.set(result.slice(0, this.NUMBER_OF_DOCUMENTS));
    this.extraDocuments.set(result.slice(this.NUMBER_OF_DOCUMENTS));
  });

  /**
   * Opens the document dialog with the given document selected.
   * @param documentId the id of the document to display; ignored when undefined
   */
  openDocument(documentId: string | undefined): void {
    if (documentId === undefined) {
      return;
    }
    this.selectedDocumentId.set(documentId);
    this.dialogVisible.set(true);
  }

  async downloadAllDocuments(): Promise<void> {
    const applicationId = this.applicationId();
    if (applicationId === undefined) {
      this.toastService.showError({ summary: 'Error', detail: 'No application selected' });
      return;
    }

    try {
      const response: HttpResponse<Blob> = await firstValueFrom(this.evaluationApi.downloadAll(applicationId));

      const blob = response.body;

      if (blob != null) {
        // Try to extract filename from Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'documents.zip';
        if (contentDisposition != null) {
          const match = /filename="?([^"]+)"?/.exec(contentDisposition);
          if (match?.[1] != null) {
            filename = match[1];
          }
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch {
      this.toastService.showError({ summary: 'Error', detail: 'Failed to download documents' });
    }
  }
}
