import { hasText } from 'app/shared/util/text.util';
import { Component, ElementRef, computed, inject, input, model, output, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ToastService } from 'app/service/toast-service';
import { FileUpload } from 'primeng/fileupload';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { TooltipModule } from 'primeng/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TranslateDirective } from 'app/shared/language';
import { ApplicationResourceApi } from 'app/generated/api/application-resource-api';
import { ApplicantResourceApi } from 'app/generated/api/applicant-resource-api';
import {
  DocumentInformationHolderDTO,
  DocumentInformationHolderDTODocumentTypeEnum,
} from 'app/generated/model/document-information-holder-dto';
import { FileSelectEvent } from 'primeng/fileupload';
import { ConfirmDialog } from 'app/shared/components/atoms/confirm-dialog/confirm-dialog';
import { DocumentDialog } from 'app/shared/components/molecules/document-dialog/document-dialog';
import type { DocumentHolder } from 'app/shared/models/document-holder';
import { createTemporaryDocumentId, isTemporaryDocumentId } from 'app/shared/util/document.util';

import { ButtonComponent } from '../button/button.component';

export type DocumentType = DocumentInformationHolderDTODocumentTypeEnum;
export type UploadTarget = 'application' | 'applicantProfile';

/**
 * Generic PDF upload control used by applicant document flows.
 *
 * The component has two operating modes:
 * - immediate upload: accepted files are sent to the backend right away
 * - deferred upload: accepted files are represented locally and emitted to the parent for a later bulk submit
 *
 * Duplicate-name handling, replacement confirmation, local renaming, and size validation all live
 * here so the surrounding pages only need to provide the document type and current document list.
 */
@Component({
  selector: 'jhi-upload-button',
  imports: [
    FontAwesomeModule,
    FormsModule,
    FileUpload,
    ButtonComponent,
    TooltipModule,
    TranslateModule,
    TranslateDirective,
    ConfirmDialog,
    DocumentDialog,
  ],
  templateUrl: './upload-button.component.html',
  standalone: true,
})
export class UploadButtonComponent {
  readonly maxUploadSizeInMb = 25;
  readonly inputClass =
    'w-full min-w-0 px-1 py-1 border-b border-dashed outline-none transition-all hover:border-solid focus:border-solid focus:border-primary';
  readonly rowClass = 'transition-colors hover:bg-background-surface';

  fileUploadComponent = viewChild<FileUpload>(FileUpload);

  documentType = input.required<DocumentType>();
  applicationId = input<string | undefined>();
  uploadTarget = input<UploadTarget>('application');
  documentIds = model<DocumentInformationHolderDTO[] | undefined>();
  valid = output<boolean>();
  queuedFilesChange = output<File[]>();

  /**
   * Optional callback that authenticates the visitor and yields a real
   * `applicationId`. Invoked the first time the user picks a file while
   * `applicationId` is empty. The Promise must resolve only after the parent
   * has propagated the new `applicationId` into this component's input.
   */
  requestAuth = input<() => Promise<void>>();

  selectedFiles = signal<File[] | undefined>(undefined);
  isUploading = signal<boolean>(false);
  disabled = computed(() => (this.documentIds()?.length ?? 0) > 0);
  allowMultiple = input<boolean>(true);
  deferUpload = input<boolean>(false);
  queuedFilesById = signal<Map<string, File>>(new Map());
  queuedFiles = computed(() => Array.from(this.queuedFilesById().values()));
  compact = input<boolean>(false);
  previewDialogVisible = signal(false);
  previewSelectedId = signal<string | undefined>(undefined);
  previewDocumentHolders = computed<DocumentHolder[]>(() =>
    (this.documentIds() ?? [])
      .filter(documentInfo => this.hasPreview(documentInfo))
      .map(documentInfo => ({
        label: documentInfo.name ?? '',
        document: documentInfo,
        file: this.queuedFilesById().get(documentInfo.id),
        shouldTranslateLabel: false,
      })),
  );

  // Duplicate dialog state
  pendingDuplicateFile = signal<File | null>(null);
  duplicateFileName = signal<string>('');

  // Replacement dialog state (for single file mode)
  pendingReplacementFiles = signal<File[]>([]);

  showDuplicateDialog = signal(false);
  showReplacementDialog = signal(false);

  toUploadTooltip = computed(() => {
    this.langChange();
    return this.translateService.instant('entity.upload.tooltip.to_upload');
  });
  alreadyUploadedTooltip = computed(() => {
    this.langChange();
    return this.translateService.instant('entity.upload.tooltip.already_uploaded');
  });

  private applicationApi = inject(ApplicationResourceApi);
  private applicantApi = inject(ApplicantResourceApi);
  private toastService = inject(ToastService);
  private elementRef = inject(ElementRef);
  private translateService = inject(TranslateService);
  private langChange = toSignal(this.translateService.onLangChange, { initialValue: undefined });

  async onFileSelected(event: FileSelectEvent): Promise<void> {
    const files: File[] = event.currentFiles;

    if (!(await this.ensureAuthenticated())) {
      this.fileUploadComponent()?.clear();
      this.resetNativeFileInput();
      return;
    }

    // For single-file mode, check if document already exists
    if (!this.allowMultiple() && (this.documentIds()?.length ?? 0) > 0) {
      this.pendingReplacementFiles.set(files);
      this.showReplacementDialog.set(true);
      this.fileUploadComponent()?.clear();
      this.resetNativeFileInput();
      return;
    }

    // Check for duplicate filenames
    for (const file of files) {
      if (this.isDuplicateFilename(file.name)) {
        // Show confirmation dialog for duplicate
        this.pendingDuplicateFile.set(file);
        this.duplicateFileName.set(file.name);

        this.showDuplicateDialog.set(true);

        this.fileUploadComponent()?.clear();
        this.resetNativeFileInput();
        return;
      }
    }

    // No duplicates, proceed with upload
    await this.processFiles(files);
  }

  /**
   * Replaces the existing document that shares the same display name as the pending file.
   *
   * In deferred mode only local state is changed. In immediate mode the old server document is
   * deleted first so the UI state and persisted state stay aligned.
   */
  async onConfirmDuplicate(): Promise<void> {
    const pendingFile = this.pendingDuplicateFile();
    if (!pendingFile) {
      return;
    }

    // Find and delete the existing document with the same name
    const existingDoc = this.documentIds()?.find(doc => doc.name === pendingFile.name);
    if (existingDoc) {
      if (this.deferUpload()) {
        const updatedList = this.documentIds()?.filter(doc => doc.id !== existingDoc.id) ?? [];
        this.documentIds.set(updatedList);
        this.removeQueuedFileFor(existingDoc.id);
      } else {
        try {
          await this.deletePersistedDocument(existingDoc.id);
          const updatedList = this.documentIds()?.filter(doc => doc.id !== existingDoc.id) ?? [];
          this.documentIds.set(updatedList);
        } catch {
          this.toastService.showErrorKey('entity.upload.error.replace_failed');
          this.pendingDuplicateFile.set(null);
          return;
        }
      }
    }

    await this.processFiles([pendingFile]);
    this.pendingDuplicateFile.set(null);
  }

  /**
   * Handles the "replace current file" flow for single-file document types such as CV.
   *
   * Existing entries are cleared first, then the newly selected file is processed as a normal
   * upload or deferred queue addition.
   */
  async onConfirmReplacement(): Promise<void> {
    const pendingFiles = this.pendingReplacementFiles();
    if (pendingFiles.length === 0) {
      return;
    }

    // Delete all existing documents (for single-file mode replacement)
    const existingDocs = this.documentIds() ?? [];
    if (this.deferUpload()) {
      this.documentIds.set([]);
      this.queuedFilesById.set(new Map());
      this.emitQueuedFilesChange();
    } else {
      for (const doc of existingDocs) {
        try {
          await this.deletePersistedDocument(doc.id);
        } catch {
          this.toastService.showErrorKey('entity.upload.error.replace_failed');
          return;
        }
      }

      // Clear the document list before uploading new file
      this.documentIds.set([]);
    }

    await this.processFiles(pendingFiles);
    this.pendingReplacementFiles.set([]);
  }

  async onUpload(): Promise<void> {
    const files: File[] | undefined = this.selectedFiles();
    if (!files || files.length === 0) return;

    this.isUploading.set(true);
    try {
      const uploadedPromises = files.map(file => this.uploadDocument(file));
      const uploadResults = await Promise.all(uploadedPromises);
      const allUploadedIds = uploadResults.flat();
      this.documentIds.set(allUploadedIds);
      this.selectedFiles.set([]);
    } catch {
      this.toastService.showErrorKey('entity.upload.error.upload_failed');
    } finally {
      this.isUploading.set(false);
      this.resetNativeFileInput();
    }
  }

  /**
   * Deletes a persisted server document or, in deferred mode, removes the corresponding local placeholder.
   */
  async deleteDictionary(documentInfo: DocumentInformationHolderDTO): Promise<void> {
    const documentId = documentInfo.id;
    if (this.deferUpload()) {
      const updatedList = this.documentIds()?.filter(doc => doc.id !== documentId) ?? [];
      this.documentIds.set(updatedList);
      this.removeQueuedFileFor(documentId);
      return;
    }

    try {
      await this.deletePersistedDocument(documentId);
      const updatedList = this.documentIds()?.filter(doc => doc.id !== documentId) ?? [];
      this.documentIds.set(updatedList);
    } catch {
      this.toastService.showErrorKey('entity.upload.error.delete_failed');
    }
  }

  onClear(): void {
    this.isUploading.set(false);
    this.resetNativeFileInput();
  }

  openPreview(documentInfo: DocumentInformationHolderDTO): void {
    if (!this.hasPreview(documentInfo)) {
      return;
    }

    this.previewSelectedId.set(documentInfo.id);
    this.previewDialogVisible.set(true);
  }

  /**
   * Persists an inline filename edit when possible.
   *
   * Deferred mode only updates local placeholder data because there is nothing on the server yet.
   */
  async renameDocument(documentInfo: DocumentInformationHolderDTO): Promise<void> {
    const newName = documentInfo.name ?? '';
    if (!newName) {
      return;
    }

    const documentId = documentInfo.id;
    if (this.deferUpload()) {
      const updatedDocs =
        this.documentIds()?.map(doc =>
          doc.id === documentId
            ? {
                id: doc.id,
                name: newName,
                size: doc.size,
              }
            : doc,
        ) ?? [];
      this.documentIds.set(updatedDocs);
      this.renameQueuedFile(documentId, newName);
      return;
    }

    try {
      await this.renamePersistedDocument(documentId, newName);
      const updatedDocs =
        this.documentIds()?.map(doc =>
          doc.id === documentId
            ? {
                id: doc.id,
                name: newName,
                size: doc.size,
              }
            : doc,
        ) ?? [];
      this.documentIds.set(updatedDocs);
    } catch {
      this.toastService.showErrorKey('entity.upload.error.rename_failed');
    }
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    const size = bytes / Math.pow(k, i);
    return `${parseFloat(size.toFixed(1))} ${sizes[i]}`;
  }

  hasPreview(documentInfo: DocumentInformationHolderDTO): boolean {
    if (isTemporaryDocumentId(documentInfo.id)) {
      return this.queuedFilesById().has(documentInfo.id);
    }

    return true;
  }

  /**
   * Ensures an `applicationId` is available before any upload action proceeds.
   * Returns true when already set, or after a successful `requestAuth()` call.
   * Returns false when no callback is provided and the id is missing, or when
   * the callback rejects (user cancelled / validation failed upstream).
   */
  private async ensureAuthenticated(): Promise<boolean> {
    // In deferred mode the file pick never reaches this component's upload paths — the parent
    // owns the upload step and is responsible for whatever auth model that flow needs.
    if (this.deferUpload()) {
      return true;
    }
    if (this.uploadTarget() === 'applicantProfile') {
      return true;
    }
    const appId = this.applicationId();
    if (hasText(appId)) {
      return true;
    }
    const trigger = this.requestAuth();
    if (!trigger) {
      return false;
    }
    try {
      await trigger();
    } catch {
      return false;
    }
    // Re-read: the auth callback above creates the application, so appId from before it is stale.
    return hasText(this.applicationId());
  }

  private isDuplicateFilename(filename: string): boolean {
    const existingDocs = this.documentIds() ?? [];
    return existingDocs.some(doc => doc.name === filename);
  }

  /**
   * Validates incoming files and normalizes them into the component's state model.
   *
   * The main distinction here is:
   * - deferred mode: create temporary `documentIds` entries and keep the real `File` objects in `queuedFiles`
   * - immediate mode: stage files in `selectedFiles` and then call `onUpload()`
   *
   * Total-size validation includes both already persisted documents and newly chosen files so the UI
   * cannot drift past the same overall limit through multiple smaller additions.
   */
  private async processFiles(files: File[]): Promise<void> {
    const maxSizeBytes = this.maxUploadSizeInMb * 1024 * 1024;
    const maxTotalSizeMb = this.maxUploadSizeInMb; // total limit (MB) — same as per-file by design
    const maxTotalSizeBytes = maxTotalSizeMb * 1024 * 1024;

    // Validate incoming files individually first (always enforce per-file limit)
    for (const file of files) {
      if (file.size > maxSizeBytes) {
        this.toastService.showErrorKey('entity.upload.error.too_large_detailed', {
          maxSize: this.maxUploadSizeInMb.toString(),
          totalSize: `${file.name} (${this.formatSize(file.size)})`,
        });
        this.fileUploadComponent()?.clear();
        this.resetNativeFileInput();
        return;
      }
    }

    // Consider already selected files when calculating the total size
    const selectedFile = this.deferUpload() ? this.queuedFiles() : (this.selectedFiles() ?? []);

    const combinedFiles = selectedFile.concat(files);
    const combinedFilesTotal = combinedFiles.reduce((sum, file) => sum + file.size, 0);

    // Also include already uploaded documents (persisted on the server) in the total size
    const existingDocs = this.documentIds() ?? [];
    const existingDocsTotal = existingDocs.reduce((sum, doc) => sum + doc.size, 0);

    const totalSize = existingDocsTotal + combinedFilesTotal;

    // Enforce combined total size limit
    if (totalSize > maxTotalSizeBytes) {
      this.toastService.showErrorKey('entity.upload.error.total_too_large', {
        maxTotal: maxTotalSizeMb.toString(),
        actualTotal: this.formatSize(totalSize),
      });
      this.fileUploadComponent()?.clear();
      this.resetNativeFileInput();
      return;
    }

    if (this.deferUpload()) {
      const updatedQueuedFiles = new Map(this.queuedFilesById());
      const tempDocumentEntries: DocumentInformationHolderDTO[] = files.map(file => {
        const id = createTemporaryDocumentId();
        updatedQueuedFiles.set(id, file);
        return {
          id,
          name: file.name,
          size: file.size,
        };
      });
      const updatedList = (this.documentIds() ?? []).concat(tempDocumentEntries);
      this.documentIds.set(updatedList);
      this.queuedFilesById.set(updatedQueuedFiles);
      this.emitQueuedFilesChange();
      this.fileUploadComponent()?.clear();
      this.resetNativeFileInput();
      return;
    }

    // Only add files if validation passes
    this.selectedFiles.set(combinedFiles);

    this.fileUploadComponent()?.clear();
    this.resetNativeFileInput();
    await this.onUpload();
  }

  private resetNativeFileInput(): void {
    // Use setTimeout to ensure DOM is updated
    setTimeout(() => {
      const nativeInput = this.elementRef.nativeElement.querySelector('input[type="file"]');
      if (nativeInput !== null) {
        nativeInput.value = '';
      }
    }, 0);
  }

  /**
   * Keeps the deferred upload queue in sync with the placeholder row removed from `documentIds`.
   */
  private removeQueuedFileFor(documentId: string): void {
    const filesById = this.queuedFilesById();
    if (!filesById.has(documentId)) {
      return;
    }
    const updated = new Map(filesById);
    updated.delete(documentId);
    this.queuedFilesById.set(updated);
    this.emitQueuedFilesChange();
  }

  private renameQueuedFile(documentId: string, newName: string): void {
    const queuedFile = this.queuedFilesById().get(documentId);
    if (!queuedFile || queuedFile.name === newName) {
      return;
    }

    const renamedFile = new File([queuedFile], newName, {
      type: queuedFile.type,
      lastModified: queuedFile.lastModified,
    });
    const updated = new Map(this.queuedFilesById());
    updated.set(documentId, renamedFile);
    this.queuedFilesById.set(updated);
    this.emitQueuedFilesChange();
  }

  private emitQueuedFilesChange(): void {
    this.queuedFilesChange.emit(this.queuedFiles());
  }

  private uploadDocument(file: File): Promise<DocumentInformationHolderDTO[]> {
    if (this.uploadTarget() === 'applicantProfile') {
      return firstValueFrom(this.applicantApi.uploadApplicantProfileDocuments(this.documentType(), file));
    }

    const appId = this.applicationId();
    if (appId == null) {
      return Promise.resolve([]);
    }

    return firstValueFrom(this.applicationApi.uploadDocuments(appId, this.documentType(), file));
  }

  private async deletePersistedDocument(documentId: string): Promise<void> {
    if (this.uploadTarget() === 'applicantProfile') {
      await firstValueFrom(this.applicantApi.deleteApplicantProfileDocument(documentId));
      return;
    }

    await firstValueFrom(this.applicationApi.deleteDocumentFromApplication(documentId));
  }

  private async renamePersistedDocument(documentId: string, newName: string): Promise<void> {
    if (this.uploadTarget() === 'applicantProfile') {
      await firstValueFrom(this.applicantApi.renameApplicantProfileDocument(documentId, newName));
      return;
    }

    await firstValueFrom(this.applicationApi.renameDocument(documentId, newName));
  }
}
