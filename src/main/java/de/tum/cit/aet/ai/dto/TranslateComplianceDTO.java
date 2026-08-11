package de.tum.cit.aet.ai.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.core.dto.GenderBiasAnalysisResponse;
import jakarta.annotation.Nullable;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record TranslateComplianceDTO(@NotBlank String text, @Nullable GenderBiasAnalysisResponse originalAnalysis, @Nullable UUID jobId) {}
