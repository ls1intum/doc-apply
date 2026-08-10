package de.tum.cit.aet.ai.dto;

import java.util.UUID;

public record AnalyzeJobDescriptionRequestDTO(UUID jobId, String title, String jobDescriptionEN, String jobDescriptionDE) {}
