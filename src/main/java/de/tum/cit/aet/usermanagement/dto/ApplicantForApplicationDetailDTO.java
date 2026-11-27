package de.tum.cit.aet.usermanagement.dto;

import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.core.exception.EntityNotFoundException;
import de.tum.cit.aet.usermanagement.domain.Applicant;
import jakarta.validation.constraints.NotNull;

/**
 * The applicant data reviewers see on an application. The name, university and grade of a degree the applicant has
 * marked as not held stay on the server: the applicant keeps them only to restore them when unticking the degree.
 */
public record ApplicantForApplicationDetailDTO(
    @NotNull UserForApplicationDetailDTO user,
    String street,
    String postalCode,
    String city,
    String country,
    String bachelorDegreeName,
    String bachelorGradeUpperLimit,
    String bachelorGradeLowerLimit,
    String bachelorGrade,
    String bachelorUniversity,
    String masterDegreeName,
    String masterGradeUpperLimit,
    String masterGradeLowerLimit,
    String masterGrade,
    String masterUniversity,
    boolean noBachelorDegree,
    boolean noMasterDegree,
    String degreeStatusExplanation
) {
    /**
     * Creates an ApplicantForApplicationDetailDTO from the applicant profile.
     *
     * @param applicant the applicant whose profile is returned
     * @return the ApplicantForApplicationDetailDTO
     */
    public static ApplicantForApplicationDetailDTO getFromEntity(Applicant applicant) {
        if (applicant == null) {
            throw new EntityNotFoundException("Applicant Entity should not be null");
        }
        return new ApplicantForApplicationDetailDTO(
            UserForApplicationDetailDTO.getFromEntity(applicant.getUser()),
            applicant.getStreet(),
            applicant.getPostalCode(),
            applicant.getCity(),
            applicant.getCountry(),
            unlessNotHeld(applicant.isNoBachelorDegree(), applicant.getBachelorDegreeName()),
            unlessNotHeld(applicant.isNoBachelorDegree(), applicant.getBachelorGradeUpperLimit()),
            unlessNotHeld(applicant.isNoBachelorDegree(), applicant.getBachelorGradeLowerLimit()),
            unlessNotHeld(applicant.isNoBachelorDegree(), applicant.getBachelorGrade()),
            unlessNotHeld(applicant.isNoBachelorDegree(), applicant.getBachelorUniversity()),
            unlessNotHeld(applicant.isNoMasterDegree(), applicant.getMasterDegreeName()),
            unlessNotHeld(applicant.isNoMasterDegree(), applicant.getMasterGradeUpperLimit()),
            unlessNotHeld(applicant.isNoMasterDegree(), applicant.getMasterGradeLowerLimit()),
            unlessNotHeld(applicant.isNoMasterDegree(), applicant.getMasterGrade()),
            unlessNotHeld(applicant.isNoMasterDegree(), applicant.getMasterUniversity()),
            applicant.isNoBachelorDegree(),
            applicant.isNoMasterDegree(),
            applicant.getDegreeStatusExplanation()
        );
    }

    /**
     * Creates an ApplicantForApplicationDetailDTO from the snapshot fields stored in an Application entity.
     * This ensures the DTO reflects the applicant's data at the time of application creation,
     * not their current profile data.
     *
     * @param application the application containing snapshot data
     * @return the ApplicantForApplicationDetailDTO built from snapshot fields
     */
    public static ApplicantForApplicationDetailDTO getFromApplicationSnapshot(Application application) {
        if (application == null) {
            throw new EntityNotFoundException("Application Entity should not be null");
        }

        // Build UserForApplicationDetailDTO from snapshot fields
        UserForApplicationDetailDTO userDTO = new UserForApplicationDetailDTO(
            application.getApplicant().getUserId(),
            application.getApplicantEmail(),
            application.getApplicant().getUser().getAvatar(), // Avatar not snapshotted, get from current user
            String.format("%s %s", application.getApplicantFirstName(), application.getApplicantLastName()),
            application.getApplicantGender(),
            application.getApplicantNationality(),
            application.getApplicantBirthday(),
            application.getApplicantPhoneNumber(),
            application.getApplicantWebsite(),
            application.getApplicantLinkedinUrl()
        );

        return new ApplicantForApplicationDetailDTO(
            userDTO,
            application.getApplicantStreet(),
            application.getApplicantPostalCode(),
            application.getApplicantCity(),
            application.getApplicantCountry(),
            unlessNotHeld(application.isApplicantNoBachelorDegree(), application.getApplicantBachelorDegreeName()),
            unlessNotHeld(application.isApplicantNoBachelorDegree(), application.getApplicantBachelorGradeUpperLimit()),
            unlessNotHeld(application.isApplicantNoBachelorDegree(), application.getApplicantBachelorGradeLowerLimit()),
            unlessNotHeld(application.isApplicantNoBachelorDegree(), application.getApplicantBachelorGrade()),
            unlessNotHeld(application.isApplicantNoBachelorDegree(), application.getApplicantBachelorUniversity()),
            unlessNotHeld(application.isApplicantNoMasterDegree(), application.getApplicantMasterDegreeName()),
            unlessNotHeld(application.isApplicantNoMasterDegree(), application.getApplicantMasterGradeUpperLimit()),
            unlessNotHeld(application.isApplicantNoMasterDegree(), application.getApplicantMasterGradeLowerLimit()),
            unlessNotHeld(application.isApplicantNoMasterDegree(), application.getApplicantMasterGrade()),
            unlessNotHeld(application.isApplicantNoMasterDegree(), application.getApplicantMasterUniversity()),
            application.isApplicantNoBachelorDegree(),
            application.isApplicantNoMasterDegree(),
            application.getApplicantDegreeStatusExplanation()
        );
    }

    /**
     * Withholds a value of a degree the applicant has marked as not held.
     *
     * @param notHeld whether the applicant has marked the degree as not held
     * @param value   the kept value of the degree
     * @return the value, or null when the degree is marked as not held
     */
    private static String unlessNotHeld(boolean notHeld, String value) {
        return notHeld ? null : value;
    }
}
