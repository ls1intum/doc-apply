package de.tum.cit.aet.ai.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.ai.domain.ComplianceIssue;
import java.util.List;

/** Response DTO for job-description analysis. */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record JobAnalysisDTO(int score, List<ComplianceIssueDTO> issues) {
    /**
     * Creates the response while keeping persistence models behind the DTO boundary.
     *
     * @param score the persisted combined score
     * @param issues the detected compliance issues
     * @return the analysis response
     */
    public static JobAnalysisDTO from(int score, List<ComplianceIssue> issues) {
        return new JobAnalysisDTO(score, issues.stream().map(ComplianceIssueDTO::from).toList());
    }
}
