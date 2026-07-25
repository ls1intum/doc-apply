package de.tum.cit.aet.ai.constants;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Selectable time window for the AI usage analytics dashboard. Each range maps to a
 * fixed look-back period and an adaptive bucket granularity so the chart stays readable.
 */
@Schema(enumAsRef = true)
public enum AiUsageTimeRange {
    LAST_DAY,
    LAST_WEEK,
    LAST_MONTH,
    LAST_THREE_MONTHS,
    ALL_TIME,
}
