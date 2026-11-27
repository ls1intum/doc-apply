package de.tum.cit.aet.evaluation.domain.enumeration;

import com.fasterxml.jackson.annotation.JsonCreator;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Arrays;

/**
 * Decision-oriented recommendation that reviewers and interviewers give for an application.
 * The scale runs from a strong fail through a neutral middle to a strong pass.
 * Each decision is stored as a signed integer, so reviewer and interview recommendations can be averaged together.
 */
@Schema(enumAsRef = true)
public enum RecommendationDecision {
    STRONG_FAIL(-2),
    SOFT_FAIL(-1),
    NEUTRAL(0),
    SOFT_PASS(1),
    STRONG_PASS(2);

    private final int value;

    RecommendationDecision(int value) {
        this.value = value;
    }

    /**
     * Returns the signed integer that represents this decision in the database and in averages.
     *
     * @return the stored value: -2, -1, 0, 1 or 2
     */
    public int getValue() {
        return value;
    }

    /**
     * Reads a decision from JSON by its name only.
     * Without this, Jackson would also accept a number as the constant's position, so a stored value such as 0 would
     * silently turn into a strong fail instead of a neutral decision.
     *
     * @param name the name of the decision, such as SOFT_PASS
     * @return the matching decision
     * @throws IllegalArgumentException if the name does not belong to any decision
     */
    @JsonCreator
    public static RecommendationDecision fromName(String name) {
        return valueOf(name);
    }

    /**
     * Converts a stored integer value to the matching decision.
     *
     * @param value the stored value, or null if no decision was made
     * @return the matching decision, or null if the value is null
     * @throws IllegalArgumentException if the value does not belong to any decision
     */
    public static RecommendationDecision fromValue(Integer value) {
        if (value == null) {
            return null;
        }
        return Arrays.stream(values())
            .filter(decision -> decision.value == value)
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Invalid recommendation decision value: " + value));
    }
}
