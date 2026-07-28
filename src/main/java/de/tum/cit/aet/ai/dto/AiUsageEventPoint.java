package de.tum.cit.aet.ai.dto;

import de.tum.cit.aet.ai.constants.AiUsageFeature;
import java.time.LocalDateTime;

/**
 * Lightweight projection of an AI usage event carrying only the fields needed for
 * time-bucket aggregation and cost estimation, so the analytics query never loads the referenced user.
 *
 * @param feature      the AI feature that was triggered
 * @param createdAt    the moment the feature was triggered
 * @param success      whether the underlying AI call completed successfully
 * @param inputTokens  prompt tokens consumed, or {@code null} if not reported
 * @param outputTokens completion tokens produced, or {@code null} if not reported
 */
public record AiUsageEventPoint(
    AiUsageFeature feature,
    LocalDateTime createdAt,
    boolean success,
    Integer inputTokens,
    Integer outputTokens
) {}
