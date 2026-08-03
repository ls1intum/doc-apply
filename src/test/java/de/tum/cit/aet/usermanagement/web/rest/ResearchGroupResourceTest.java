package de.tum.cit.aet.usermanagement.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.core.dto.PageResponseDTO;
import de.tum.cit.aet.notification.service.AsyncEmailSender;
import de.tum.cit.aet.notification.service.mail.Email;
import de.tum.cit.aet.usermanagement.constants.ResearchGroupState;
import de.tum.cit.aet.usermanagement.domain.Department;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.School;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.dto.*;
import de.tum.cit.aet.usermanagement.repository.DepartmentRepository;
import de.tum.cit.aet.usermanagement.repository.ResearchGroupRepository;
import de.tum.cit.aet.usermanagement.repository.SchoolRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import de.tum.cit.aet.usermanagement.repository.UserResearchGroupRoleRepository;
import de.tum.cit.aet.usermanagement.service.KeycloakUserService;
import de.tum.cit.aet.usermanagement.service.ResearchGroupService;
import de.tum.cit.aet.usermanagement.web.ResearchGroupResource;
import de.tum.cit.aet.utility.DatabaseCleaner;
import de.tum.cit.aet.utility.MvcTestClient;
import de.tum.cit.aet.utility.security.JwtPostProcessors;
import de.tum.cit.aet.utility.testdata.DepartmentTestData;
import de.tum.cit.aet.utility.testdata.ResearchGroupTestData;
import de.tum.cit.aet.utility.testdata.SchoolTestData;
import de.tum.cit.aet.utility.testdata.UserTestData;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.core.type.TypeReference;

/**
 * Integration tests for {@link ResearchGroupResource}.
 * Tests all REST endpoints for research group management including:
 * - CRUD operations
 * - Admin workflows (activate, deny, withdraw)
 * - Access control and authentication
 * - Pagination and filtering
 */
public class ResearchGroupResourceTest extends AbstractResourceTest {

    private static final String API_BASE_PATH = "/api/research-groups";
    private static final int DEFAULT_PAGE_SIZE = 10;
    private static final int DEFAULT_PAGE_NUMBER = 0;

    @Autowired
    ResearchGroupRepository researchGroupRepository;

    @Autowired
    UserRepository userRepository;

    @Autowired
    UserResearchGroupRoleRepository userResearchGroupRoleRepository;

    @Autowired
    SchoolRepository schoolRepository;

    @Autowired
    DepartmentRepository departmentRepository;

    @Autowired
    DatabaseCleaner databaseCleaner;

    @Autowired
    MvcTestClient api;

    @Autowired
    ResearchGroupService researchGroupService;

    @Autowired
    KeycloakUserService keycloakUserService;

    private AsyncEmailSender asyncEmailSenderMock;

    School testSchool;
    Department testDepartment;
    ResearchGroup researchGroup;
    ResearchGroup secondResearchGroup;
    User researchGroupUser;
    User secondResearchGroupUser;

    @BeforeEach
    void setup() {
        asyncEmailSenderMock = Mockito.mock(AsyncEmailSender.class);
        ReflectionTestUtils.setField(researchGroupService, "emailSender", asyncEmailSenderMock);
        databaseCleaner.clean();
        testSchool = SchoolTestData.saved(schoolRepository, "School of Computation, Information and Technology", "CIT");
        testDepartment = DepartmentTestData.saved(departmentRepository, "Computer Science", testSchool);
        researchGroup = ResearchGroupTestData.savedAll(
            researchGroupRepository,
            "Prof. Smith",
            "Machine Learning Lab",
            "ML",
            "Munich",
            "We research ML algorithms",
            "contact@ml.tum.de",
            "80333",
            "TUM",
            "Arcisstr. 21",
            "https://ml.tum.de",
            "ACTIVE"
        );
        secondResearchGroup = ResearchGroupTestData.savedAll(
            researchGroupRepository,
            "Dr. Doe",
            "Other Lab",
            "OL",
            "Munich",
            "Other research",
            "contact@other.tum.de",
            "80335",
            "TUM",
            "Otherstr. 10",
            "https://other.tum.de",
            "ACTIVE"
        );
        researchGroupUser = UserTestData.savedProfessor(userRepository, researchGroup);
        secondResearchGroupUser = UserTestData.savedProfessor(userRepository, secondResearchGroup);
    }

    @Nested
    class GetResearchGroupDetails {

        @Test
        void getResearchGroupDetailsExistingIdReturnsDetails() {
            ResearchGroupLargeDTO result = api
                .with(JwtPostProcessors.jwtUser(researchGroupUser.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(API_BASE_PATH + "/detail/" + researchGroup.getResearchGroupId(), Map.of(), ResearchGroupLargeDTO.class, 200);

            assertThat(userResearchGroupRoleRepository.findByUserAndResearchGroup(researchGroupUser, researchGroup)).isPresent();
            assertThat(result.description()).isEqualTo("We research ML algorithms");
            assertThat(result.email()).isEqualTo("contact@ml.tum.de");
            assertThat(result.website()).isEqualTo("https://ml.tum.de");
            assertThat(result.street()).isEqualTo("Arcisstr. 21");
            assertThat(result.postalCode()).isEqualTo("80333");
            assertThat(result.city()).isEqualTo("Munich");
        }

        @Test
        void getResearchGroupDetailsNoIdAndNonExistingIdThrowsException() {
            api.getAndRead(API_BASE_PATH + "/detail/", Map.of(), ResearchGroupLargeDTO.class, 500);
            UUID nonExistingId = UUID.randomUUID();
            api.getAndRead(API_BASE_PATH + "/detail/" + nonExistingId, Map.of(), ResearchGroupLargeDTO.class, 403);
        }

        @Test
        void getResearchGroupDetailsOtherUsersGroupReturnsForbidden() {
            api.getAndRead(
                API_BASE_PATH + "/detail/" + secondResearchGroup.getResearchGroupId(),
                Map.of(),
                ResearchGroupLargeDTO.class,
                403
            );
        }
    }

    @Nested
    class GetAllResearchGroups {

        @Test
        void getAllResearchGroupsReturnsPagedResults() {
            PageResponseDTO<ResearchGroupDTO> result = api.getAndRead(
                API_BASE_PATH,
                Map.of("pageNumber", String.valueOf(DEFAULT_PAGE_NUMBER), "pageSize", String.valueOf(DEFAULT_PAGE_SIZE)),
                new TypeReference<PageResponseDTO<ResearchGroupDTO>>() {},
                200
            );

            assertThat(result).isNotNull();
            assertThat(result.getContent()).isNotEmpty();
            assertThat(result.getContent()).hasSize(2); // 2 research groups in setup

            List<ResearchGroupDTO> contentList = new ArrayList<>(result.getContent());
            assertThat(contentList.get(0).name()).isEqualTo("Machine Learning Lab");
            assertThat(contentList.get(0).abbreviation()).isEqualTo("ML");
            assertThat(contentList.get(0).email()).isEqualTo("contact@ml.tum.de");
            assertThat(contentList.get(1).name()).isEqualTo("Other Lab");
            assertThat(contentList.get(1).abbreviation()).isEqualTo("OL");
            assertThat(contentList.get(1).email()).isEqualTo("contact@other.tum.de");
        }

        @Test
        void getAllResearchGroupsWithPaginationWorks() {
            PageResponseDTO<ResearchGroupDTO> result = api.getAndRead(
                API_BASE_PATH,
                Map.of("pageNumber", String.valueOf(DEFAULT_PAGE_NUMBER), "pageSize", "1"),
                new TypeReference<PageResponseDTO<ResearchGroupDTO>>() {},
                200
            );

            assertThat(result).isNotNull();
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getTotalElements()).isEqualTo(2);

            List<ResearchGroupDTO> contentList = new ArrayList<>(result.getContent());
            assertThat(contentList.get(0).name()).isEqualTo("Machine Learning Lab");
            assertThat(contentList.get(0).abbreviation()).isEqualTo("ML");
            assertThat(contentList.get(0).email()).isEqualTo("contact@ml.tum.de");
        }
    }

    @Nested
    class GetResearchGroupById {

        @Test
        void getResearchGroupByIdReturnsCorrectGroup() {
            ResearchGroupDTO result = api.getAndRead(
                API_BASE_PATH + "/" + researchGroup.getResearchGroupId(),
                Map.of(),
                ResearchGroupDTO.class,
                200
            );

            assertThat(result).isNotNull();
            assertThat(result.name()).isEqualTo("Machine Learning Lab");
            assertThat(result.head()).isEqualTo("Prof. Smith");
            assertThat(result.abbreviation()).isEqualTo("ML");
        }

        @Test
        void getResearchGroupByNonExistingIdReturns404() {
            UUID nonExistingId = UUID.randomUUID();
            api.getAndRead(API_BASE_PATH + "/" + nonExistingId, Map.of(), ResearchGroupDTO.class, 404);
        }
    }

    @Nested
    class GetResearchGroupMembers {

        @Test
        void getResearchGroupMembersReturnsPaginatedMembers() {
            PageResponseDTO<UserShortDTO> result = api
                .with(JwtPostProcessors.jwtUser(researchGroupUser.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(
                    API_BASE_PATH + "/members",
                    Map.of("pageNumber", String.valueOf(DEFAULT_PAGE_NUMBER), "pageSize", String.valueOf(DEFAULT_PAGE_SIZE)),
                    new TypeReference<PageResponseDTO<UserShortDTO>>() {},
                    200
                );

            assertThat(result).isNotNull();
            assertThat(result.getContent()).isNotEmpty();

            List<UserShortDTO> contentList = new ArrayList<>(result.getContent());
            assertThat(contentList).anyMatch(user -> user.getUserId().equals(researchGroupUser.getUserId()));
            assertThat(contentList).hasSize(1);

            assertThat(contentList.get(0).getUserId()).isEqualTo(researchGroupUser.getUserId());
            assertThat(contentList.get(0).getEmail()).isEqualTo(researchGroupUser.getEmail());
        }

        @Test
        void getResearchGroupMembersWithoutAuthenticationReturns403() {
            api.getAndRead(
                API_BASE_PATH + "/members",
                Map.of("pageNumber", String.valueOf(DEFAULT_PAGE_NUMBER), "pageSize", String.valueOf(DEFAULT_PAGE_SIZE)),
                Void.class,
                403
            );
        }
    }

    @Nested
    class RemoveMemberFromResearchGroup {

        @Test
        void shouldReturnNoContentWhenRemoveMemberFromResearchGroup() {
            User memberToRemove = UserTestData.savedProfessor(userRepository, researchGroup);

            api
                .with(JwtPostProcessors.jwtUser(researchGroupUser.getUserId(), "ROLE_PROFESSOR"))
                .deleteAndRead(API_BASE_PATH + "/members/" + memberToRemove.getUserId(), null, Void.class, 204);

            // The professor/employee role is collapsed to APPLICANT and the link to the
            // research group is severed; there should no longer be a role linking the
            // user to the research group.
            assertThat(userResearchGroupRoleRepository.findByUserAndResearchGroup(memberToRemove, researchGroup)).isEmpty();
        }

        @Test
        void shouldThrowWhenRemoveMemberFromResearchGroupAsEmployee() {
            User employee = UserTestData.createUserWithoutResearchGroup(userRepository, "employee.remove@tum.de", "Emp", "Loyee", "emp123");

            User memberToRemove = UserTestData.savedProfessor(userRepository, researchGroup);

            api
                .with(JwtPostProcessors.jwtUser(employee.getUserId(), "ROLE_USER"))
                .deleteAndRead(API_BASE_PATH + "/members/" + memberToRemove.getUserId(), null, Void.class, 403);
        }

        @Test
        void removeMemberFromResearchGroupWithNonExistentUserThrowsException() {
            api
                .with(JwtPostProcessors.jwtUser(researchGroupUser.getUserId(), "ROLE_PROFESSOR"))
                .deleteAndRead(API_BASE_PATH + "/members/" + UUID.randomUUID(), null, Void.class, 404);
        }

        @Test
        void removeMemberFromResearchGroupWithUserInDifferentGroupThrowsException() {
            User otherUser = UserTestData.savedProfessor(userRepository, secondResearchGroup);

            api
                .with(JwtPostProcessors.jwtUser(researchGroupUser.getUserId(), "ROLE_PROFESSOR"))
                .deleteAndRead(API_BASE_PATH + "/members/" + otherUser.getUserId(), null, Void.class, 403);
        }

        @Test
        void removeSelfFromResearchGroupThrowsException() {
            api
                .with(JwtPostProcessors.jwtUser(researchGroupUser.getUserId(), "ROLE_PROFESSOR"))
                .deleteAndRead(API_BASE_PATH + "/members/" + researchGroupUser.getUserId(), null, Void.class, 400);
        }

        @Test
        void shouldReturn401WhenRemoveMemberFromResearchGroupWithoutAuthentication() {
            // Unauthenticated requests are rejected by the security filter chain with 401,
            // not by the @ProfessorOrAdmin annotation (which would yield 403).
            api.withoutPostProcessors().deleteAndRead(API_BASE_PATH + "/members/" + UUID.randomUUID(), null, Void.class, 401);
        }
    }

    @Nested
    class UpdateResearchGroup {

        @Test
        void updateResearchGroupReturnsUpdatedGroup() {
            ResearchGroupDTO updateDTO = ResearchGroupTestData.createResearchGroupDTO(
                "Updated ML Lab",
                "UML",
                "Prof. Smith",
                testDepartment.getDepartmentId(),
                "updated@ml.tum.de",
                "https://updated.ml.tum.de",
                "Updated description",
                "Arcisstr. 21",
                "80333",
                "Munich",
                ResearchGroupState.ACTIVE
            );

            ResearchGroupDTO result = api
                .with(JwtPostProcessors.jwtUser(researchGroupUser.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(API_BASE_PATH + "/" + researchGroup.getResearchGroupId(), updateDTO, ResearchGroupDTO.class, 200);

            assertThat(result).isNotNull();
            assertThat(result.name()).isEqualTo("Updated ML Lab");
            assertThat(result.abbreviation()).isEqualTo("UML");
            assertThat(result.email()).isEqualTo("updated@ml.tum.de");
        }

        @Test
        void updateResearchGroupWithInvalidDataReturns400() {
            ResearchGroupDTO invalidDTO = ResearchGroupTestData.createResearchGroupDTO(
                "", // Invalid: empty name
                "ML",
                "",
                testDepartment.getDepartmentId(),
                "invalid-email", // Invalid email
                "https://ml.tum.de",
                "Description",
                "Street",
                "80333",
                "Munich",
                ResearchGroupState.ACTIVE
            );

            api
                .with(JwtPostProcessors.jwtUser(researchGroupUser.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(API_BASE_PATH + "/" + researchGroup.getResearchGroupId(), invalidDTO, ResearchGroupDTO.class, 400);
        }
    }

    @Nested
    class CreateProfessorResearchGroupRequest {

        @Test
        void createResearchGroupRequestCreatesGroupInDraftState() {
            User requestUser = UserTestData.createUserWithoutResearchGroup(userRepository, "john.doe@tum.de", "John", "Doe", "ab12cde");

            ResearchGroupRequestDTO request = new ResearchGroupRequestDTO(
                "Dr.",
                "John",
                "Doe",
                "ab12cde",
                "Dr. John Doe",
                "New Research Lab",
                testDepartment.getDepartmentId(),
                "NRL",
                "contact@newlab.tum.de",
                "https://newlab.tum.de",
                "Research on new topics",
                "Boltzmannstr. 3",
                "85748",
                "Garching"
            );

            ResearchGroupDTO result = api
                .with(JwtPostProcessors.jwtUser(requestUser.getUserId(), "ROLE_APPLICANT"))
                .postAndRead(API_BASE_PATH + "/professor-request", request, ResearchGroupDTO.class, 201);

            assertThat(result).isNotNull();
            assertThat(result.name()).isEqualTo("New Research Lab");
            assertThat(result.state()).isEqualTo(ResearchGroupState.DRAFT);
            assertThat(result.abbreviation()).isEqualTo("NRL");

            ArgumentCaptor<Email> emailCaptor = ArgumentCaptor.forClass(Email.class);
            verify(asyncEmailSenderMock, times(1)).sendAsync(emailCaptor.capture());
            assertThat(emailCaptor.getValue().getCustomSubject()).isEqualTo("[TEST] New Research Group Request - New Research Lab");
        }

        @Test
        void createResearchGroupRequestWithMinimalDataWorks() {
            User requestUser = UserTestData.createUserWithoutResearchGroup(
                userRepository,
                "minimal.user@tum.de",
                "Minimal",
                "User",
                "mn33zzz"
            );

            ResearchGroupRequestDTO minimalRequest = new ResearchGroupRequestDTO(
                "Prof.",
                "Minimal",
                "User",
                "mn33zzz",
                "Prof. Minimal User",
                "Minimal Research Lab",
                testDepartment.getDepartmentId(),
                "",
                "",
                "",
                "",
                "",
                "",
                ""
            );

            ResearchGroupDTO result = api
                .with(JwtPostProcessors.jwtUser(requestUser.getUserId(), "ROLE_APPLICANT"))
                .postAndRead(API_BASE_PATH + "/professor-request", minimalRequest, ResearchGroupDTO.class, 201);

            assertThat(result).isNotNull();
            assertThat(result.name()).isEqualTo("Minimal Research Lab");
            assertThat(result.state()).isEqualTo(ResearchGroupState.DRAFT);
        }

        @Test
        void createResearchGroupRequestWithoutAuthenticationReturns403() {
            ResearchGroupRequestDTO request = new ResearchGroupRequestDTO(
                "Dr.",
                "John",
                "Doe",
                "ab12cde",
                "Dr. John Doe",
                "New Research Lab",
                testDepartment.getDepartmentId(),
                "NRL",
                "contact@newlab.tum.de",
                "https://newlab.tum.de",
                "Research on new topics",
                "Boltzmannstr. 3",
                "85748",
                "Garching"
            );

            api.postAndRead(API_BASE_PATH + "/professor-request", request, ResearchGroupDTO.class, 403);
        }

        @Test
        void createProfessorResearchGroupRequestWhenAlreadyMemberThrowsException() {
            ResearchGroupRequestDTO request = ResearchGroupTestData.createResearchGroupRequest(
                "Another Group",
                testDepartment.getDepartmentId()
            );

            api
                .with(JwtPostProcessors.jwtUser(researchGroupUser.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead(API_BASE_PATH + "/professor-request", request, Void.class, 400);
        }

        @Test
        void createProfessorResearchGroupRequestWithExistingNameThrowsException() {
            User requestUser = UserTestData.createUserWithoutResearchGroup(userRepository, "req.exist@tum.de", "Req", "Exist", "req999");
            ResearchGroupRequestDTO request = ResearchGroupTestData.createResearchGroupRequest(
                researchGroup.getName(),
                testDepartment.getDepartmentId()
            );

            api
                .with(JwtPostProcessors.jwtUser(requestUser.getUserId(), "ROLE_APPLICANT"))
                .postAndRead(API_BASE_PATH + "/professor-request", request, Void.class, 409);
        }
    }

    @Nested
    class CreateEmployeeResearchGroupRequest {

        @Test
        void createEmployeeResearchGroupRequestReturnsNoContent() {
            User employeeUser = UserTestData.createUserWithoutResearchGroup(
                userRepository,
                "employee@tum.de",
                "Employee",
                "User",
                "em11plp"
            );

            EmployeeResearchGroupRequestDTO request = new EmployeeResearchGroupRequestDTO("Prof. Smith");

            api
                .with(JwtPostProcessors.jwtUser(employeeUser.getUserId(), "ROLE_APPLICANT"))
                .postAndRead(API_BASE_PATH + "/employee-request", request, Void.class, 204);

            ArgumentCaptor<Email> emailCaptor = ArgumentCaptor.forClass(Email.class);
            verify(asyncEmailSenderMock, times(1)).sendAsync(emailCaptor.capture());
            assertThat(emailCaptor.getValue().getCustomSubject()).isEqualTo(
                "[TEST] Employee Research Group Access Request - employee@tum.de"
            );
        }

        @Test
        void createEmployeeResearchGroupRequestWithEmptyProfessorNameReturns400() {
            User employeeUser = UserTestData.createUserWithoutResearchGroup(
                userRepository,
                "employee2@tum.de",
                "Employee2",
                "User",
                "em22plp"
            );

            EmployeeResearchGroupRequestDTO invalidRequest = new EmployeeResearchGroupRequestDTO("");

            api
                .with(JwtPostProcessors.jwtUser(employeeUser.getUserId(), "ROLE_APPLICANT"))
                .postAndRead(API_BASE_PATH + "/employee-request", invalidRequest, Void.class, 400);
        }

        @Test
        void createEmployeeResearchGroupRequestWithoutAuthenticationReturns403() {
            EmployeeResearchGroupRequestDTO request = new EmployeeResearchGroupRequestDTO("Prof. Smith");
            api.postAndRead(API_BASE_PATH + "/employee-request", request, Void.class, 403);
        }
    }

    @Nested
    class GetResearchGroupsForAdmin {

        @Test
        void getResearchGroupsForAdminReturnsPagedResults() {
            UUID adminUserId = UUID.randomUUID();
            PageResponseDTO<ResearchGroupAdminDTO> result = api
                .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
                .getAndRead(
                    API_BASE_PATH + "/admin",
                    Map.of(
                        "pageNumber",
                        String.valueOf(DEFAULT_PAGE_NUMBER),
                        "pageSize",
                        String.valueOf(DEFAULT_PAGE_SIZE),
                        "sortBy",
                        "createdAt",
                        "direction",
                        "DESC"
                    ),
                    new TypeReference<PageResponseDTO<ResearchGroupAdminDTO>>() {},
                    200
                );

            assertThat(result).isNotNull();
            assertThat(result.getContent()).isNotEmpty();

            List<ResearchGroupAdminDTO> contentList = new ArrayList<>(result.getContent());
            assertThat(contentList).hasSize(2); // 2 research groups in setup
            assertThat(contentList).anyMatch(group -> group.researchGroup().equals("Machine Learning Lab"));
            assertThat(contentList).anyMatch(group -> group.researchGroup().equals("Other Lab"));
        }

        @Test
        void getResearchGroupsForAdminWithSearchQueryFiltersResults() {
            UUID adminUserId = UUID.randomUUID();
            PageResponseDTO<ResearchGroupAdminDTO> result = api
                .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
                .getAndRead(
                    API_BASE_PATH + "/admin",
                    Map.of(
                        "pageNumber",
                        String.valueOf(DEFAULT_PAGE_NUMBER),
                        "pageSize",
                        String.valueOf(DEFAULT_PAGE_SIZE),
                        "searchQuery",
                        "Machine",
                        "sortBy",
                        "createdAt",
                        "direction",
                        "DESC"
                    ),
                    new TypeReference<PageResponseDTO<ResearchGroupAdminDTO>>() {},
                    200
                );

            assertThat(result).isNotNull();
            assertThat(result.getContent()).isNotEmpty();
            assertThat(result.getContent().iterator().next().researchGroup()).contains("Machine");
        }

        @Test
        void getResearchGroupsForAdminWithoutAdminRoleReturns403() {
            api
                .with(JwtPostProcessors.jwtUser(researchGroupUser.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(
                    API_BASE_PATH + "/admin",
                    Map.of(
                        "pageNumber",
                        String.valueOf(DEFAULT_PAGE_NUMBER),
                        "pageSize",
                        String.valueOf(DEFAULT_PAGE_SIZE),
                        "sortBy",
                        "createdAt",
                        "direction",
                        "DESC"
                    ),
                    Void.class,
                    403
                );
        }
    }

    @Nested
    class GetAllProfessorsForAdmin {

        @Test
        void getAllProfessorsForAdminReturnsEveryProfessor() {
            UUID adminUserId = UUID.randomUUID();
            List<UserShortDTO> result = api
                .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
                .getAndRead(API_BASE_PATH + "/admin/professors", Map.of(), new TypeReference<List<UserShortDTO>>() {}, 200);

            assertThat(result).isNotNull();
            assertThat(result).hasSize(2);
            assertThat(result).anyMatch(u -> u.getUserId().equals(researchGroupUser.getUserId()));
            assertThat(result).anyMatch(u -> u.getUserId().equals(secondResearchGroupUser.getUserId()));
        }

        @Test
        void getAllProfessorsForAdminWithoutAdminRoleReturns403() {
            api
                .with(JwtPostProcessors.jwtUser(researchGroupUser.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(API_BASE_PATH + "/admin/professors", Map.of(), Void.class, 403);
        }
    }

    @Nested
    class GetDraftResearchGroups {

        @Test
        void getDraftResearchGroupsReturnsOnlyDraftGroups() {
            // Create a draft research group
            ResearchGroup draftGroup = ResearchGroupTestData.savedAll(
                researchGroupRepository,
                "Draft Lab",
                "Prof. Draft",
                "draft@example.com",
                "DL",
                "Draft research",
                "contact@draft.tum.de",
                "80333",
                "Munich",
                "Draftstr. 1",
                "https://draft.tum.de",
                "DRAFT"
            );
            researchGroupRepository.save(draftGroup);

            UUID adminUserId = UUID.randomUUID();
            PageResponseDTO<ResearchGroupDTO> result = api
                .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
                .getAndRead(
                    API_BASE_PATH + "/draft",
                    Map.of("pageNumber", String.valueOf(DEFAULT_PAGE_NUMBER), "pageSize", String.valueOf(DEFAULT_PAGE_SIZE)),
                    new TypeReference<PageResponseDTO<ResearchGroupDTO>>() {},
                    200
                );

            assertThat(result).isNotNull();
            assertThat(result.getContent()).isNotEmpty();
            assertThat(result.getContent()).allMatch(rg -> rg.state() == ResearchGroupState.DRAFT);
        }

        @Test
        void getDraftResearchGroupsWithoutAdminRoleReturns403() {
            api
                .with(JwtPostProcessors.jwtUser(researchGroupUser.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(
                    API_BASE_PATH + "/draft",
                    Map.of("pageNumber", String.valueOf(DEFAULT_PAGE_NUMBER), "pageSize", String.valueOf(DEFAULT_PAGE_SIZE)),
                    Void.class,
                    403
                );
        }
    }

    @Nested
    class ActivateResearchGroup {

        @Test
        void activateResearchGroupChangesStateToDraftToActive() {
            // Create a draft research group
            ResearchGroup draftGroup = ResearchGroupTestData.savedAll(
                researchGroupRepository,
                "Draft Lab for Activation",
                "Prof. Activation",
                "activate@example.com",
                "DLA",
                "Activation research",
                "contact@activate.tum.de",
                "80333",
                "Munich",
                "Activationstr. 1",
                "https://activate.tum.de",
                "DRAFT"
            );
            researchGroupRepository.save(draftGroup);

            UUID adminUserId = UUID.randomUUID();
            ResearchGroupDTO result = api
                .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
                .postAndRead(API_BASE_PATH + "/" + draftGroup.getResearchGroupId() + "/activate", null, ResearchGroupDTO.class, 200);

            assertThat(result).isNotNull();
            assertThat(result.state()).isEqualTo(ResearchGroupState.ACTIVE);
        }

        @Test
        void activateResearchGroupWithoutAdminRoleReturns403() {
            api
                .with(JwtPostProcessors.jwtUser(researchGroupUser.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead(API_BASE_PATH + "/" + researchGroup.getResearchGroupId() + "/activate", null, Void.class, 403);
        }

        @Test
        void activateActiveResearchGroupThrowsException() {
            UUID adminUserId = UUID.randomUUID();
            api
                .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
                .postAndRead(API_BASE_PATH + "/" + researchGroup.getResearchGroupId() + "/activate", null, Void.class, 500);
        }
    }

    @Nested
    class DenyResearchGroup {

        @Test
        void denyResearchGroupChangesStateToDenied() {
            // Create a draft research group
            ResearchGroup draftGroup = ResearchGroupTestData.savedAll(
                researchGroupRepository,
                "Draft Lab for Denial",
                "Prof. Denial",
                "deny@example.com",
                "DLD",
                "Denial research",
                "contact@deny.tum.de",
                "80333",
                "Munich",
                "Denialstr. 1",
                "https://deny.tum.de",
                "DRAFT"
            );
            researchGroupRepository.save(draftGroup);

            UUID adminUserId = UUID.randomUUID();
            ResearchGroupDTO result = api
                .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
                .postAndRead(API_BASE_PATH + "/" + draftGroup.getResearchGroupId() + "/deny", null, ResearchGroupDTO.class, 200);

            assertThat(result).isNotNull();
            assertThat(result.state()).isEqualTo(ResearchGroupState.DENIED);
        }

        @Test
        void denyResearchGroupWithoutAdminRoleReturns403() {
            api
                .with(JwtPostProcessors.jwtUser(researchGroupUser.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead(API_BASE_PATH + "/" + researchGroup.getResearchGroupId() + "/deny", null, Void.class, 403);
        }

        @Test
        void denyActiveResearchGroupThrowsException() {
            UUID adminUserId = UUID.randomUUID();
            api
                .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
                .postAndRead(API_BASE_PATH + "/" + researchGroup.getResearchGroupId() + "/deny", null, Void.class, 500);
        }
    }

    @Nested
    class WithdrawResearchGroup {

        @Test
        void withdrawResearchGroupChangesStateBackToDraft() {
            // Create a separate research group for withdrawal
            ResearchGroup activeGroup = ResearchGroupTestData.savedAll(
                researchGroupRepository,
                "Prof. Withdrawal",
                "Lab for Withdrawal",
                "LFW",
                "Munich",
                "Withdrawal research",
                "contact@withdraw.tum.de",
                "80333",
                "TUM",
                "Withdrawstr. 1",
                "https://withdraw.tum.de",
                "ACTIVE"
            );
            activeGroup.setState(ResearchGroupState.ACTIVE);
            researchGroupRepository.save(activeGroup);

            UUID adminUserId = UUID.randomUUID();
            ResearchGroupDTO result = api
                .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
                .postAndRead(API_BASE_PATH + "/" + activeGroup.getResearchGroupId() + "/withdraw", null, ResearchGroupDTO.class, 200);

            assertThat(result).isNotNull();
            assertThat(result.state()).isEqualTo(ResearchGroupState.DRAFT);
        }

        @Test
        void withdrawResearchGroupWithoutAdminRoleReturns403() {
            api
                .with(JwtPostProcessors.jwtUser(researchGroupUser.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead(API_BASE_PATH + "/" + researchGroup.getResearchGroupId() + "/withdraw", null, Void.class, 403);
        }

        @Test
        void withdrawDraftResearchGroupThrowsException() {
            ResearchGroup draftGroup = ResearchGroupTestData.savedAll(
                researchGroupRepository,
                "Draft Lab Withdraw",
                "Prof. Withdraw",
                "withdraw@example.com",
                "DLW",
                "Withdraw research",
                "contact@withdraw.tum.de",
                "80333",
                "Munich",
                "Withdrawstr. 1",
                "https://withdraw.tum.de",
                "DRAFT"
            );
            UUID adminUserId = UUID.randomUUID();
            api
                .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
                .postAndRead(API_BASE_PATH + "/" + draftGroup.getResearchGroupId() + "/withdraw", null, Void.class, 500);
        }
    }

    @Nested
    class CreateResearchGroupAsAdmin {

        @Test
        void createResearchGroupAsAdminReturnsCreatedGroup() {
            UUID adminUserID = UUID.randomUUID();
            UserTestData.createUserWithoutResearchGroup(userRepository, "prof.new@tum.de", "Prof.", "New", "adm1234");
            ResearchGroupRequestDTO requestDTO = new ResearchGroupRequestDTO(
                "Prof.",
                "New",
                "User",
                "adm1234",
                "Prof. New User",
                "Admin Created Lab",
                testDepartment.getDepartmentId(),
                "admin.created@tum.de",
                "ACL",
                "https://acl.tum.de",
                "Description",
                "Street",
                "12345",
                "City"
            );

            ResearchGroupDTO result = api
                .with(JwtPostProcessors.jwtUser(adminUserID, "ROLE_ADMIN"))
                .postAndRead(API_BASE_PATH + "/admin-create", requestDTO, ResearchGroupDTO.class, 201);

            assertThat(result).isNotNull();
            assertThat(result.name()).isEqualTo(requestDTO.researchGroupName());
            assertThat(result.head()).isEqualTo(requestDTO.researchGroupHead());
            assertThat(result.state()).isEqualTo(ResearchGroupState.ACTIVE);
        }

        @Test
        void createResearchGroupAsAdminWithNonExistentUserThrowsException() {
            UUID adminUserID = UUID.randomUUID();
            when(keycloakUserService.findUserByUniversityId("nonexistent")).thenReturn(Optional.empty());
            ResearchGroupRequestDTO requestDTO = new ResearchGroupRequestDTO(
                "Prof.",
                "Fail",
                "User",
                "nonexistent",
                "Prof. Fail",
                "Fail Lab",
                testDepartment.getDepartmentId(),
                "fail@tum.de",
                "FL",
                "https://fail.tum.de",
                "Description",
                "Street",
                "12345",
                "City"
            );

            api
                .with(JwtPostProcessors.jwtUser(adminUserID, "ROLE_ADMIN"))
                .postAndRead(API_BASE_PATH + "/admin-create", requestDTO, Void.class, 404);
        }

        @Test
        void createResearchGroupAsAdminWithNonExistentLocalUserCreatesUserFromKeycloak() {
            UUID adminUserID = UUID.randomUUID();
            UUID keycloakUserId = UUID.randomUUID();
            String universityId = "kc123ab";

            when(keycloakUserService.findUserByUniversityId(universityId)).thenReturn(
                Optional.of(new KeycloakUserDTO(keycloakUserId, "kc.user", "Key", "Cloak", "key.cloak@tum.de", universityId))
            );

            ResearchGroupRequestDTO requestDTO = new ResearchGroupRequestDTO(
                "Prof.",
                "Key",
                "Cloak",
                universityId,
                "Prof. Key Cloak",
                "Keycloak Provisioned Lab",
                testDepartment.getDepartmentId(),
                "keycloak.lab@tum.de",
                "KCL",
                "https://kcl.tum.de",
                "Description",
                "Street",
                "12345",
                "City"
            );

            ResearchGroupDTO result = api
                .with(JwtPostProcessors.jwtUser(adminUserID, "ROLE_ADMIN"))
                .postAndRead(API_BASE_PATH + "/admin-create", requestDTO, ResearchGroupDTO.class, 201);

            assertThat(result).isNotNull();
            assertThat(result.name()).isEqualTo("Keycloak Provisioned Lab");

            User createdUser = userRepository.findById(keycloakUserId).orElseThrow();
            assertThat(createdUser.getUniversityId()).isEqualTo(universityId);
            assertThat(createdUser.getEmail()).isEqualTo("key.cloak@tum.de");

            ResearchGroup createdGroup = researchGroupRepository.findByNameIgnoreCase("Keycloak Provisioned Lab").orElseThrow();

            assertThat(userResearchGroupRoleRepository.findByUserAndResearchGroup(createdUser, createdGroup))
                .isPresent()
                .get()
                .extracting(role -> role.getRole().name())
                .isEqualTo("PROFESSOR");
        }

        @Test
        void createResearchGroupAsAdminWithExistingNameThrowsException() {
            UUID adminUserID = UUID.randomUUID();
            UserTestData.createUserWithoutResearchGroup(userRepository, "prof.exist@tum.de", "Prof.", "Exist", "ex123st");
            ResearchGroupRequestDTO requestDTO = new ResearchGroupRequestDTO(
                "Prof.",
                "Exist",
                "User",
                "ex123st",
                "Prof. Exist",
                researchGroup.getName(),
                testDepartment.getDepartmentId(),
                "exist@tum.de",
                "EX",
                "https://exist.tum.de",
                "Description",
                "Street",
                "12345",
                "City"
            );

            api
                .with(JwtPostProcessors.jwtUser(adminUserID, "ROLE_ADMIN"))
                .postAndRead(API_BASE_PATH + "/admin-create", requestDTO, Void.class, 409);
        }

        @Test
        void createResearchGroupAsAdminWithUserAlreadyInGroupThrowsException() {
            UUID adminUserID = UUID.randomUUID();
            User userWithGroup = UserTestData.savedProfessor(userRepository, researchGroup);
            ResearchGroupRequestDTO requestDTO = new ResearchGroupRequestDTO(
                "Prof.",
                "Group",
                "User",
                userWithGroup.getUniversityId(),
                "Prof. Group",
                "Another Lab",
                testDepartment.getDepartmentId(),
                "group@tum.de",
                "AL",
                "https://group.tum.de",
                "Description",
                "Street",
                "12345",
                "City"
            );

            api
                .with(JwtPostProcessors.jwtUser(adminUserID, "ROLE_ADMIN"))
                .postAndRead(API_BASE_PATH + "/admin-create", requestDTO, Void.class, 400);
        }
    }

    @Nested
    class AddMembersToResearchGroup {

        @Test
        void shouldAddMembersToResearchGroupAsProfessor() {
            User userToAdd = UserTestData.createUserWithoutResearchGroup(userRepository, "add.me@tum.de", "Add", "Me", "add123");
            KeycloakUserDTO kcUser = UserTestData.kcUserFrom(userToAdd);
            AddMembersToResearchGroupDTO dto = new AddMembersToResearchGroupDTO(List.of(kcUser), researchGroup.getResearchGroupId());

            api
                .with(JwtPostProcessors.jwtUser(researchGroupUser.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead(API_BASE_PATH + "/members", dto, Void.class, 204);

            User updatedUser = userRepository.findById(userToAdd.getUserId()).orElseThrow();
            assertThat(userResearchGroupRoleRepository.findByUserAndResearchGroup(updatedUser, researchGroup)).isPresent();
        }

        @Test
        void shouldAddMembersToResearchGroupAsAdmin() {
            User userToAdd = UserTestData.createUserWithoutResearchGroup(userRepository, "add.admin@tum.de", "Add", "Admin", "adm999");
            KeycloakUserDTO kcUser = UserTestData.kcUserFrom(userToAdd);
            AddMembersToResearchGroupDTO dto = new AddMembersToResearchGroupDTO(List.of(kcUser), researchGroup.getResearchGroupId());
            User adminUser = UserTestData.saveAdmin(userRepository);

            api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .postAndRead(API_BASE_PATH + "/members", dto, Void.class, 204);

            User updatedUser = userRepository.findById(userToAdd.getUserId()).orElseThrow();
            assertThat(userResearchGroupRoleRepository.findByUserAndResearchGroup(updatedUser, researchGroup)).isPresent();
        }

        @Test
        void shouldCreateUserWhenAddMembersToResearchGroupWithNonExistentUser() {
            UUID randomId = UUID.randomUUID();
            KeycloakUserDTO kcUser = UserTestData.newKeycloakUser(randomId, null, "New", "User", "new.user@tum.de", "ab12abc");
            AddMembersToResearchGroupDTO dto = new AddMembersToResearchGroupDTO(List.of(kcUser), researchGroup.getResearchGroupId());

            api
                .with(JwtPostProcessors.jwtUser(researchGroupUser.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead(API_BASE_PATH + "/members", dto, Void.class, 204);

            User created = userRepository.findById(randomId).orElseThrow();
            assertThat(userResearchGroupRoleRepository.findByUserAndResearchGroup(created, researchGroup)).isPresent();
            assertThat(created.getEmail()).isEqualTo("new.user@tum.de");
        }

        @Test
        void shouldThrowAccessDeniedWhenAddMembersToResearchGroupWithNonExistentGroup() {
            User userToAdd = UserTestData.createUserWithoutResearchGroup(userRepository, "add.fail@tum.de", "Add", "Fail", "fail123");
            KeycloakUserDTO kcUser = UserTestData.kcUserFrom(userToAdd);
            UUID nonExistentGroupId = UUID.randomUUID();
            AddMembersToResearchGroupDTO dto = new AddMembersToResearchGroupDTO(List.of(kcUser), nonExistentGroupId);

            // The authorization check now runs before the entity lookup, so a non-existent
            // group ID results in 403 (user is not a member) rather than 404.
            api
                .with(JwtPostProcessors.jwtUser(researchGroupUser.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead(API_BASE_PATH + "/members", dto, Void.class, 403);

            // Verify the user was not modified by the rejected request
            User unchangedUser = userRepository.findById(userToAdd.getUserId()).orElseThrow();
            assertThat(userResearchGroupRoleRepository.findAllByUser(unchangedUser)).isEmpty();
            assertThat(unchangedUser.getEmail()).isEqualTo("add.fail@tum.de");
        }

        @Test
        void shouldAddMultipleMembersToResearchGroupAsAdmin() {
            User userA = UserTestData.createUserWithoutResearchGroup(userRepository, "multi1@tum.de", "Multi", "One", "multi01");
            User userB = UserTestData.createUserWithoutResearchGroup(userRepository, "multi2@tum.de", "Multi", "Two", "multi02");

            KeycloakUserDTO kcA = UserTestData.kcUserFrom(userA);
            KeycloakUserDTO kcB = UserTestData.kcUserFrom(userB);
            AddMembersToResearchGroupDTO dto = new AddMembersToResearchGroupDTO(List.of(kcA, kcB), researchGroup.getResearchGroupId());

            User adminUser = UserTestData.saveAdmin(userRepository);
            api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .postAndRead(API_BASE_PATH + "/members", dto, Void.class, 204);

            User ua = userRepository.findById(userA.getUserId()).orElseThrow();
            User ub = userRepository.findById(userB.getUserId()).orElseThrow();
            assertThat(userResearchGroupRoleRepository.findByUserAndResearchGroup(ua, researchGroup)).isPresent();
            assertThat(userResearchGroupRoleRepository.findByUserAndResearchGroup(ub, researchGroup)).isPresent();
        }
    }
}
