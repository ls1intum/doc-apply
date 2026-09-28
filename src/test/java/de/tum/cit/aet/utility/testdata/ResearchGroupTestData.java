package de.tum.cit.aet.utility.testdata;

import de.tum.cit.aet.usermanagement.constants.ResearchGroupState;
import de.tum.cit.aet.usermanagement.domain.Department;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.dto.AdminResearchGroupFilterDTO;
import de.tum.cit.aet.usermanagement.dto.DepartmentDTO;
import de.tum.cit.aet.usermanagement.dto.EmployeeResearchGroupRequestDTO;
import de.tum.cit.aet.usermanagement.dto.ResearchGroupAdminDTO;
import de.tum.cit.aet.usermanagement.dto.ResearchGroupDTO;
import de.tum.cit.aet.usermanagement.dto.ResearchGroupRequestDTO;
import de.tum.cit.aet.usermanagement.repository.ResearchGroupRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Test data helpers for ResearchGroup.
 * Keeps entity construction and saving in one place.
 */
public final class ResearchGroupTestData {

    private ResearchGroupTestData() {}

    /**
     * Unsaved ResearchGroup with sane defaults.
     */
    public static ResearchGroup newRg() {
        ResearchGroup rg = new ResearchGroup();
        rg.setHead("Alice");
        rg.setName("Test Group");
        rg.setAbbreviation("TG");
        rg.setCity("Testville");
        rg.setDescription("A test research group");
        rg.setEmail("rg@example.com");
        rg.setPostalCode("12345");
        rg.setStreet("123 Main St");
        rg.setWebsite("http://example.com");
        rg.setUniversityId(UUID.randomUUID().toString().replace("-", "").substring(0, 7));
        rg.setState(ResearchGroupState.ACTIVE);
        return rg;
    }

    /**
     * Unsaved ResearchGroup with sane defaults, all optional fields set to null.
     */
    public static ResearchGroup newRgOptional() {
        ResearchGroup rg = new ResearchGroup();
        rg.setHead("Alice");
        rg.setName("Test Group");
        rg.setAbbreviation(null);
        rg.setCity(null);
        rg.setDescription(null);
        rg.setEmail(null);
        rg.setPostalCode(null);
        rg.setStreet(null);
        rg.setWebsite(null);
        rg.setUniversityId(UUID.randomUUID().toString().replace("-", "").substring(0, 7));
        rg.setState(ResearchGroupState.ACTIVE);
        return rg;
    }

    /**
     * Unsaved ResearchGroup; all fields optional (null = keep default).
     */
    public static ResearchGroup newRgAll(
        String head,
        String name,
        String abbreviation,
        String city,
        String description,
        String email,
        String postalCode,
        String school,
        String street,
        String website,
        String state
    ) {
        return newRgAll(head, name, abbreviation, city, description, email, postalCode, street, website, state);
    }

    /**
     * Unsaved ResearchGroup; all fields optional (null = keep default).
     */
    public static ResearchGroup newRgAll(
        String head,
        String name,
        String abbreviation,
        String city,
        String description,
        String email,
        String postalCode,
        String street,
        String website,
        String state
    ) {
        ResearchGroup rg = newRg();
        if (head != null) rg.setHead(head);
        if (name != null) rg.setName(name);
        if (abbreviation != null) rg.setAbbreviation(abbreviation);
        if (city != null) rg.setCity(city);
        if (description != null) rg.setDescription(description);
        if (email != null) rg.setEmail(email);
        if (postalCode != null) rg.setPostalCode(postalCode);
        if (street != null) rg.setStreet(street);
        if (website != null) rg.setWebsite(website);
        if (state != null) rg.setState(ResearchGroupState.valueOf(state));
        if (rg.getUniversityId() == null) {
            rg.setUniversityId(UUID.randomUUID().toString().replace("-", "").substring(0, 7));
        }
        return rg;
    }

    /**
     * Unsaved ResearchGroup with department.
     */
    public static ResearchGroup newRgWithDepartment(Department department) {
        ResearchGroup rg = newRg();
        rg.setDepartment(department);
        return rg;
    }

    // --- Save to Repository variants -------------------------------------------------------------------------
    public static ResearchGroup saved(ResearchGroupRepository repo) {
        return repo.save(newRg());
    }

    public static ResearchGroup saved(ResearchGroupRepository repo, Department department) {
        ResearchGroup rg = newRg();
        rg.setDepartment(department);
        return repo.save(rg);
    }

    public static ResearchGroup savedAll(
        ResearchGroupRepository repo,
        String head,
        String name,
        String abbreviation,
        String city,
        String description,
        String email,
        String postalCode,
        String school,
        String street,
        String website,
        String state
    ) {
        return repo.save(newRgAll(head, name, abbreviation, city, description, email, postalCode, street, website, state));
    }

    public static ResearchGroup savedAll(
        ResearchGroupRepository repo,
        Department department,
        String head,
        String name,
        String abbreviation,
        String city,
        String description,
        String email,
        String postalCode,
        String street,
        String website,
        String state
    ) {
        ResearchGroup rg = newRgAll(head, name, abbreviation, city, description, email, postalCode, street, website, state);
        rg.setDepartment(department);
        return repo.save(rg);
    }

    // --- DTO creation helpers -------------------------------------------------------------------------

    /**
     * Creates a ResearchGroupRequestDTO with the given research group name and default values for other fields.
     * Uses a random UUID for departmentId.
     */
    public static ResearchGroupRequestDTO createResearchGroupRequest(String researchGroupName) {
        return createResearchGroupRequest(researchGroupName, UUID.randomUUID());
    }

    /**
     * Creates a ResearchGroupRequestDTO with the given research group name and department ID.
     */
    public static ResearchGroupRequestDTO createResearchGroupRequest(String researchGroupName, UUID departmentId) {
        return new ResearchGroupRequestDTO(
            "Prof.",
            "John",
            "Doe",
            "ab12cde",
            "Prof. New",
            researchGroupName,
            departmentId,
            "nrg@test.com",
            "NRG",
            "https://nrg.com",
            "Description",
            "Main St",
            "12345",
            "City"
        );
    }

    /**
     * Creates a ResearchGroupDTO with all fields.
     */
    public static ResearchGroupDTO createResearchGroupDTO(
        String name,
        String abbreviation,
        String head,
        UUID departmentId,
        String email,
        String website,
        String description,
        String street,
        String postalCode,
        String city,
        ResearchGroupState state
    ) {
        return new ResearchGroupDTO(name, abbreviation, head, email, website, description, street, postalCode, city, departmentId, state);
    }

    /**
     * Creates an EmployeeResearchGroupRequestDTO.
     */
    public static EmployeeResearchGroupRequestDTO createEmployeeResearchGroupRequestDTO(String professorName) {
        return new EmployeeResearchGroupRequestDTO(professorName);
    }

    /**
     * Creates an AdminResearchGroupFilterDTO.
     */
    public static AdminResearchGroupFilterDTO createAdminResearchGroupFilterDTO(List<ResearchGroupState> states, String search) {
        return new AdminResearchGroupFilterDTO(states, search);
    }

    /**
     * Creates a ResearchGroupAdminDTO.
     */
    public static ResearchGroupAdminDTO createResearchGroupAdminDTO(
        UUID id,
        String name,
        String head,
        DepartmentDTO department,
        ResearchGroupState state,
        LocalDateTime creationDate
    ) {
        return new ResearchGroupAdminDTO(id, name, head, department, state, creationDate);
    }
}
