package de.tum.cit.aet.reference.constants;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Capacity in which a referee knows the applicant. Captured on the reference letter upload page so
 * the committee can weigh the perspective the letter is written from.
 */
@Schema(enumAsRef = true)
public enum RefereeRelationship {
    COURSE_INSTRUCTOR,
    RESEARCH_SUPERVISOR,
    THESIS_ADVISOR,
    EMPLOYER,
    ACADEMIC_ADVISOR,
    OTHER,
}
