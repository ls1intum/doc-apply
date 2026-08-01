package de.tum.cit.aet.usermanagement.dto;

import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;

public record ProfessorDTO(String firstName, String lastName, String email, String researchGroupName, String researchGroupWebsite) {
    /**
     * Converts a {@link Job}'s supervising professor to a {@link ProfessorDTO},
     * pulling the research group fields from the job itself rather than from the
     * professor's membership list (a professor may belong to multiple groups).
     *
     * @param job the job whose supervising professor is being represented
     * @return the corresponding {@link ProfessorDTO}
     * @throws IllegalStateException if the job has no supervising professor or no research group
     */
    public static ProfessorDTO fromJob(Job job) {
        User professor = job.getSupervisingProfessor();
        if (professor == null) {
            throw new IllegalStateException("Job has no supervising professor");
        }
        ResearchGroup researchGroup = job.getResearchGroup();
        if (researchGroup == null) {
            throw new IllegalStateException("Research group is null");
        }
        return new ProfessorDTO(
            professor.getFirstName(),
            professor.getLastName(),
            professor.getEmail(),
            researchGroup.getName(),
            researchGroup.getWebsite()
        );
    }
}
