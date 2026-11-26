package de.tum.cit.aet.core.dto.exportdata;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.evaluation.domain.enumeration.RecommendationDecision;
import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record RatingExportDTO(String jobTitle, String applicantName, RecommendationDecision rating, Instant createdAt) {}
