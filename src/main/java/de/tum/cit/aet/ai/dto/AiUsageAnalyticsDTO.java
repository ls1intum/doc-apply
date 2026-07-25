package de.tum.cit.aet.ai.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.ai.constants.AiUsageGranularity;
import de.tum.cit.aet.ai.constants.AiUsageTimeRange;
import java.util.List;

/**
 * Aggregated AI feature usage over time for the admin analytics dashboard. Every series shares
 * the same {@code labels} axis so the client can switch between features without refetching.
 *
 * @param range       the requested time window
 * @param granularity the bucket size used along the label axis
 * @param labels      the ordered time-bucket labels forming the x-axis
 * @param series      one trigger-count series per AI feature
 * @param cost        aggregate token consumption and estimated cost over the range
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiUsageAnalyticsDTO(
    AiUsageTimeRange range,
    AiUsageGranularity granularity,
    List<String> labels,
    List<AiUsageSeriesDTO> series,
    AiUsageCostSummaryDTO cost
) {}
