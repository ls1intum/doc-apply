package de.tum.cit.aet.core.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record AnalyzeJobDescriptionRequestDTO(@NotNull UUID jobId, String title, String jobDescriptionEN, String jobDescriptionDE) {}
