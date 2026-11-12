import { Component, ViewEncapsulation, computed, effect, inject, input, model, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TextareaModule } from 'primeng/textarea';
import { TranslateService } from '@ngx-translate/core';
import { TimeAgoPipe } from 'app/shared/pipes';

import { ButtonComponent } from '../../atoms/button/button.component';
import { ConfirmDialog } from '../../atoms/confirm-dialog/confirm-dialog';
import { RatingComponent } from '../../atoms/rating/rating.component';

@Component({
  selector: 'jhi-comment',
  imports: [ButtonComponent, TextareaModule, TimeAgoPipe, ConfirmDialog, RatingComponent],
  templateUrl: './comment.html',
  encapsulation: ViewEncapsulation.None,
})
export class Comment {
  commentId = input<string | undefined>(undefined);
  editingId = input<string | undefined>(undefined);

  text = model<string>('');
  author = input<string>('');
  createdAt = input<string>('');
  canEdit = input<boolean>(false);
  isCreate = input<boolean>(false);
  rating = input<number | undefined>(undefined);

  saved = output<string>();
  deleted = output();
  enterEdit = output();
  exitEdit = output();

  protected draft = model<string>('');

  protected placeholderText = computed(() => {
    this.langChange();
    return this.translateService.instant('entity.comment.placeholder');
  });

  protected canSave = computed<boolean>(() => {
    if (this.isCreate()) return this.draft().length > 0;
    if (!this.isEdit()) return false;
    return this.draft() !== this.text() && this.draft().length > 0;
  });

  protected isEdit = computed<boolean>(() => {
    return !this.isCreate() && this.commentId() !== undefined && this.editingId() === this.commentId();
  });

  protected _updateDraftEffect = effect(() => {
    const incoming = this.text();
    const editing = this.isEdit();
    const creating = this.isCreate();

    if (creating || !editing) {
      this.draft.set(incoming);
    }
  });

  private translateService = inject(TranslateService);
  private langChange = toSignal(this.translateService.onLangChange, { initialValue: undefined });

  onInput(e: Event): void {
    const value = (e.target as HTMLTextAreaElement).value;
    this.draft.set(value);

    if (this.isCreate()) {
      this.text.set(value);
    }
  }

  startEdit(): void {
    this.draft.set(this.text());
    this.enterEdit.emit();
  }

  onCancel(): void {
    this.exitEdit.emit();
  }

  onSave(): void {
    this.saved.emit(this.draft());
    this.exitEdit.emit();
  }
}
