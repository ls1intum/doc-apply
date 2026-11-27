package de.tum.cit.aet.utility.testdata;

import de.tum.cit.aet.core.constants.Language;
import de.tum.cit.aet.usermanagement.constants.UserRole;
import de.tum.cit.aet.usermanagement.domain.Applicant;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.domain.UserResearchGroupRole;
import de.tum.cit.aet.usermanagement.dto.ApplicantDTO;
import de.tum.cit.aet.usermanagement.repository.ApplicantRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Test data helpers for Applicant.
 */
public final class ApplicantTestData {

    private ApplicantTestData() {}

    /** Creates an unsaved Applicant with sensible defaults. */
    public static Applicant newApplicant(User user) {
        attachApplicantRole(user);

        Applicant a = new Applicant();
        a.setUser(user);
        a.setStreet("Teststr. 1");
        a.setPostalCode("12345");
        a.setCity("Munich");
        a.setCountry("de");
        a.setBachelorDegreeName("B.Sc. Computer Science");
        a.setBachelorGradeUpperLimit("1.0");
        a.setBachelorGradeLowerLimit("4.0");
        a.setBachelorGrade("1.7");
        a.setBachelorUniversity("TUM");
        a.setMasterDegreeName("M.Sc. Informatics");
        a.setMasterGradeUpperLimit("1.0");
        a.setMasterGradeLowerLimit("4.0");
        a.setMasterGrade("1.3");
        a.setMasterUniversity("TUM");
        return a;
    }

    /** Unsaved Applicant with override options (null = keep default). */
    public static Applicant newApplicantAll(
        User user,
        String bachelorDegreeName,
        String bachelorGradeUpperLimit,
        String bachelorGradeLowerLimit,
        String bachelorGrade,
        String bachelorUniversity,
        String masterDegreeName,
        String masterGradeUpperLimit,
        String masterGradeLowerLimit,
        String masterGrade,
        String masterUniversity
    ) {
        Applicant a = newApplicant(user);
        if (bachelorDegreeName != null) a.setBachelorDegreeName(bachelorDegreeName);
        if (bachelorGradeUpperLimit != null) a.setBachelorGradeUpperLimit(bachelorGradeUpperLimit);
        if (bachelorGradeLowerLimit != null) a.setBachelorGradeLowerLimit(bachelorGradeLowerLimit);
        if (bachelorGrade != null) a.setBachelorGrade(bachelorGrade);
        if (bachelorUniversity != null) a.setBachelorUniversity(bachelorUniversity);
        if (masterDegreeName != null) a.setMasterDegreeName(masterDegreeName);
        if (masterGradeUpperLimit != null) a.setMasterGradeUpperLimit(masterGradeUpperLimit);
        if (masterGradeLowerLimit != null) a.setMasterGradeLowerLimit(masterGradeLowerLimit);
        if (masterGrade != null) a.setMasterGrade(masterGrade);
        if (masterUniversity != null) a.setMasterUniversity(masterUniversity);
        return a;
    }

    /**
     * Builds the profile data of an applicant as the client sends it, with the given degree status.
     *
     * @param applicant        the applicant whose profile data is sent
     * @param noBachelorDegree whether the applicant ticks that they have no Bachelor's degree
     * @param noMasterDegree   whether the applicant ticks that they have no Master's degree
     * @param explanation      the explanation of the degree status
     * @return the applicant data with the degree status
     */
    public static ApplicantDTO dtoWithDegreeStatus(
        Applicant applicant,
        boolean noBachelorDegree,
        boolean noMasterDegree,
        String explanation
    ) {
        ApplicantDTO profile = ApplicantDTO.getFromEntity(applicant);
        return new ApplicantDTO(
            profile.user(),
            profile.street(),
            profile.postalCode(),
            profile.city(),
            profile.country(),
            profile.bachelorDegreeName(),
            profile.bachelorGradeUpperLimit(),
            profile.bachelorGradeLowerLimit(),
            profile.bachelorGrade(),
            profile.bachelorUniversity(),
            profile.masterDegreeName(),
            profile.masterGradeUpperLimit(),
            profile.masterGradeLowerLimit(),
            profile.masterGrade(),
            profile.masterUniversity(),
            noBachelorDegree,
            noMasterDegree,
            explanation
        );
    }

    private static User newApplicantUser() {
        User applicantUser = new User();
        applicantUser.setUserId(UUID.randomUUID());
        applicantUser.setEmail("applicant" + UUID.randomUUID().toString().substring(0, 8) + "@example.com");
        applicantUser.setSelectedLanguage(Language.ENGLISH.getCode());
        applicantUser.setFirstName("Ada");
        applicantUser.setLastName("Lovelace");
        applicantUser.setUniversityId(UUID.randomUUID().toString().replace("-", "").substring(0, 7));

        attachApplicantRole(applicantUser);

        return applicantUser;
    }

    private static User newApplicantUserWithWebsiteAndLinkedin() {
        User applicantUser = new User();
        applicantUser.setUserId(UUID.randomUUID());
        applicantUser.setEmail("ada@example.com");
        applicantUser.setSelectedLanguage(Language.ENGLISH.getCode());
        applicantUser.setFirstName("Ada");
        applicantUser.setLastName("Lovelace");
        applicantUser.setWebsite("https://example.com");
        applicantUser.setLinkedinUrl("https://linkedin.com/in/testuser");

        attachApplicantRole(applicantUser);

        return applicantUser;
    }

    // --- Saved variants
    // -------------------------------------------------------------------------

    public static Applicant saved(ApplicantRepository repo, UserRepository userRepo, User user) {
        User savedUser = userRepo.save(user);
        return repo.save(newApplicant(savedUser));
    }

    public static Applicant savedWithNewUser(ApplicantRepository repo, UserRepository userRepo) {
        return saved(repo, userRepo, newApplicantUser());
    }

    public static Applicant savedWithNewUserWithWebsiteAndLinkedin(ApplicantRepository repo, UserRepository userRepo) {
        return saved(repo, userRepo, newApplicantUserWithWebsiteAndLinkedin());
    }

    /**
     * Saves an Applicant for a User that was already saved (with role attached).
     * Does NOT call newApplicant to avoid re-attaching the APPLICANT role.
     */
    public static Applicant savedWithExistingUser(ApplicantRepository repo, User savedUser) {
        Applicant a = new Applicant();
        a.setUser(savedUser);
        a.setStreet("Teststr. 1");
        a.setPostalCode("12345");
        a.setCity("Munich");
        a.setCountry("de");
        a.setBachelorDegreeName("B.Sc. Computer Science");
        a.setBachelorGradeUpperLimit("1.0");
        a.setBachelorGradeLowerLimit("4.0");
        a.setBachelorGrade("1.7");
        a.setBachelorUniversity("TUM");
        a.setMasterDegreeName("M.Sc. Informatics");
        a.setMasterGradeUpperLimit("1.0");
        a.setMasterGradeLowerLimit("4.0");
        a.setMasterGrade("1.3");
        a.setMasterUniversity("TUM");
        return repo.save(a);
    }

    /**
     * Creates and saves an Applicant with a random unique email address.
     * Useful when multiple applicants are needed in a single test.
     */
    public static Applicant savedWithRandomEmail(ApplicantRepository repo, UserRepository userRepo) {
        User applicantUser = new User();
        applicantUser.setUserId(UUID.randomUUID());
        applicantUser.setEmail("applicant" + UUID.randomUUID().toString().substring(0, 8) + "@example.com");
        applicantUser.setSelectedLanguage(Language.ENGLISH.getCode());
        applicantUser.setFirstName("Test");
        applicantUser.setLastName("Applicant");
        applicantUser.setUniversityId(UUID.randomUUID().toString().replace("-", "").substring(0, 7));
        attachApplicantRole(applicantUser);
        User savedUser = userRepo.save(applicantUser);

        return savedWithExistingUser(repo, savedUser);
    }

    public static User saveApplicant(String email, UserRepository userRepository) {
        User applicantUser = UserTestData.newUserAll(UUID.randomUUID(), email, "App", "User");
        ApplicantTestData.attachApplicantRole(applicantUser);
        applicantUser.setUniversityId(UUID.randomUUID().toString().replace("-", "").substring(0, 7));
        return userRepository.saveAndFlush(applicantUser);
    }

    public static User saveApplicantWithLastActivity(
        String email,
        ApplicantRepository applicantRepository,
        UserRepository userRepository,
        LocalDateTime lastActivityAt
    ) {
        User applicantUser = UserTestData.newUserAll(UUID.randomUUID(), email, "Applicant", "User");
        ApplicantTestData.attachApplicantRole(applicantUser);
        applicantUser.setUniversityId(UUID.randomUUID().toString().replace("-", "").substring(0, 7));
        applicantUser.setLastActivityAt(lastActivityAt);
        User savedApplicantUser = userRepository.saveAndFlush(applicantUser);
        ApplicantTestData.savedWithExistingUser(applicantRepository, savedApplicantUser);
        return savedApplicantUser;
    }

    // --- Attach roles---------------------------------------------------------------------------

    /**
     * Attaches the APPLICANT role for a given user.
     */
    public static void attachApplicantRole(User user) {
        UserResearchGroupRole link = new UserResearchGroupRole();
        link.setUser(user);
        link.setRole(UserRole.APPLICANT);

        user.getResearchGroupRoles().add(link);
    }
}
