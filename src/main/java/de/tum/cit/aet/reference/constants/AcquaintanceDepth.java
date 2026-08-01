package de.tum.cit.aet.reference.constants;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * How well the referee knows the applicant.
 */
@Schema(enumAsRef = true)
public enum AcquaintanceDepth {
    CASUALLY,
    MODERATELY,
    WELL,
    VERY_WELL,
}
