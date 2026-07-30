package de.tum.cit.aet.usermanagement.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.usermanagement.constants.UserRole;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.domain.UserResearchGroupRole;
import de.tum.cit.aet.usermanagement.dto.AdminUserOverviewDTO;
import de.tum.cit.aet.usermanagement.dto.CreateUserDTO;
import de.tum.cit.aet.usermanagement.dto.ImportUserDTO;
import de.tum.cit.aet.usermanagement.dto.KeycloakUserDTO;
import de.tum.cit.aet.usermanagement.dto.UpdateUserDTO;
import de.tum.cit.aet.usermanagement.repository.ResearchGroupRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import de.tum.cit.aet.usermanagement.repository.UserResearchGroupRoleRepository;
import de.tum.cit.aet.usermanagement.service.KeycloakUserService;
import de.tum.cit.aet.usermanagement.service.UserService;
import de.tum.cit.aet.utility.DatabaseCleaner;
import de.tum.cit.aet.utility.MvcTestClient;
import de.tum.cit.aet.utility.PageResponse;
import de.tum.cit.aet.utility.security.JwtPostProcessors;
import de.tum.cit.aet.utility.testdata.ResearchGroupTestData;
import de.tum.cit.aet.utility.testdata.UserTestData;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import tools.jackson.core.type.TypeReference;

/**
 * Integration tests for {@link de.tum.cit.aet.usermanagement.web.UserAdminResource}.
 * Verifies admin success and professor 403 paths plus validation/auth edge cases.
 */
class UserAdminResourceTest extends AbstractResourceTest {

    @Autowired
    UserRepository userRepository;

    @Autowired
    ResearchGroupRepository researchGroupRepository;

    @Autowired
    UserResearchGroupRoleRepository userResearchGroupRoleRepository;

    @Autowired
    UserService userService;

    @Autowired
    KeycloakUserService keycloakUserService;

    @Autowired
    DatabaseCleaner databaseCleaner;

    @Autowired
    MvcTestClient api;

    ResearchGroup researchGroup;
    User adminUser;
    User professor;

    @BeforeEach
    void setup() {
        databaseCleaner.clean();
        reset(userService, keycloakUserService);
        api.withoutPostProcessors();

        researchGroup = ResearchGroupTestData.savedAll(
            researchGroupRepository,
            "Prof. Doe",
            "Algorithms Group",
            "ALG",
            "Munich",
            "We do cool stuff",
            "alg@example.com",
            "80333",
            "CIT",
            "Arcisstr. 21",
            "https://alg.tum.de",
            "ACTIVE"
        );

        adminUser = UserTestData.saveAdmin(userRepository);
        professor = UserTestData.saveProfessor(researchGroup, userRepository);
    }

    @Nested
    class GetAllUsers {

        @Test
        void shouldReturnUsersForAdmin() {
            PageResponse<AdminUserOverviewDTO> page = api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .getAndRead("/api/admin/users", Map.of("pageNumber", "0", "pageSize", "10"), new TypeReference<>() {}, 200);

            assertThat(page.content()).isNotNull();
            assertThat(page.totalElements()).isGreaterThanOrEqualTo(1);
        }

        @Test
        void shouldRejectProfessor() {
            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead("/api/admin/users", Map.of("pageNumber", "0", "pageSize", "10"), new TypeReference<>() {}, 403);
        }
    }

    @Nested
    class GetUserById {

        @Test
        void shouldReturn404ForUnknownUser() {
            api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .getAndRead("/api/admin/users/" + UUID.randomUUID(), null, Void.class, 404);
        }
    }

    @Nested
    class DeleteUser {

        @Test
        void shouldRejectSelfDelete() {
            api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .deleteAndRead("/api/admin/users/" + adminUser.getUserId(), null, Void.class, 400);
        }

        @Test
        void shouldRejectProfessor() {
            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .deleteAndRead("/api/admin/users/" + UUID.randomUUID(), null, Void.class, 403);
        }
    }

    @Nested
    class CreateUser {

        @Test
        void shouldRejectInvalidPayload() {
            // Empty body — required @NotBlank fields (firstName, lastName, email, password) are missing.
            Map<String, Object> emptyPayload = new HashMap<>();
            api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .postAndRead("/api/admin/users", emptyPayload, Void.class, 400);
        }

        @Test
        void shouldRejectProfessor() {
            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/admin/users", createPayload(), Void.class, 403);
        }

        @Test
        void shouldCreateInternalUserWithLocalPasswordAndNotTouchKeycloak() {
            User created = UserTestData.savedUser(userRepository);
            doReturn(Optional.empty()).when(userService).findByEmail("new.user@tum.de");
            doReturn(created).when(userService).provisionExternalUser("new.user@tum.de", "New", "User");
            doReturn(true).when(userService).setLocalPassword(created.getUserId().toString(), "supersecure1");

            api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .postAndRead("/api/admin/users", createPayload(), Void.class, 201);

            verify(userService).provisionExternalUser("new.user@tum.de", "New", "User");
            verify(userService).setLocalPassword(created.getUserId().toString(), "supersecure1");
            verifyNoInteractions(keycloakUserService);
        }

        @Test
        void shouldRejectWhenEmailAlreadyBelongsToAnExistingAccount() {
            doReturn(Optional.of(professor)).when(userService).findByEmail("new.user@tum.de");

            api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .postAndRead("/api/admin/users", createPayload(), Void.class, 400);

            verify(userService, never()).provisionExternalUser(anyString(), anyString(), anyString());
            verify(userService, never()).setLocalPassword(anyString(), anyString());
        }

        @Test
        void shouldRejectWhenPasswordCannotBeSetForATumMember() {
            User created = UserTestData.savedUser(userRepository);
            doReturn(Optional.empty()).when(userService).findByEmail("new.user@tum.de");
            doReturn(created).when(userService).provisionExternalUser("new.user@tum.de", "New", "User");
            // A TUM member is refused a local password by UserService.
            doReturn(false).when(userService).setLocalPassword(created.getUserId().toString(), "supersecure1");

            api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .postAndRead("/api/admin/users", createPayload(), Void.class, 400);
        }

        private CreateUserDTO createPayload() {
            return new CreateUserDTO(
                "New",
                "User",
                "new.user@tum.de",
                "supersecure1",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
            );
        }
    }

    @Nested
    class ImportUser {

        @Test
        void shouldImportTumMemberResolvedByUniversityId() {
            User imported = UserTestData.savedUser(userRepository);
            KeycloakUserDTO kcUser = new KeycloakUserDTO(imported.getUserId(), "kc.user", "Key", "Cloak", "key.cloak@tum.de", "ab12cde");
            when(keycloakUserService.findUserByUniversityId("ab12cde")).thenReturn(Optional.of(kcUser));
            doReturn(imported).when(userService).upsertUser(imported.getUserId().toString(), "key.cloak@tum.de", "Key", "Cloak");

            api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .postAndRead("/api/admin/users/import", new ImportUserDTO("ab12cde"), Void.class, 201);

            verify(keycloakUserService).findUserByUniversityId("ab12cde");
            assertThat(userRepository.findById(imported.getUserId()).orElseThrow().getUniversityId()).isEqualTo("ab12cde");
        }

        @Test
        void shouldReturn404WhenUniversityIdIsUnknownInKeycloak() {
            when(keycloakUserService.findUserByUniversityId("zz99zzz")).thenReturn(Optional.empty());

            api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .postAndRead("/api/admin/users/import", new ImportUserDTO("zz99zzz"), Void.class, 404);
        }

        @Test
        void shouldRejectBlankUniversityId() {
            api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                // Sent as a map on purpose: ImportUserDTO is @JsonInclude(NON_EMPTY), so an empty string
                // would serialise to {} and this would stop covering a blank value.
                .postAndRead("/api/admin/users/import", Map.of("universityId", ""), Void.class, 400);
        }

        @Test
        void shouldRejectProfessor() {
            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/admin/users/import", new ImportUserDTO("ab12cde"), Void.class, 403);
        }
    }

    private static UserResearchGroupRole roleOf(User user, ResearchGroup group, UserRole role) {
        UserResearchGroupRole mapping = new UserResearchGroupRole();
        mapping.setUser(user);
        mapping.setResearchGroup(group);
        mapping.setRole(role);
        return mapping;
    }

    @Nested
    class UpdateUser {

        @Test
        void shouldUpdateProfileFieldsWithoutRoleChange() {
            User target = UserTestData.savedUser(userRepository);
            UpdateUserDTO dto = new UpdateUserDTO(
                "Renamed",
                null,
                null,
                "+49 89 0000",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
            );

            api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .putAndRead("/api/admin/users/" + target.getUserId(), dto, Void.class, 200);

            User reloaded = userRepository.findById(target.getUserId()).orElseThrow();
            assertThat(reloaded.getFirstName()).isEqualTo("Renamed");
            assertThat(reloaded.getPhoneNumber()).isEqualTo("+49 89 0000");
            verify(userService, never()).setPrimaryRole(target.getUserId(), null, null);
        }

        @Test
        void shouldDelegateRoleAssignmentToUserService() {
            User target = UserTestData.savedUser(userRepository);
            UpdateUserDTO dto = roleUpdate(UserRole.PROFESSOR, researchGroup.getResearchGroupId());

            api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .putAndRead("/api/admin/users/" + target.getUserId(), dto, Void.class, 200);

            verify(userService).setPrimaryRole(target.getUserId(), UserRole.PROFESSOR, researchGroup.getResearchGroupId());
        }

        @Test
        void shouldKeepMembershipOfOtherResearchGroupsWhenChangingARole() {
            ResearchGroup otherGroup = ResearchGroupTestData.saved(researchGroupRepository);
            User target = UserTestData.savedProfessor(userRepository, researchGroup);
            userResearchGroupRoleRepository.save(roleOf(target, otherGroup, UserRole.EMPLOYEE));
            UpdateUserDTO dto = roleUpdate(UserRole.EMPLOYEE, researchGroup.getResearchGroupId());

            api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .putAndRead("/api/admin/users/" + target.getUserId(), dto, Void.class, 200);

            assertThat(userResearchGroupRoleRepository.findAllByUser(target))
                .extracting(role -> role.getResearchGroup().getResearchGroupId(), UserResearchGroupRole::getRole)
                .containsExactlyInAnyOrder(
                    tuple(researchGroup.getResearchGroupId(), UserRole.EMPLOYEE),
                    tuple(otherGroup.getResearchGroupId(), UserRole.EMPLOYEE)
                );
        }

        @Test
        void shouldClearEveryResearchGroupWhenTheNewRoleBelongsToNone() {
            ResearchGroup otherGroup = ResearchGroupTestData.saved(researchGroupRepository);
            User target = UserTestData.savedProfessor(userRepository, researchGroup);
            userResearchGroupRoleRepository.save(roleOf(target, otherGroup, UserRole.EMPLOYEE));
            UpdateUserDTO dto = roleUpdate(UserRole.APPLICANT, null);

            api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .putAndRead("/api/admin/users/" + target.getUserId(), dto, Void.class, 200);

            assertThat(userResearchGroupRoleRepository.findAllByUser(target))
                .singleElement()
                .satisfies(role -> {
                    assertThat(role.getRole()).isEqualTo(UserRole.APPLICANT);
                    assertThat(role.getResearchGroup()).isNull();
                });
        }

        @Test
        void shouldRejectAdminChangingOwnRole() {
            UpdateUserDTO dto = roleUpdate(UserRole.APPLICANT, null);

            api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .putAndRead("/api/admin/users/" + adminUser.getUserId(), dto, Void.class, 400);

            verify(userService, never()).setPrimaryRole(adminUser.getUserId(), UserRole.APPLICANT, null);
        }

        @Test
        void shouldRejectProfessor() {
            User target = UserTestData.savedUser(userRepository);
            UpdateUserDTO dto = new UpdateUserDTO("Blocked", null, null, null, null, null, null, null, null, null, null, null, null, null);

            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead("/api/admin/users/" + target.getUserId(), dto, Void.class, 403);
        }

        private UpdateUserDTO roleUpdate(UserRole role, UUID researchGroupId) {
            return new UpdateUserDTO(null, null, null, null, null, null, null, null, null, null, null, null, role, researchGroupId);
        }
    }
}
