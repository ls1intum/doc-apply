package de.tum.cit.aet.ai.constants;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Bucket size used to group AI usage events along the x-axis of the analytics chart.
 * Derived from the selected {@link AiUsageTimeRange}.
 */
@Schema(enumAsRef = true)
public enum AiUsageGranularity {
    HOUR,
    DAY,
    WEEK,
    MONTH,
}
