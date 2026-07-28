package de.tum.cit.aet.ai.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Token pricing used to estimate the monetary cost of AI usage. A single input/output rate is
 * applied to all usage, matching a deployment that serves its AI features from one model.
 */
@Data
@ConfigurationProperties(prefix = "aet.ai.pricing")
public class AiPricingProperties {

    /** Currency label shown alongside estimated costs (e.g. "EUR"). */
    private String currency = "EUR";

    /** Price per 1,000,000 prompt (input) tokens, in {@link #currency}. */
    private double inputPerMillion;

    /** Price per 1,000,000 completion (output) tokens, in {@link #currency}. */
    private double outputPerMillion;

    /**
     * Estimates the cost of a single call from its token usage.
     *
     * @param inputTokens  prompt tokens, or {@code null}
     * @param outputTokens completion tokens, or {@code null}
     * @return the estimated cost in {@link #currency}
     */
    public double estimateCost(Integer inputTokens, Integer outputTokens) {
        long input = inputTokens != null ? inputTokens : 0;
        long output = outputTokens != null ? outputTokens : 0;
        return (input / 1_000_000.0) * inputPerMillion + (output / 1_000_000.0) * outputPerMillion;
    }
}
