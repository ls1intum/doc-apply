import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RatingComponent } from 'app/shared/components/atoms/rating/rating.component';
import { AccountService } from 'app/core/auth/account.service';
import { ToastService } from 'app/service/toast-service';
import { RatingOverviewDTO } from 'app/generated/model/rating-overview-dto';
import { RatingResourceApi } from 'app/generated/api/rating-resource-api';

import TranslateDirective from '../../../language/translate.directive';
import { SubSection } from '../../atoms/sub-section/sub-section';

@Component({
  selector: 'jhi-rating-section',
  imports: [SubSection, RatingComponent, TranslateDirective],
  templateUrl: './rating-section.html',
})
export class RatingSection {
  ratingApi = inject(RatingResourceApi);
  accountService = inject(AccountService);
  toastService = inject(ToastService);

  applicationId = input<string | undefined>(undefined);
  ratings = signal<RatingOverviewDTO | undefined>(undefined);
  ratingUpdated = output();
  /** Emits whenever the overview is loaded or refreshed, so siblings can reuse it instead of fetching it again. */
  ratingsLoaded = output<RatingOverviewDTO>();

  myRating = signal<number | undefined>(undefined);

  otherRatings = computed(() => {
    return this.ratings()?.otherRatings ?? [];
  });

  _loadRatingEffect = effect(() => {
    const applicationId = this.applicationId();
    if (applicationId !== undefined) {
      void this.loadRatings(applicationId);
    }
  });

  _persistOnChangeEffect = effect(() => {
    const appId = this.applicationId();
    const value = this.myRating();

    if (appId === undefined) {
      return;
    }
    if (this.isInitializing()) return; // skip while we’re syncing initial state
    if (value === this.serverCurrent()) return; // no-op if no real change

    untracked(() => {
      void this.upsertMyRating(appId, value);
    });
  });

  private serverCurrent = signal<number | undefined>(undefined);
  private isInitializing = signal<boolean>(true);

  private async loadRatings(applicationId: string): Promise<void> {
    this.isInitializing.set(true);
    try {
      const response = await firstValueFrom(this.ratingApi.getRatings(applicationId));
      this.ratings.set(response);
      this.ratingsLoaded.emit(response);

      // Initialize myRating from server (e.g. response.currentUserRating)
      const mine = response.currentUserRating ?? undefined;
      this.serverCurrent.set(mine);
      this.myRating.set(mine);
    } catch {
      this.toastService.showError({ summary: 'Error', detail: 'Failed to load ratings' });
    } finally {
      this.isInitializing.set(false);
    }
  }

  private async upsertMyRating(applicationId: string, value: number | undefined): Promise<void> {
    try {
      await firstValueFrom(this.ratingApi.updateRating(applicationId, value));

      const refreshed = await firstValueFrom(this.ratingApi.getRatings(applicationId));
      this.ratings.set(refreshed);
      this.ratingsLoaded.emit(refreshed);

      // Sync myRating and serverCurrent with the refreshed data
      const mine = refreshed.currentUserRating ?? undefined;
      this.serverCurrent.set(mine);
      this.myRating.set(mine);

      // Emit event to notify parent that rating was updated
      this.ratingUpdated.emit();
    } catch {
      this.toastService.showError({ summary: 'Error', detail: 'Failed to save rating' });
      // revert UI to last known server value
      this.myRating.set(this.serverCurrent());
    }
  }
}
