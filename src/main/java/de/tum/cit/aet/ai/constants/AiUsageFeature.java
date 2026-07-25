package de.tum.cit.aet.ai.constants;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Identifies which AI feature a recorded usage event belongs to. Used by the admin
 * analytics dashboard to plot how often each feature is triggered over time.
 */
@Schema(enumAsRef = true)
public enum AiUsageFeature {
    /** The "Write with TUMApply" job description generation on the job creation form. */
    JOB_DESCRIPTION_GENERATION,
    /** The AI translation of a job description between German and English. */
    TRANSLATION,
    /** The applicant-facing extraction of data from uploaded CV / certificate PDFs. */
    DOCUMENT_EXTRACTION,
}
