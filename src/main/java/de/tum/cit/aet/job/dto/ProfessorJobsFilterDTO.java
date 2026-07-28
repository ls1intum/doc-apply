package de.tum.cit.aet.job.dto;

import java.util.List;
import java.util.UUID;

/**
 * Filter DTO for retrieving jobs visible to a member of a research group.
 *
 * @param states        optional filter for multiple job states
 * @param supervisorIds optional filter restricting jobs to a list of
 *                      supervising-professor user ids. {@code null} or
 *                      empty means "all supervisors in the research group".
 */
public record ProfessorJobsFilterDTO(List<String> states, List<UUID> supervisorIds) {}
