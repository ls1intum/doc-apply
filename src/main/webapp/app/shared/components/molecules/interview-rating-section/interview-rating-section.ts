import { Component, input } from '@angular/core';
import { RatingComponent } from 'app/shared/components/atoms/rating/rating.component';
import { RecommendationDecision } from 'app/generated/model/recommendation-decision';

import { Section } from '../../atoms/section/section';
import { Prose } from '../../atoms/prose/prose';

@Component({
  selector: 'jhi-interview-rating-section',
  imports: [Section, RatingComponent, Prose],
  templateUrl: './interview-rating-section.html',
})
export class InterviewRatingSection {
  rating = input<RecommendationDecision | undefined>(undefined);
  assessmentNotes = input<string | undefined>(undefined);
}
