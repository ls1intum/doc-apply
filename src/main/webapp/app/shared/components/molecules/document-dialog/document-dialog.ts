import { Component, Signal, ViewEncapsulation, computed, effect, input, model } from '@angular/core';
import { DocumentInformationHolderDTO } from 'app/generated/model/document-information-holder-dto';
import { DocumentViewerComponent } from 'app/shared/components/atoms/document-viewer/document-viewer.component';
import { DialogComponent } from 'app/shared/components/atoms/dialog/dialog.component';
import type { DocumentHolder } from 'app/shared/models/document-holder';

import TranslateDirective from '../../../language/translate.directive';

@Component({
  selector: 'jhi-document-dialog',
  imports: [DialogComponent, DocumentViewerComponent, TranslateDirective],
  templateUrl: './document-dialog.html',
  encapsulation: ViewEncapsulation.None,
})
export class DocumentDialog {
  documentHolders = input<DocumentHolder[]>([]);
  isOpen = model<boolean>(false);

  readonly selectedId = model<string | undefined>(undefined);

  _initSelection = effect(() => {
    const list = this.documentHolders();
    const currentSelectedId = this.selectedId();

    if (list.length === 0) {
      if (currentSelectedId !== undefined) {
        this.selectedId.set(undefined);
      }
      return;
    }

    const selectionStillExists = currentSelectedId !== undefined && list.some(holder => holder.document.id === currentSelectedId);
    if (!selectionStillExists) {
      this.selectedId.set(list[0].document.id);
    }
  });

  selectedHolder = computed<DocumentHolder | undefined>(() => {
    const id = this.selectedId();
    if (id === undefined) {
      return undefined;
    }
    return this.documentHolders().find(d => d.document.id === id) ?? undefined;
  });

  selectedDocument = computed<DocumentInformationHolderDTO | undefined>(() => this.selectedHolder()?.document);
  selectedFile = computed<File | undefined>(() => this.selectedHolder()?.file);

  isSelected: (documentId: string) => Signal<boolean> = (documentId: string) => computed(() => this.selectedDocument()?.id === documentId);

  selectDoc(id: string): void {
    this.selectedId.set(id);
  }
}
