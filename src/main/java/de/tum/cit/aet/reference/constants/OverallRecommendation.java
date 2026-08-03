package de.tum.cit.aet.reference.constants;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * The referee's overall endorsement of the applicant.
 */
@Schema(enumAsRef = true)
public enum OverallRecommendation {
    HIGHEST_ENTHUSIASM,
    STRONGLY_RECOMMEND,
    RECOMMEND,
    RECOMMEND_WITH_RESERVATIONS,
    DO_NOT_RECOMMEND,
}
