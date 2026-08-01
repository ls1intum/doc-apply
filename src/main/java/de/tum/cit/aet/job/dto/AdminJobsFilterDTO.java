package de.tum.cit.aet.job.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.UUID;

/**
 * Filter DTO for the admin "All Positions" page. All fields optional.
 *
 * @param states                  optional filter for multiple job states (string values of JobState)
 * @param researchGroupIds        optional filter for one or more research-group ids
 * @param supervisingProfessorIds optional filter for one or more supervising-professor user ids
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record AdminJobsFilterDTO(List<String> states, List<UUID> researchGroupIds, List<UUID> supervisingProfessorIds) {}
