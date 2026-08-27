package de.tum.cit.aet.ai.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.ai.domain.ComplianceIssue;
import de.tum.cit.aet.core.domain.BiasedIssue;
import de.tum.cit.aet.core.dto.BiasedIssueDTO;
import java.util.List;
import java.util.Set;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record JobAnalysisDTO(Integer aiScore, List<ComplianceIssueDTO> complianceIssues, List<BiasedIssueDTO> biasedIssues) {
    /**
     * Creates an analysis DTO from the persisted issues.
     *
     * @param aiScore the combined AI score
     * @param complianceIssues the persisted compliance issues
     * @param biasedIssues the persisted biased-language issues
     * @return the mapped analysis DTO
     */
    public static JobAnalysisDTO from(Integer aiScore, List<ComplianceIssue> complianceIssues, Set<BiasedIssue> biasedIssues) {
        return new JobAnalysisDTO(
            aiScore,
            complianceIssues.stream().map(ComplianceIssueDTO::from).toList(),
            biasedIssues.stream().map(BiasedIssueDTO::from).toList()
        );
    }
}
