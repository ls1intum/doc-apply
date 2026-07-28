package de.tum.cit.aet.ai.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.ai.constants.AiUsageFeature;
import java.util.List;

/**
 * One AI feature's trigger counts, aligned position-for-position with the shared label axis
 * of the enclosing {@link AiUsageAnalyticsDTO}.
 *
 * @param feature       the AI feature this series describes
 * @param counts        the number of triggers per time bucket, in label order
 * @param failureCounts the number of failed triggers per time bucket, in label order (a subset of {@code counts})
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiUsageSeriesDTO(AiUsageFeature feature, List<Long> counts, List<Long> failureCounts) {}
