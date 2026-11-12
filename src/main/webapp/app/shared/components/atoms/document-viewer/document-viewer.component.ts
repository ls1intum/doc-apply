import { Component, effect, inject, input, signal } from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { DocumentResourceApi } from 'app/generated/api/document-resource-api';
import { DocumentInformationHolderDTO } from 'app/generated/model/document-information-holder-dto';
import { DocumentCacheService } from 'app/service/document-cache.service';

@Component({
  selector: 'jhi-document-viewer',
  imports: [],
  templateUrl: './document-viewer.component.html',
  standalone: true,
})
export class DocumentViewerComponent {
  documentId = input.required<DocumentInformationHolderDTO>();
  documentFile = input<File | undefined>(undefined);

  sanitizedBlobUrl = signal<SafeResourceUrl | undefined>(undefined);

  private documentApi = inject(DocumentResourceApi);
  private cache: DocumentCacheService = inject(DocumentCacheService);

  private readonly docDownloadEffect = effect(() => {
    const docId = this.documentId().id;
    const file = this.documentFile();
    void this.initDocument(docId, file);
  });

  async initDocument(docId: string = this.documentId().id, file: File | undefined = this.documentFile()): Promise<void> {
    if (file) {
      const safeUrl = this.cache.set(docId, file);
      this.sanitizedBlobUrl.set(safeUrl);
      return;
    }

    // check cache first
    const cached = this.cache.get(docId);
    if (cached !== undefined) {
      this.sanitizedBlobUrl.set(cached);
      return;
    }

    try {
      const response = await firstValueFrom(this.documentApi.downloadDocument(docId));
      const body = response.body;
      const pdfBlob = body ? new Blob([body], { type: 'application/pdf' }) : new Blob([], { type: 'application/pdf' });
      const safeUrl = this.cache.set(docId, pdfBlob);
      this.sanitizedBlobUrl.set(safeUrl);
    } catch (error) {
      console.error('Document download failed:', error);
      this.sanitizedBlobUrl.set(undefined);
    }
  }
}
