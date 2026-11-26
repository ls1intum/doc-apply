import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { RatingSection } from 'app/shared/components/molecules/rating-section/rating-section';
import { RatingResourceApi } from 'app/generated/api/rating-resource-api';
import { RatingOverviewDTO } from 'app/generated/model/rating-overview-dto';
import { RecommendationDecision } from 'app/generated/model/recommendation-decision';
import { createToastServiceMock, provideToastServiceMock } from '../../../../../util/toast-service.mock';
import { provideAccountServiceMock } from '../../../../../util/account.service.mock';

describe('RatingSection', () => {
  let fixture: ComponentFixture<RatingSection>;
  let component: RatingSection;

  let mockRatingApi: {
    getRatings: ReturnType<typeof vi.fn>;
    updateRating: ReturnType<typeof vi.fn>;
  };
  let mockToast = createToastServiceMock();

  beforeEach(async () => {
    mockRatingApi = {
      getRatings: vi.fn(),
      updateRating: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [RatingSection],
      providers: [{ provide: RatingResourceApi, useValue: mockRatingApi }, provideToastServiceMock(mockToast), provideAccountServiceMock()],
    })
      .overrideComponent(RatingSection, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(RatingSection);
    component = fixture.componentInstance;
  });

  describe('Loading Ratings', () => {
    it('should not call loadRatings when applicationId is undefined', async () => {
      fixture.componentRef.setInput('applicationId', undefined);
      fixture.detectChanges();
      await Promise.resolve();
      expect(mockRatingApi.getRatings).not.toHaveBeenCalled();
    });

    it('should load ratings when applicationId is set', async () => {
      const response: RatingOverviewDTO = {
        currentUserRating: RecommendationDecision.StrongPass,
        otherRatings: [1, 2, 3],
      } as RatingOverviewDTO;
      mockRatingApi.getRatings.mockReturnValueOnce(of(response));

      fixture.componentRef.setInput('applicationId', 'app-1');
      fixture.detectChanges();
      await Promise.resolve();

      expect(mockRatingApi.getRatings).toHaveBeenCalledWith('app-1');
      expect(component.ratings()).toEqual(response);
      expect(component['serverCurrent']()).toBe(RecommendationDecision.StrongPass);
      expect(component.myRating()).toBe(RecommendationDecision.StrongPass);
      expect(component.otherRatings()).toEqual([1, 2, 3]);
    });

    it('should reload ratings when applicationId changes', async () => {
      const response1: RatingOverviewDTO = {
        currentUserRating: RecommendationDecision.SoftPass,
        otherRatings: [1, 2],
      } as RatingOverviewDTO;
      const response2: RatingOverviewDTO = { currentUserRating: RecommendationDecision.SoftFail, otherRatings: [4] } as RatingOverviewDTO;

      mockRatingApi.getRatings.mockReturnValueOnce(of(response1));
      fixture.componentRef.setInput('applicationId', 'app-8');
      fixture.detectChanges();
      await Promise.resolve();

      expect(component.myRating()).toBe(RecommendationDecision.SoftPass);
      expect(component.otherRatings()).toEqual([1, 2]);

      mockRatingApi.getRatings.mockReturnValueOnce(of(response2));
      fixture.componentRef.setInput('applicationId', 'app-9');
      fixture.detectChanges();
      await Promise.resolve();

      expect(component.myRating()).toBe(RecommendationDecision.SoftFail);
      expect(component.otherRatings()).toEqual([4]);
      expect(mockRatingApi.getRatings).toHaveBeenCalledTimes(2);
    });

    it('should emit the loaded overview so siblings can reuse it', async () => {
      const response: RatingOverviewDTO = { currentUserRating: RecommendationDecision.StrongFail, otherRatings: [] } as RatingOverviewDTO;
      const emitted: RatingOverviewDTO[] = [];
      component.ratingsLoaded.subscribe(value => emitted.push(value));
      mockRatingApi.getRatings.mockReturnValueOnce(of(response));

      fixture.componentRef.setInput('applicationId', 'app-1');
      fixture.detectChanges();
      await Promise.resolve();

      expect(emitted).toEqual([response]);
    });

    it('should not emit the overview when loading fails', async () => {
      const emitted: RatingOverviewDTO[] = [];
      component.ratingsLoaded.subscribe(value => emitted.push(value));
      mockRatingApi.getRatings.mockReturnValueOnce(throwError(() => new Error('fail')));

      fixture.componentRef.setInput('applicationId', 'app-1');
      fixture.detectChanges();
      await Promise.resolve();

      expect(emitted).toEqual([]);
    });
  });

  // ---------------- ERROR HANDLING (LOADING) ----------------
  describe('Error Handling (Loading)', () => {
    it('should show toast and set isInitializing false on loadRatings error', async () => {
      mockRatingApi.getRatings.mockReturnValueOnce(throwError(() => new Error('fail')));

      fixture.componentRef.setInput('applicationId', 'app-2');
      fixture.detectChanges();
      await Promise.resolve();

      expect(mockToast.showError).toHaveBeenCalledWith({
        summary: 'Error',
        detail: 'Failed to load ratings',
      });
      expect(component['isInitializing']()).toBe(false);
    });
  });

  // ---------------- UPSERT RATINGS ----------------
  describe('Upserting Ratings', () => {
    it.each<[string | undefined, boolean]>([
      [undefined, false],
      ['app-3', true],
    ])('should skip upsert when applicationId=%s and initializing=%s', async (appId, initializing) => {
      fixture.componentRef.setInput('applicationId', appId);
      fixture.detectChanges();

      component['isInitializing'].set(initializing);
      component.myRating.set(RecommendationDecision.SoftFail);
      await Promise.resolve();
      expect(mockRatingApi.updateRating).not.toHaveBeenCalled();
    });

    it('should upsert rating on change and refresh ratings on success', async () => {
      fixture.componentRef.setInput('applicationId', 'app-4');
      fixture.detectChanges();

      const refreshed: RatingOverviewDTO = {
        currentUserRating: RecommendationDecision.SoftFail,
        otherRatings: [3, 4],
      } as RatingOverviewDTO;
      mockRatingApi.updateRating.mockReturnValueOnce(of(void 0));
      mockRatingApi.getRatings.mockReturnValueOnce(of(refreshed));

      component['isInitializing'].set(false);
      component['serverCurrent'].set(RecommendationDecision.StrongPass);

      component.myRating.set(RecommendationDecision.SoftFail);
      fixture.detectChanges();

      await new Promise(r => setTimeout(r, 0));

      expect(mockRatingApi.updateRating).toHaveBeenCalledWith('app-4', RecommendationDecision.SoftFail);
      expect(component['serverCurrent']()).toBe(RecommendationDecision.SoftFail);
      expect(component.ratings()).toEqual(refreshed);
    });

    it('should emit the refreshed overview after a rating is saved', async () => {
      fixture.componentRef.setInput('applicationId', 'app-4');
      fixture.detectChanges();

      const refreshed: RatingOverviewDTO = { currentUserRating: RecommendationDecision.SoftFail, otherRatings: [] } as RatingOverviewDTO;
      const emitted: RatingOverviewDTO[] = [];
      component.ratingsLoaded.subscribe(value => emitted.push(value));
      mockRatingApi.updateRating.mockReturnValueOnce(of(void 0));
      mockRatingApi.getRatings.mockReturnValueOnce(of(refreshed));

      component['isInitializing'].set(false);
      component['serverCurrent'].set(RecommendationDecision.StrongPass);

      component.myRating.set(RecommendationDecision.SoftFail);
      fixture.detectChanges();

      await new Promise(r => setTimeout(r, 0));

      expect(emitted).toEqual([refreshed]);
    });

    it('should not upsert when myRating equals serverCurrent', async () => {
      fixture.componentRef.setInput('applicationId', 'app-7');
      fixture.detectChanges();

      component['isInitializing'].set(false);
      component['serverCurrent'].set(RecommendationDecision.SoftPass);

      component.myRating.set(RecommendationDecision.SoftPass);
      fixture.detectChanges();

      await new Promise(r => setTimeout(r, 0));

      expect(mockRatingApi.updateRating).not.toHaveBeenCalled();
    });
  });

  // ---------------- ERROR HANDLING (UPSERT) ----------------
  describe('Error Handling (Upsert)', () => {
    it('should show toast and revert myRating on upsert error', async () => {
      fixture.componentRef.setInput('applicationId', 'app-5');

      mockRatingApi.getRatings.mockReturnValue(
        of({ currentUserRating: RecommendationDecision.SoftPass, otherRatings: [] } as RatingOverviewDTO),
      );
      mockRatingApi.updateRating.mockReturnValueOnce(throwError(() => new Error('fail')));

      fixture.detectChanges();

      component['isInitializing'].set(false);
      component['serverCurrent'].set(RecommendationDecision.SoftPass);

      component.myRating.set(RecommendationDecision.StrongPass);
      fixture.detectChanges();

      await new Promise(r => setTimeout(r, 0));

      expect(mockToast.showError).toHaveBeenCalledWith({
        summary: 'Error',
        detail: 'Failed to save rating',
      });
      expect(component.myRating()).toBe(RecommendationDecision.SoftPass);
    });
  });

  describe('Edge Cases & Derived Values', () => {
    it('should return [] for otherRatings when ratings has no otherRatings property', () => {
      component.ratings.set({ currentUserRating: RecommendationDecision.StrongFail } as RatingOverviewDTO);
      expect(component.otherRatings()).toEqual([]);
    });
  });
});
