package de.tum.cit.aet.ai.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.ai.domain.BiasedIssue;
import de.tum.cit.aet.ai.domain.ComplianceIssue;
import java.util.List;
import java.util.Set;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record JobAnalysisDTO(Integer aiScore, List<ComplianceIssueDTO> complianceIssues, List<BiasedIssueDTO> biasedIssues) {
    public static JobAnalysisDTO from(Integer aiScore, List<ComplianceIssue> complianceIssues, Set<BiasedIssue> biasedIssues) {
        return new JobAnalysisDTO(
            aiScore,
            complianceIssues.stream().map(ComplianceIssueDTO::from).toList(),
            biasedIssues.stream().map(BiasedIssueDTO::from).toList()
        );
    }
}
