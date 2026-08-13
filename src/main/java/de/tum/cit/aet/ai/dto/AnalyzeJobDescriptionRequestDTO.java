package de.tum.cit.aet.ai.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record AnalyzeJobDescriptionRequestDTO(@NotNull UUID jobId, String title, String jobDescriptionEN, String jobDescriptionDE) {}
