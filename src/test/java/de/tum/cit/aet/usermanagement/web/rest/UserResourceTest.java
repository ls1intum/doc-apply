package de.tum.cit.aet.usermanagement.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.core.domain.ProfileImage;
import de.tum.cit.aet.core.dto.ApiError;
import de.tum.cit.aet.core.dto.PageResponseDTO;
import de.tum.cit.aet.core.exception.BadRequestException;
import de.tum.cit.aet.core.repository.ImageRepository;
import de.tum.cit.aet.core.service.AuthenticationService;
import de.tum.cit.aet.core.service.ImageService;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.dto.KeycloakUserDTO;
import de.tum.cit.aet.usermanagement.dto.UpdateAvatarDTO;
import de.tum.cit.aet.usermanagement.dto.UpdatePasswordDTO;
import de.tum.cit.aet.usermanagement.dto.UpdateUserNameDTO;
import de.tum.cit.aet.usermanagement.dto.UserShortDTO;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import de.tum.cit.aet.usermanagement.service.KeycloakUserService;
import de.tum.cit.aet.usermanagement.service.KeycloakUserService.PagedResult;
import de.tum.cit.aet.usermanagement.service.UserService;
import de.tum.cit.aet.usermanagement.web.UserResource;
import de.tum.cit.aet.utility.DatabaseCleaner;
import de.tum.cit.aet.utility.MvcTestClient;
import de.tum.cit.aet.utility.security.JwtPostProcessors;
import de.tum.cit.aet.utility.testdata.ImageTestData;
import de.tum.cit.aet.utility.testdata.UserTestData;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.core.type.TypeReference;

/**
 * Integration tests for {@link de.tum.cit.aet.usermanagement.web.UserResource}.
 * Covers all REST endpoints:
 * - GET /api/users/me
 * - PUT /api/users/name
 * - PUT /api/users/password
 */
public class UserResourceTest extends AbstractResourceTest {

    private static final String API_BASE_PATH = "/api/users";

    @Autowired
    DatabaseCleaner databaseCleaner;

    @Autowired
    UserRepository userRepository;

    @Autowired
    ImageRepository imageRepository;

    @Autowired
    MvcTestClient api;

    @Autowired
    AuthenticationService authenticationService;

    @Autowired
    UserService userService;

    @Autowired
    KeycloakUserService keycloakUserService;

    @Autowired
    UserResource userResource;

    ImageService imageService;

    User currentUser;

    @BeforeEach
    void setup() {
        imageService = Mockito.mock(ImageService.class);
        ReflectionTestUtils.setField(userResource, "imageService", imageService);
        databaseCleaner.clean();
        currentUser = UserTestData.createUserWithoutResearchGroup(userRepository, "current.user@tum.de", "Current", "User", "ab12cde");
    }

    @Nested
    class GetCurrentUser {

        @Test
        void returnsUserInfo() {
            when(authenticationService.provisionUserIfMissing(any(Jwt.class))).thenReturn(currentUser);

            UserShortDTO result = api
                .with(JwtPostProcessors.jwtUser(currentUser.getUserId(), "ROLE_APPLICANT"))
                .getAndRead(API_BASE_PATH + "/me", Map.of(), UserShortDTO.class, 200);

            assertThat(result).isNotNull();
            assertThat(result.getUserId()).isEqualTo(currentUser.getUserId());
            assertThat(result.getUniversityId()).isEqualTo(currentUser.getUniversityId());
            assertThat(result.getEmail()).isEqualTo(currentUser.getEmail());
        }

        @Test
        void returnsNoContentWhenUserIsMissing() {
            when(authenticationService.provisionUserIfMissing(any(Jwt.class))).thenReturn(null);

            api
                .with(JwtPostProcessors.jwtUser(currentUser.getUserId(), "ROLE_APPLICANT"))
                .getAndRead(API_BASE_PATH + "/me", Map.of(), Void.class, 204);
        }

        @Test
        void returns401WhenUnauthenticated() {
            api.withoutPostProcessors().getAndRead(API_BASE_PATH + "/me", Map.of(), Void.class, 401);
        }
    }

    @Nested
    class UpdateUserName {

        @Test
        void returnsNoContentWithValidData() {
            UpdateUserNameDTO dto = new UpdateUserNameDTO("NewFirst", "NewLast");

            api
                .with(JwtPostProcessors.jwtUser(currentUser.getUserId(), "ROLE_APPLICANT"))
                .putAndRead(API_BASE_PATH + "/name", dto, Void.class, 204);

            verify(userService).updateNames(currentUser.getUserId().toString(), "NewFirst", "NewLast");
        }

        @Test
        void returns400WithInvalidData() {
            UpdateUserNameDTO invalidDto = new UpdateUserNameDTO(null, null);

            api
                .with(JwtPostProcessors.jwtUser(currentUser.getUserId(), "ROLE_APPLICANT"))
                .putAndRead(API_BASE_PATH + "/name", invalidDto, Void.class, 400);
        }

        @Test
        void returns401WhenUnauthenticated() {
            UpdateUserNameDTO dto = new UpdateUserNameDTO("NewFirst", "NewLast");

            api.withoutPostProcessors().putAndRead(API_BASE_PATH + "/name", dto, Void.class, 401);
        }
    }

    @Nested
    class UpdatePassword {

        @Test
        void returnsNoContentWhenPasswordUpdateSucceeds() {
            String newPassword = "StrongPassword123!";
            when(userService.setLocalPassword(anyString(), eq(newPassword))).thenReturn(true);

            UpdatePasswordDTO dto = new UpdatePasswordDTO(newPassword);

            api
                .with(JwtPostProcessors.jwtUser(currentUser.getUserId(), "ROLE_APPLICANT"))
                .putAndRead(API_BASE_PATH + "/password", dto, Void.class, 204);

            verify(userService).setLocalPassword(eq(currentUser.getUserId().toString()), eq(newPassword));
        }

        @Test
        void returns400WhenPasswordUpdateFails() {
            String newPassword = "AnotherStrongPassword!";
            when(userService.setLocalPassword(anyString(), eq(newPassword))).thenReturn(false);

            UpdatePasswordDTO dto = new UpdatePasswordDTO(newPassword);

            api
                .with(JwtPostProcessors.jwtUser(currentUser.getUserId(), "ROLE_APPLICANT"))
                .putAndRead(API_BASE_PATH + "/password", dto, Void.class, 400);
        }

        @Test
        void returns400ForBlankPassword() {
            UpdatePasswordDTO dto = new UpdatePasswordDTO("");

            api
                .with(JwtPostProcessors.jwtUser(currentUser.getUserId(), "ROLE_APPLICANT"))
                .putAndRead(API_BASE_PATH + "/password", dto, Void.class, 400);
        }

        @Test
        void returns401WhenUnauthenticated() {
            UpdatePasswordDTO dto = new UpdatePasswordDTO("StrongPassword123!");

            api.withoutPostProcessors().putAndRead(API_BASE_PATH + "/password", dto, Void.class, 401);
        }
    }

    @Nested
    class UpdateAvatar {

        @ParameterizedTest(name = "should return no content and delete profile picture for blank avatar url [{0}]")
        @NullSource
        @ValueSource(strings = { "   " })
        void shouldReturnNoContentAndDeleteProfilePictureForBlankAvatarUrl(String avatarUrl) {
            UpdateAvatarDTO dto = new UpdateAvatarDTO(avatarUrl);

            api
                .with(JwtPostProcessors.jwtUser(currentUser.getUserId(), "ROLE_APPLICANT"))
                .putAndRead(API_BASE_PATH + "/avatar", dto, Void.class, 204);

            verify(imageService).deleteCurrentUserProfilePicture();
            verify(userService, Mockito.never()).updateAvatar(anyString(), any());
        }

        @Test
        void returnsNoContentAndUpdatesAvatarWhenAvatarUrlIsPresent() {
            ProfileImage profileImage = imageRepository.save(ImageTestData.newProfilePicture(currentUser));
            UpdateAvatarDTO dto = new UpdateAvatarDTO(profileImage.getUrl());

            api
                .with(JwtPostProcessors.jwtUser(currentUser.getUserId(), "ROLE_APPLICANT"))
                .putAndRead(API_BASE_PATH + "/avatar", dto, Void.class, 204);

            verify(imageService).assertCurrentUserOwnsProfilePictureUrl(dto.avatarUrl());
            verify(userService).updateAvatar(currentUser.getUserId().toString(), dto.avatarUrl());
        }

        @Test
        void returns400WhenAvatarUrlIsExternal() {
            UpdateAvatarDTO dto = new UpdateAvatarDTO("https://example.com/tracker.png");
            Mockito.doThrow(new BadRequestException("Avatar URL must reference an existing profile picture owned by the current user"))
                .when(imageService)
                .assertCurrentUserOwnsProfilePictureUrl(dto.avatarUrl());

            ApiError error = api
                .with(JwtPostProcessors.jwtUser(currentUser.getUserId(), "ROLE_APPLICANT"))
                .putAndRead(API_BASE_PATH + "/avatar", dto, ApiError.class, 400);

            assertThat(error.message()).isEqualTo("Avatar URL must reference an existing profile picture owned by the current user");
            assertThat(userRepository.findById(currentUser.getUserId()).orElseThrow().getAvatar()).isNull();
        }

        @Test
        void returns400WhenAvatarUrlReferencesAnotherUsersProfilePicture() {
            imageRepository.save(ImageTestData.newProfilePicture(currentUser));
            User otherUser = UserTestData.createUserWithoutResearchGroup(userRepository, "other.user@tum.de", "Other", "User", "xy12zzz");
            ProfileImage otherUsersProfileImage = imageRepository.save(ImageTestData.newProfilePicture(otherUser));
            UpdateAvatarDTO dto = new UpdateAvatarDTO(otherUsersProfileImage.getUrl());
            Mockito.doThrow(new BadRequestException("Avatar URL must reference an existing profile picture owned by the current user"))
                .when(imageService)
                .assertCurrentUserOwnsProfilePictureUrl(dto.avatarUrl());

            ApiError error = api
                .with(JwtPostProcessors.jwtUser(currentUser.getUserId(), "ROLE_APPLICANT"))
                .putAndRead(API_BASE_PATH + "/avatar", dto, ApiError.class, 400);

            assertThat(error.message()).isEqualTo("Avatar URL must reference an existing profile picture owned by the current user");
            assertThat(userRepository.findById(currentUser.getUserId()).orElseThrow().getAvatar()).isNull();
        }
    }

    @Nested
    class GetAllProfessors {

        @Test
        void shouldReturnAllProfessorsForAdmin() {
            UserShortDTO firstProfessor = new UserShortDTO();
            firstProfessor.setUserId(UUID.randomUUID());
            firstProfessor.setFirstName("Alice");
            firstProfessor.setLastName("Smith");
            UserShortDTO secondProfessor = new UserShortDTO();
            secondProfessor.setUserId(UUID.randomUUID());
            secondProfessor.setFirstName("Bob");
            secondProfessor.setLastName("Doe");
            when(userService.getAllProfessors()).thenReturn(List.of(firstProfessor, secondProfessor));

            UUID adminUserId = UUID.randomUUID();
            List<UserShortDTO> result = api
                .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
                .getAndRead(API_BASE_PATH + "/professors", Map.of(), new TypeReference<List<UserShortDTO>>() {}, 200);

            assertThat(result).isNotNull();
            assertThat(result).hasSize(2);
            assertThat(result).anyMatch(u -> u.getUserId().equals(firstProfessor.getUserId()));
            assertThat(result).anyMatch(u -> u.getUserId().equals(secondProfessor.getUserId()));
            verify(userService).getAllProfessors();
        }

        @Test
        void shouldRejectNonAdminOnAllProfessors() {
            api
                .with(JwtPostProcessors.jwtUser(currentUser.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(API_BASE_PATH + "/professors", Map.of(), Void.class, 403);
        }
    }

    @Nested
    class GetAvailableUsersForResearchGroup {

        @Test
        void returnsAvailableUsersAndTotalCount() {
            KeycloakUserDTO keycloakUser = new KeycloakUserDTO(
                UUID.randomUUID(),
                "alice.user",
                "Alice",
                "User",
                "alice.user@tum.de",
                "ab12cde"
            );

            UUID targetGroupId = UUID.randomUUID();
            when(keycloakUserService.getAvailableUsersForResearchGroup(eq("alice"), any(), eq(targetGroupId))).thenReturn(
                new PagedResult<>(List.of(keycloakUser), 1L)
            );

            PageResponseDTO<KeycloakUserDTO> result = api
                .with(JwtPostProcessors.jwtUser(currentUser.getUserId(), "ROLE_ADMIN"))
                .getAndRead(
                    API_BASE_PATH + "/available-for-research-group",
                    Map.of("pageNumber", "0", "pageSize", "10", "searchQuery", "alice", "researchGroupId", targetGroupId.toString()),
                    new TypeReference<PageResponseDTO<KeycloakUserDTO>>() {},
                    200
                );

            assertThat(result.getTotalElements()).isEqualTo(1L);
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent()).extracting(KeycloakUserDTO::universityId).containsExactly("ab12cde");
            verify(keycloakUserService, times(1)).getAvailableUsersForResearchGroup(eq("alice"), any(), eq(targetGroupId));
        }

        @Test
        void returnsForbiddenForApplicantRole() {
            api
                .with(JwtPostProcessors.jwtUser(currentUser.getUserId(), "ROLE_APPLICANT"))
                .getAndRead(
                    API_BASE_PATH + "/available-for-research-group",
                    Map.of("pageNumber", "0", "pageSize", "10", "searchQuery", "alice"),
                    Void.class,
                    403
                );
        }
    }
}
