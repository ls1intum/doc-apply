import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { CommentSection } from 'app/shared/components/molecules/comment-section/comment-section';
import { InternalCommentResourceApi } from 'app/generated/api/internal-comment-resource-api';
import { RatingOverviewDTO } from 'app/generated/model/rating-overview-dto';
import { createToastServiceMock, provideToastServiceMock } from '../../../../../util/toast-service.mock';
import { createAccountServiceMock, provideAccountServiceMock } from '../../../../../util/account.service.mock';

type CommentDTO = {
  commentId: string;
  message: string;
  authorName?: string;
};

describe('CommentSection', () => {
  let fixture: ComponentFixture<CommentSection>;
  let component: CommentSection;

  let mockCommentApi: {
    listComments: ReturnType<typeof vi.fn>;
    createComment: ReturnType<typeof vi.fn>;
    updateComment: ReturnType<typeof vi.fn>;
    deleteComment: ReturnType<typeof vi.fn>;
  };

  let mockToast = createToastServiceMock();
  const mockAccount = createAccountServiceMock();
  mockAccount.user.set({ id: 'reviewer-1', name: 'Alice Reviewer', email: 'alice@test.com' });

  beforeEach(async () => {
    mockCommentApi = {
      listComments: vi.fn(),
      createComment: vi.fn(),
      updateComment: vi.fn(),
      deleteComment: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CommentSection],
      providers: [
        { provide: InternalCommentResourceApi, useValue: mockCommentApi },
        provideToastServiceMock(mockToast),
        provideAccountServiceMock(mockAccount),
      ],
    })
      .overrideComponent(CommentSection, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(CommentSection);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('init', () => {
    it('should set currentUser from logged-in user name', () => {
      expect(component['currentUser']).toBe('Alice Reviewer');
    });

    it('should set currentUser to empty string when user is undefined', () => {
      TestBed.resetTestingModule();

      const accountServiceWithNoUser = createAccountServiceMock();
      accountServiceWithNoUser.user.set(undefined);

      TestBed.configureTestingModule({
        imports: [CommentSection],
        providers: [
          { provide: InternalCommentResourceApi, useValue: mockCommentApi },
          provideToastServiceMock(mockToast),
          provideAccountServiceMock(accountServiceWithNoUser),
        ],
      })
        .overrideComponent(CommentSection, { set: { template: '' } })
        .compileComponents();

      expect(TestBed.createComponent(CommentSection).componentInstance['currentUser']).toBe('');
    });
  });

  describe('loadComments', () => {
    it('should clear draft and set comments [] when applicationId is undefined', async () => {
      fixture.componentRef.setInput('applicationId', undefined);
      fixture.detectChanges();
      await Promise.resolve();

      expect(component['comments']()).toEqual([]);
      expect(component['createDraft']()).toBe('');
      expect(mockCommentApi.listComments).not.toHaveBeenCalled();
    });

    it('should load comments when applicationId is defined', async () => {
      const data: CommentDTO[] = [{ commentId: 'c1', message: 'hello' }];
      mockCommentApi.listComments.mockReturnValueOnce(of(data));

      fixture.componentRef.setInput('applicationId', 'app-1');
      fixture.detectChanges();
      await Promise.resolve();

      expect(mockCommentApi.listComments).toHaveBeenCalledWith('app-1');
      expect(component['comments']()).toEqual(data);
      expect(component['createDraft']()).toBe('');
    });

    it('should show toast on error', async () => {
      mockCommentApi.listComments.mockReturnValueOnce(throwError(() => new Error('fail')));

      fixture.componentRef.setInput('applicationId', 'app-3');
      fixture.detectChanges();
      await component.loadComments();

      expect(mockToast.showError).toHaveBeenCalledWith({
        summary: 'Error',
        detail: 'Failed to load comments',
      });
    });
  });

  describe('createComment', () => {
    it.each<[string | undefined, string]>([
      [undefined, 'hello'],
      ['app-4', '   '],
    ])('should not call API when applicationId=%s and message=%s', async (appId, msg) => {
      fixture.componentRef.setInput('applicationId', appId);
      fixture.detectChanges();

      await component.createComment(msg);
      expect(mockCommentApi.createComment).not.toHaveBeenCalled();
    });

    it('should append created comment and clear draft', async () => {
      fixture.componentRef.setInput('applicationId', 'app-5');
      fixture.detectChanges();

      component['comments'].set([{ commentId: 'a', message: 'A' }]);
      mockCommentApi.createComment.mockReturnValueOnce(of({ commentId: 'b', message: 'B' }));

      await component.createComment('  B  ');

      expect(component['comments']()).toEqual([
        { commentId: 'a', message: 'A' },
        { commentId: 'b', message: 'B' },
      ]);
      expect(component['createDraft']()).toBe('');
    });

    it('should show toast on error', async () => {
      fixture.componentRef.setInput('applicationId', 'app-6');
      fixture.detectChanges();

      mockCommentApi.createComment.mockReturnValueOnce(throwError(() => new Error('fail')));

      await component.createComment('msg');
      expect(mockToast.showError).toHaveBeenCalledWith({
        summary: 'Error',
        detail: 'Failed to create comment',
      });
    });
  });

  describe('updateComment', () => {
    it.each<[string, string]>([
      ['', 'text'],
      ['c1', '   '],
    ])('should not call API when id=%s and message=%s', async (id, msg) => {
      await component.updateComment(id, msg);
      expect(mockCommentApi.updateComment).not.toHaveBeenCalled();
    });

    it('should preserve comment order when updating', async () => {
      component['comments'].set([
        { commentId: 'c1', message: 'first' },
        { commentId: 'c2', message: 'second' },
        { commentId: 'c3', message: 'third' },
      ]);

      const updated: CommentDTO = { commentId: 'c2', message: 'UPDATED' };
      mockCommentApi.updateComment.mockReturnValueOnce(of(updated));

      await component.updateComment('c2', 'UPDATED');

      expect(component['comments']()).toEqual([
        { commentId: 'c1', message: 'first' },
        { commentId: 'c2', message: 'UPDATED' },
        { commentId: 'c3', message: 'third' },
      ]);
    });

    it('should show toast on error', async () => {
      mockCommentApi.updateComment.mockReturnValueOnce(throwError(() => new Error('fail')));

      await component.updateComment('c1', 'msg');
      expect(mockToast.showError).toHaveBeenCalledWith({
        summary: 'Error',
        detail: 'Failed to update comment',
      });
    });
  });

  // ---------------- DELETE ----------------
  describe('deleteComment', () => {
    it('should early return when id undefined', async () => {
      await component.deleteComment(undefined);
      expect(mockCommentApi.deleteComment).not.toHaveBeenCalled();
    });

    it('should remove comment on success', async () => {
      component['comments'].set([
        { commentId: 'c1', message: 'one' },
        { commentId: 'c2', message: 'two' },
      ]);
      mockCommentApi.deleteComment.mockReturnValueOnce(of(void 0));

      await component.deleteComment('c1');
      expect(component['comments']()).toEqual([{ commentId: 'c2', message: 'two' }]);
    });

    it('should show toast on error', async () => {
      mockCommentApi.deleteComment.mockReturnValueOnce(throwError(() => new Error('fail')));

      await component.deleteComment('c1');
      expect(mockToast.showError).toHaveBeenCalledWith({
        summary: 'Error',
        detail: 'Failed to delete comment',
      });
    });
  });

  // ---------------- REFRESH ----------------
  describe('refresh', () => {
    it('should delegate to loadComments', async () => {
      const spy = vi.spyOn(component, 'loadComments').mockResolvedValue(void 0);
      await component.refresh();
      expect(spy).toHaveBeenCalledOnce();
    });
  });

  // ---------------- RATINGS ----------------
  describe('ratingByAuthor', () => {
    const setRatings = (ratings: RatingOverviewDTO | undefined): void => {
      fixture.componentRef.setInput('ratings', ratings);
      fixture.detectChanges();
    };

    beforeEach(() => {
      // The comment list is irrelevant here, so the section is left without an application to load.
      fixture.componentRef.setInput('applicationId', undefined);
    });

    it('should be empty when no ratings are provided', () => {
      setRatings(undefined);

      expect(component['ratingByAuthor']().size).toBe(0);
    });

    it('should map the current user to their own rating', () => {
      setRatings({ currentUserRating: 2, otherRatings: [] });

      expect(component['ratingByAuthor']().get('Alice Reviewer')).toBe(2);
    });

    it('should map every other reviewer to their rating', () => {
      setRatings({
        currentUserRating: 2,
        otherRatings: [
          { from: 'Bob Reviewer', rating: -1 },
          { from: 'Carol Reviewer', rating: 1 },
        ],
      });

      const map = component['ratingByAuthor']();
      expect(map.get('Bob Reviewer')).toBe(-1);
      expect(map.get('Carol Reviewer')).toBe(1);
      expect(map.size).toBe(3);
    });

    it('should keep a rating of zero rather than dropping it', () => {
      setRatings({ currentUserRating: 0, otherRatings: [{ from: 'Bob Reviewer', rating: 0 }] });

      const map = component['ratingByAuthor']();
      expect(map.get('Alice Reviewer')).toBe(0);
      expect(map.get('Bob Reviewer')).toBe(0);
    });

    it('should skip entries without an author or a rating', () => {
      setRatings({
        otherRatings: [{ from: 'Bob Reviewer' }, { rating: 1 }],
      });

      expect(component['ratingByAuthor']().size).toBe(0);
    });

    it('should not map the current user when they have not rated', () => {
      setRatings({ otherRatings: [{ from: 'Bob Reviewer', rating: 1 }] });

      const map = component['ratingByAuthor']();
      expect(map.has('Alice Reviewer')).toBe(false);
      expect(map.size).toBe(1);
    });

    it('should update when the ratings input changes', () => {
      setRatings({ currentUserRating: 1, otherRatings: [] });
      setRatings({ currentUserRating: -2, otherRatings: [] });

      expect(component['ratingByAuthor']().get('Alice Reviewer')).toBe(-2);
    });
  });
});
