package de.tum.cit.aet.job.constants;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * What recommenders must provide for a job: a recommendation letter, a structured evaluation of
 * the applicant, or both. Chosen by the professor on the job creation form and applies to every
 * recommendation request of the job.
 */
@Schema(enumAsRef = true)
public enum RecommendationType {
    LETTER_ONLY,
    EVALUATION_ONLY,
    LETTER_AND_EVALUATION,
}
