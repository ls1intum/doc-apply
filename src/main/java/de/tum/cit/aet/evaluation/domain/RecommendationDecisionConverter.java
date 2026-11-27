package de.tum.cit.aet.evaluation.domain;

import de.tum.cit.aet.evaluation.domain.enumeration.RecommendationDecision;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Stores a {@link RecommendationDecision} as its signed integer value, so the database can keep averaging the column.
 */
@Converter
public class RecommendationDecisionConverter implements AttributeConverter<RecommendationDecision, Integer> {

    /**
     * Converts the decision to its stored integer value.
     *
     * @param attribute the decision, or null if none was made
     * @return the stored value, or null if the decision is null
     */
    @Override
    public Integer convertToDatabaseColumn(RecommendationDecision attribute) {
        return attribute == null ? null : attribute.getValue();
    }

    /**
     * Converts the stored integer value back to the decision.
     *
     * @param dbData the stored value, or null if none was made
     * @return the matching decision, or null if the value is null
     */
    @Override
    public RecommendationDecision convertToEntityAttribute(Integer dbData) {
        return RecommendationDecision.fromValue(dbData);
    }
}
