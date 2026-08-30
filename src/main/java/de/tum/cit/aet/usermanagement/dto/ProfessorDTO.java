package de.tum.cit.aet.usermanagement.dto;

import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;

public record ProfessorDTO(String firstName, String lastName, String email, String researchGroupName, String researchGroupWebsite) {
    /**
     * Converts a {@link Job}'s supervising professor to a {@link ProfessorDTO}, pulling the research group
     * fields from the job itself rather than from the professor's membership list (a professor may belong to
     * multiple groups).
     *
     * <p>The job retains its research group even after the supervising professor
     * is anonymised, so this is the safe choice for application/evaluation flows
     * where the original research-group context still matters. Research-group
     * fields are left null when the job has no research group (e.g. the
     * anonymised "deleted user" sentinel after retention runs), so evaluation
     * keeps working after a professor leaves.
     *
     * @param job the job whose supervising professor and research group should be used
     * @return the corresponding {@link ProfessorDTO}
     */
    public static ProfessorDTO fromJob(Job job) {
        User professor = job.getSupervisingProfessor();
        ResearchGroup researchGroup = job.getResearchGroup();
        return new ProfessorDTO(
            professor.getFirstName(),
            professor.getLastName(),
            professor.getEmail(),
            researchGroup != null ? researchGroup.getName() : null,
            researchGroup != null ? researchGroup.getWebsite() : null
        );
    }
}
