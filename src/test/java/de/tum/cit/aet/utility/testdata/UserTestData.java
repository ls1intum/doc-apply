package de.tum.cit.aet.utility.testdata;

import de.tum.cit.aet.usermanagement.constants.UserRole;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.domain.UserResearchGroupRole;
import de.tum.cit.aet.usermanagement.dto.KeycloakUserDTO;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import java.util.UUID;

/**
 * Test data helpers for User (professor).
 */
public final class UserTestData {

    private UserTestData() {}

    /** Unsaved user with defaults. */
    public static User newUser() {
        User u = new User();
        u.setUserId(UUID.randomUUID());
        u.setFirstName("John");
        u.setLastName("Doe");
        u.setEmail("john.doe@example.com");
        return u;
    }

    /** Unsaved professor with defaults. */
    public static User newProfessor(ResearchGroup rg) {
        User u = new User();
        u.setUserId(UUID.randomUUID());
        u.setFirstName("Alice");
        u.setLastName("Smith");
        u.setEmail("alice.smith@example.com");
        u.setSelectedLanguage("en");
        u.setUniversityId(UUID.randomUUID().toString().replace("-", "").substring(0, 7));
        attachProfessorRole(u, rg);
        return u;
    }

    /** Unsaved employee with defaults. */
    public static User newEmployee(ResearchGroup rg) {
        User u = new User();
        u.setUserId(UUID.randomUUID());
        u.setFirstName("Bob");
        u.setLastName("Spencer");
        u.setEmail("bob.spencer@example.com");
        u.setSelectedLanguage("en");
        u.setUniversityId(UUID.randomUUID().toString().replace("-", "").substring(0, 7));
        attachEmployeeRole(u, rg);
        return u;
    }

    /** Unsaved user; all fields optional (null = keep default). */
    public static User newUserAll(UUID userId, String email, String firstName, String lastName) {
        User u = newUser();
        if (userId != null) u.setUserId(userId);
        if (email != null) u.setEmail(email);
        if (firstName != null) u.setFirstName(firstName);
        if (lastName != null) u.setLastName(lastName);
        return u;
    }

    /** Unsaved professor; all fields optional (null = keep default). */
    public static User newProfessorAll(
        ResearchGroup researchGroup,
        UUID userId,
        String email,
        String firstName,
        String lastName,
        String selectedLanguage,
        String phoneNumber,
        String website,
        String linkedinUrl,
        String nationality,
        String avatar,
        String gender,
        String universityId
    ) {
        User u = newProfessor(researchGroup);
        if (userId != null) u.setUserId(userId);
        if (email != null) u.setEmail(email);
        if (firstName != null) u.setFirstName(firstName);
        if (lastName != null) u.setLastName(lastName);
        if (selectedLanguage != null) u.setSelectedLanguage(selectedLanguage);
        if (phoneNumber != null) u.setPhoneNumber(phoneNumber);
        if (website != null) u.setWebsite(website);
        if (linkedinUrl != null) u.setLinkedinUrl(linkedinUrl);
        if (nationality != null) u.setNationality(nationality);
        if (avatar != null) u.setAvatar(avatar);
        if (gender != null) u.setGender(gender);
        if (universityId != null) {
            u.setUniversityId(universityId);
        } else {
            u.setUniversityId(UUID.randomUUID().toString().replace("-", "").substring(0, 7));
        }
        return u;
    }

    // --- Saved variants
    // -------------------------------------------------------------------------
    public static User savedUser(UserRepository repo) {
        return repo.save(newUser());
    }

    public static User savedUserAll(UserRepository repo, UUID userId, String email, String firstName, String lastName) {
        return repo.save(newUserAll(userId, email, firstName, lastName));
    }

    public static User savedProfessor(UserRepository repo, ResearchGroup rg) {
        return repo.save(newProfessor(rg));
    }

    public static User savedEmployee(UserRepository repo, ResearchGroup rg) {
        return repo.save(newEmployee(rg));
    }

    public static User savedProfessorAll(
        UserRepository repo,
        ResearchGroup researchGroup,
        UUID userId,
        String email,
        String firstName,
        String lastName,
        String selectedLanguage,
        String phoneNumber,
        String website,
        String linkedinUrl,
        String nationality,
        String avatar,
        String gender,
        String universityId
    ) {
        return repo.save(
            newProfessorAll(
                researchGroup,
                userId,
                email,
                firstName,
                lastName,
                selectedLanguage,
                phoneNumber,
                website,
                linkedinUrl,
                nationality,
                avatar,
                gender,
                universityId
            )
        );
    }

    public static User saveProfessor(ResearchGroup rg, UserRepository userRepository) {
        User professor = new User();
        professor.setUserId(UUID.randomUUID());
        professor.setEmail("professor-" + UUID.randomUUID().toString().substring(0, 8) + "@test.local");
        professor.setFirstName("Prof");
        professor.setLastName("Tester");
        professor.setSelectedLanguage("en");
        professor.setUniversityId(UUID.randomUUID().toString().replace("-", "").substring(0, 7));

        UserResearchGroupRole role = new UserResearchGroupRole();
        role.setUser(professor);
        role.setResearchGroup(rg);
        role.setRole(UserRole.PROFESSOR);
        professor.getResearchGroupRoles().add(role);

        return userRepository.saveAndFlush(professor);
    }

    public static User saveAdmin(UserRepository userRepository) {
        User admin = new User();
        admin.setUserId(UUID.randomUUID());
        admin.setEmail("admin-" + UUID.randomUUID().toString().substring(0, 8) + "@test.local");
        admin.setFirstName("Admin");
        admin.setLastName("Tester");
        admin.setSelectedLanguage("en");
        admin.setUniversityId(UUID.randomUUID().toString().replace("-", "").substring(0, 7));

        UserResearchGroupRole role = new UserResearchGroupRole();
        role.setUser(admin);
        role.setRole(UserRole.ADMIN);
        admin.getResearchGroupRoles().add(role);

        return userRepository.saveAndFlush(admin);
    }

    /**
     * Saved employee with essential fields only.
     * Use this method to avoid long parameter lists.
     */
    public static User savedEmployee(
        UserRepository repo,
        ResearchGroup researchGroup,
        String email,
        String firstName,
        String lastName,
        String universityId
    ) {
        User u = new User();
        u.setUserId(UUID.randomUUID());
        u.setEmail(email);
        u.setFirstName(firstName);
        u.setLastName(lastName);
        u.setSelectedLanguage("en");
        u.setUniversityId(universityId != null ? universityId : UUID.randomUUID().toString().replace("-", "").substring(0, 7));
        attachEmployeeRole(u, researchGroup);
        return repo.save(u);
    }

    /**
     * Creates and saves a professor in a NEW research group.
     * Useful for testing authorization (403) scenarios where the user should not
     * have access.
     */
    public static User savedOtherProfessor(
        UserRepository userRepo,
        de.tum.cit.aet.usermanagement.repository.ResearchGroupRepository researchGroupRepo
    ) {
        ResearchGroup otherRg = ResearchGroupTestData.savedAll(
            researchGroupRepo,
            "Other Group",
            "Prof. Smith",
            "other" + UUID.randomUUID().toString().substring(0, 8) + "@example.com",
            "OTH",
            "Other research",
            "other@example.com",
            "80333",
            "CIT",
            "Other Street",
            "https://other.tum.de",
            "ACTIVE"
        );

        return savedProfessorAll(
            userRepo,
            otherRg,
            null,
            "other.prof" + UUID.randomUUID().toString().substring(0, 8) + "@tum.de",
            "Jane",
            "Doe",
            "en",
            "+49 89 5678",
            "https://jane.tum.de",
            "https://linkedin.com/in/jane",
            "DE",
            null,
            "weiblich",
            UUID.randomUUID().toString().replace("-", "").substring(0, 7)
        );
    }

    /**
     * Create a KeycloakUserDTO from a domain User for tests.
     */
    public static KeycloakUserDTO kcUserFrom(User user) {
        return new KeycloakUserDTO(
            user.getUserId(),
            user.getUniversityId(),
            user.getFirstName(),
            user.getLastName(),
            user.getEmail(),
            user.getUniversityId()
        );
    }

    /**
     * Build a KeycloakUserDTO with custom data.
     */
    public static KeycloakUserDTO newKeycloakUser(
        UUID id,
        String username,
        String firstName,
        String lastName,
        String email,
        String universityId
    ) {
        return new KeycloakUserDTO(id, username, firstName, lastName, email, universityId);
    }

    /**
     * Creates and saves a placeholder "deleted" user with a specific ID.
     * If the user already exists, returns the existing one.
     */
    public static User savedDeletedUser(UserRepository repo, UUID userId) {
        if (repo.existsById(userId)) {
            return repo.findById(userId).orElseThrow();
        }

        User deleted = new User();
        deleted.setUserId(userId);
        deleted.setEmail("deleted@user");
        deleted.setFirstName("Deleted");
        deleted.setLastName("User");
        deleted.setSelectedLanguage("en");
        deleted.setUniversityId("del" + UUID.randomUUID().toString().replace("-", "").substring(0, 4));
        return repo.saveAndFlush(deleted);
    }

    /**
     * Creates and saves a user without a research group.
     */
    public static User createUserWithoutResearchGroup(
        UserRepository userRepository,
        String email,
        String firstName,
        String lastName,
        String universityId
    ) {
        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setEmail(email);
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setSelectedLanguage("en");
        user.setUniversityId(universityId);
        return userRepository.save(user);
    }

    private static void attachProfessorRole(User user, ResearchGroup rg) {
        UserResearchGroupRole link = new UserResearchGroupRole();
        link.setUser(user);
        link.setResearchGroup(rg);
        link.setRole(UserRole.PROFESSOR);

        user.getResearchGroupRoles().add(link);
        rg.getUserRoles().add(link);
    }

    private static void attachEmployeeRole(User user, ResearchGroup rg) {
        UserResearchGroupRole link = new UserResearchGroupRole();
        link.setUser(user);
        link.setResearchGroup(rg);
        link.setRole(UserRole.EMPLOYEE);

        user.getResearchGroupRoles().add(link);
        rg.getUserRoles().add(link);
    }
}
