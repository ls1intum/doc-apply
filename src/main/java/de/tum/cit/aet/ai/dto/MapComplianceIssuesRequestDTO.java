package de.tum.cit.aet.ai.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.ai.domain.ComplianceIssue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record MapComplianceIssuesRequestDTO(
    String toLang,
    @NotNull UUID jobId,
    @NotBlank String translatedText,
    @NotNull List<ComplianceIssue> complianceIssues
) {}
