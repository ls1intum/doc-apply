import { Component, Signal, ViewEncapsulation, computed, effect, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { DocumentInformationHolderDTO } from 'app/generated/model/document-information-holder-dto';
import { DocumentViewerComponent } from 'app/shared/components/atoms/document-viewer/document-viewer.component';
import { DialogComponent } from 'app/shared/components/atoms/dialog/dialog.component';
import type { DocumentHolder } from 'app/shared/models/document-holder';

import TranslateDirective from '../../../language/translate.directive';

@Component({
  selector: 'jhi-document-dialog',
  imports: [DialogComponent, CheckboxModule, FormsModule, DocumentViewerComponent, TranslateDirective],
  templateUrl: './document-dialog.html',
  encapsulation: ViewEncapsulation.None,
})
export class DocumentDialog {
  documentHolders = input<DocumentHolder[]>([]);
  isOpen = model<boolean>(false);

  readonly selectedId = model<string | undefined>(undefined);
  readonly checkedIds = signal<Set<string>>(new Set());

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

  isChecked: (id: string) => Signal<boolean> = (id: string) => computed(() => this.checkedIds().has(id));

  toggleChecked(id: string, checked: boolean): void {
    const next = new Set(this.checkedIds());
    if (checked) next.add(id);
    else next.delete(id);
    this.checkedIds.set(next);
  }

  selectDoc(id: string): void {
    this.selectedId.set(id);
  }
}
