import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AccountService } from 'app/core/auth/account.service';
import { ToastService } from 'app/service/toast-service';
import { Comment } from 'app/shared/components/molecules/comment/comment';
import { InternalCommentResourceApi } from 'app/generated/api/internal-comment-resource-api';
import { InternalCommentDTO } from 'app/generated/model/internal-comment-dto';
import { RatingOverviewDTO } from 'app/generated/model/rating-overview-dto';

import TranslateDirective from '../../../language/translate.directive';

@Component({
  selector: 'jhi-comment-section',
  imports: [Comment, TranslateDirective],
  templateUrl: './comment-section.html',
})
export class CommentSection {
  commentApi = inject(InternalCommentResourceApi);
  accountService = inject(AccountService);
  toast = inject(ToastService);

  applicationId = input.required<string | undefined>();
  /** Rating overview for the application, supplied by the parent so this section does not fetch it a second time. */
  ratings = input<RatingOverviewDTO | undefined>(undefined);

  protected comments = signal<InternalCommentDTO[]>([]);
  protected createDraft = signal<string>('');
  protected currentUser = this.accountService.loadedUser()?.name ?? '';
  protected editingId = signal<string | undefined>(undefined);

  protected readonly _loadCommentsEffect = effect(() => {
    const id = this.applicationId();
    this.createDraft.set('');
    if (id !== undefined) {
      void this.loadComments();
    } else {
      this.comments.set([]);
    }
  });

  protected readonly ratingByAuthor = computed<Map<string, number>>(() => {
    const map = new Map<string, number>();
    const overview = this.ratings();
    if (overview === undefined) {
      return map;
    }

    const currentRating = overview.currentUserRating;
    if (this.currentUser !== '' && currentRating !== undefined) {
      map.set(this.currentUser, currentRating);
    }
    for (const r of overview.otherRatings ?? []) {
      if (r.from !== undefined && r.rating !== undefined) {
        map.set(r.from, r.rating);
      }
    }
    return map;
  });

  async loadComments(): Promise<void> {
    const id = this.applicationId();
    if (id === undefined) {
      return;
    }
    try {
      const data = await firstValueFrom(this.commentApi.listComments(id));
      this.comments.set(data);
    } catch {
      this.toast.showError({ summary: 'Error', detail: 'Failed to load comments' });
    }
  }

  async createComment(message: string): Promise<void> {
    const id = this.applicationId();
    const trimmed = message.trim();
    if (id === undefined || !trimmed) return;

    try {
      const created = await firstValueFrom(this.commentApi.createComment(id, { message: trimmed }));
      this.comments.update(prev => [...prev, created]);
      this.createDraft.set('');
    } catch {
      this.toast.showError({ summary: 'Error', detail: 'Failed to create comment' });
    }
  }

  async updateComment(commentId: string, message: string): Promise<void> {
    const trimmed = message.trim();
    if (!commentId || !trimmed) return;

    try {
      const updated = await firstValueFrom(this.commentApi.updateComment(commentId, { message: trimmed }));
      this.comments.update(prev => prev.map(c => (c.commentId === commentId ? updated : c)));
    } catch {
      this.toast.showError({ summary: 'Error', detail: 'Failed to update comment' });
    }
  }

  async deleteComment(commentId: string | undefined): Promise<void> {
    if (commentId === undefined) return;

    try {
      await firstValueFrom(this.commentApi.deleteComment(commentId));
      this.comments.update(prev => prev.filter(c => c.commentId !== commentId));
    } catch {
      this.toast.showError({ summary: 'Error', detail: 'Failed to delete comment' });
    }
  }

  async refresh(): Promise<void> {
    await this.loadComments();
  }
}
