package de.tum.cit.aet.reference.constants;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * How long the referee has known the applicant.
 */
@Schema(enumAsRef = true)
public enum AcquaintanceDuration {
    LESS_THAN_ONE_YEAR,
    ONE_TO_TWO_YEARS,
    THREE_TO_FIVE_YEARS,
    MORE_THAN_FIVE_YEARS,
}
