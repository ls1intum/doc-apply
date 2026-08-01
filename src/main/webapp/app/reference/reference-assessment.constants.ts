import { SelectOption } from 'app/shared/components/atoms/select/select.component';
import { RatingGridRow } from 'app/shared/components/atoms/rating-grid/rating-grid.component';
import { RefereeRelationship } from 'app/generated/model/referee-relationship';
import { AcquaintanceDuration } from 'app/generated/model/acquaintance-duration';
import { AcquaintanceDepth } from 'app/generated/model/acquaintance-depth';
import { PeerRating } from 'app/generated/model/peer-rating';
import { OverallRecommendation } from 'app/generated/model/overall-recommendation';

/**
 * Single source for the reference-assessment dropdown options shared by the referee upload form and
 * the professor/applicant assessment display. Each option's {@code name} is an i18n key and its
 * {@code value} is the matching server enum value, so the same list both drives the form and resolves
 * a stored enum value back to its translated label.
 */
export const RELATIONSHIP_OPTIONS: SelectOption[] = [
  { name: 'reference.questions.relationship.capacity.options.courseInstructor', value: RefereeRelationship.CourseInstructor },
  { name: 'reference.questions.relationship.capacity.options.researchSupervisor', value: RefereeRelationship.ResearchSupervisor },
  { name: 'reference.questions.relationship.capacity.options.thesisAdvisor', value: RefereeRelationship.ThesisAdvisor },
  { name: 'reference.questions.relationship.capacity.options.employer', value: RefereeRelationship.Employer },
  { name: 'reference.questions.relationship.capacity.options.academicAdvisor', value: RefereeRelationship.AcademicAdvisor },
  { name: 'reference.questions.relationship.capacity.options.other', value: RefereeRelationship.Other },
];

export const DURATION_OPTIONS: SelectOption[] = [
  { name: 'reference.questions.relationship.duration.options.lessThanOneYear', value: AcquaintanceDuration.LessThanOneYear },
  { name: 'reference.questions.relationship.duration.options.oneToTwoYears', value: AcquaintanceDuration.OneToTwoYears },
  { name: 'reference.questions.relationship.duration.options.threeToFiveYears', value: AcquaintanceDuration.ThreeToFiveYears },
  { name: 'reference.questions.relationship.duration.options.moreThanFiveYears', value: AcquaintanceDuration.MoreThanFiveYears },
];

export const DEPTH_OPTIONS: SelectOption[] = [
  { name: 'reference.questions.relationship.depth.options.casually', value: AcquaintanceDepth.Casually },
  { name: 'reference.questions.relationship.depth.options.moderately', value: AcquaintanceDepth.Moderately },
  { name: 'reference.questions.relationship.depth.options.well', value: AcquaintanceDepth.Well },
  { name: 'reference.questions.relationship.depth.options.veryWell', value: AcquaintanceDepth.VeryWell },
];

export const RATING_OPTIONS: SelectOption[] = [
  { name: 'reference.questions.rating.options.top1to2', value: PeerRating.TopOneToTwoPercent },
  { name: 'reference.questions.rating.options.top5', value: PeerRating.TopFivePercent },
  { name: 'reference.questions.rating.options.top10', value: PeerRating.TopTenPercent },
  { name: 'reference.questions.rating.options.top25', value: PeerRating.TopTwentyFivePercent },
  { name: 'reference.questions.rating.options.top50', value: PeerRating.TopFiftyPercent },
  { name: 'reference.questions.rating.options.belowAverage', value: PeerRating.BelowAverage },
  { name: 'reference.questions.rating.options.cannotJudge', value: PeerRating.CannotJudge },
];

export const OVERALL_OPTIONS: SelectOption[] = [
  { name: 'reference.questions.overall.options.highestEnthusiasm', value: OverallRecommendation.HighestEnthusiasm },
  { name: 'reference.questions.overall.options.stronglyRecommend', value: OverallRecommendation.StronglyRecommend },
  { name: 'reference.questions.overall.options.recommend', value: OverallRecommendation.Recommend },
  { name: 'reference.questions.overall.options.recommendWithReservations', value: OverallRecommendation.RecommendWithReservations },
  { name: 'reference.questions.overall.options.doNotRecommend', value: OverallRecommendation.DoNotRecommend },
];

/**
 * The six peer-group rating dimensions, in display order. {@code key} is both the upload form's answer
 * key and the matching {@code ReferenceRequestDTO} field name.
 */
export const RATING_ROWS: RatingGridRow[] = [
  { key: 'ratingIntellectualAbility', labelKey: 'reference.questions.rating.rows.intellectualAbility' },
  { key: 'ratingResearchPotential', labelKey: 'reference.questions.rating.rows.researchPotential' },
  { key: 'ratingMotivation', labelKey: 'reference.questions.rating.rows.motivation' },
  { key: 'ratingCommunication', labelKey: 'reference.questions.rating.rows.communication' },
  { key: 'ratingLeadership', labelKey: 'reference.questions.rating.rows.leadership' },
  { key: 'ratingCollaboration', labelKey: 'reference.questions.rating.rows.collaboration' },
];

/**
 * Resolves a stored enum value back to its i18n label key using one of the option lists above.
 *
 * @param options the option list the value belongs to
 * @param value the stored enum value
 * @returns the i18n key for the value's label, or undefined when the value is missing/unknown
 */
export function assessmentLabelKey(options: SelectOption[], value: string | number | undefined): string | undefined {
  return options.find(option => option.value === value)?.name;
}
