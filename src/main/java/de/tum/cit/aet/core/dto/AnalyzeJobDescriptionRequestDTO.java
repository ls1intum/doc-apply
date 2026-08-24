package de.tum.cit.aet.core.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record AnalyzeJobDescriptionRequestDTO(@NotNull UUID jobId, String title, String jobDescriptionEN, String jobDescriptionDE) {}
