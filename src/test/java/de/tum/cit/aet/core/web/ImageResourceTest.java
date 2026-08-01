package de.tum.cit.aet.core.web;

import static org.assertj.core.api.Assertions.assertThat;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.core.constants.ImageType;
import de.tum.cit.aet.core.domain.DepartmentImage;
import de.tum.cit.aet.core.domain.Image;
import de.tum.cit.aet.core.domain.ProfileImage;
import de.tum.cit.aet.core.domain.ResearchGroupImage;
import de.tum.cit.aet.core.dto.ImageDTO;
import de.tum.cit.aet.core.repository.ImageRepository;
import de.tum.cit.aet.usermanagement.domain.Department;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.School;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.domain.UserResearchGroupRole;
import de.tum.cit.aet.usermanagement.repository.DepartmentRepository;
import de.tum.cit.aet.usermanagement.repository.ResearchGroupRepository;
import de.tum.cit.aet.usermanagement.repository.SchoolRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import de.tum.cit.aet.utility.DatabaseCleaner;
import de.tum.cit.aet.utility.MvcTestClient;
import de.tum.cit.aet.utility.security.JwtPostProcessors;
import de.tum.cit.aet.utility.testdata.DepartmentTestData;
import de.tum.cit.aet.utility.testdata.ImageTestData;
import de.tum.cit.aet.utility.testdata.ResearchGroupTestData;
import de.tum.cit.aet.utility.testdata.SchoolTestData;
import de.tum.cit.aet.utility.testdata.UserTestData;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import tools.jackson.core.type.TypeReference;

/**
 * Integration tests for {@link ImageResource}.
 * Tests all REST endpoints for image management including:
 * - Upload operations (job banners and default images)
 * - Retrieval operations (defaults, my uploads, research group images)
 * - Delete operations with access control
 * - Authentication and authorization
 */
public class ImageResourceTest extends AbstractResourceTest {

    private static final String API_BASE_PATH = "/api/images";

    @Autowired
    ImageRepository imageRepository;

    @Autowired
    SchoolRepository schoolRepository;

    @Autowired
    DepartmentRepository departmentRepository;

    @Autowired
    ResearchGroupRepository researchGroupRepository;

    @Autowired
    UserRepository userRepository;

    @Autowired
    DatabaseCleaner databaseCleaner;

    @Autowired
    MvcTestClient api;

    School school;
    Department department;
    ResearchGroup researchGroup;
    ResearchGroup secondResearchGroup;
    User professorUser;
    User secondProfessorUser;
    User adminUser;
    Image testImage;
    Image secondTestImage;

    @BeforeEach
    void setup() {
        databaseCleaner.clean();
        api.withoutPostProcessors(); // Clear any authentication from previous tests

        setupFirstResearchGroup();
        setupSecondResearchGroup();
        setupAdminUser();
        setupTestImages();
    }

    private void setupFirstResearchGroup() {
        school = SchoolTestData.saved(schoolRepository, "School of Computation, Information and Technology", "CIT");
        department = DepartmentTestData.saved(departmentRepository, "Computer Science", school);

        researchGroup = ResearchGroupTestData.savedAll(
            researchGroupRepository,
            department,
            "Prof. Smith",
            "ML Research Group",
            "ML",
            "Munich",
            "Machine Learning research",
            "ml@tum.de",
            "80333",
            "Arcisstr. 21",
            "https://ml.tum.de",
            "ACTIVE"
        );
        professorUser = UserTestData.savedProfessor(userRepository, researchGroup);
    }

    private void setupSecondResearchGroup() {
        secondResearchGroup = ResearchGroupTestData.savedAll(
            researchGroupRepository,
            department,
            "Prof. Doe",
            "AI Research Group",
            "AI",
            "Munich",
            "Artificial Intelligence research",
            "ai@tum.de",
            "80333",
            "Arcisstr. 10",
            "https://ai.tum.de",
            "ACTIVE"
        );
        secondProfessorUser = UserTestData.savedProfessor(userRepository, secondResearchGroup);
    }

    private void setupAdminUser() {
        adminUser = UserTestData.newUserAll(UUID.randomUUID(), "admin@tum.de", "Admin", "User");
        UserResearchGroupRole adminRole = new UserResearchGroupRole();
        adminRole.setUser(adminUser);
        adminRole.setRole(de.tum.cit.aet.usermanagement.constants.UserRole.ADMIN);
        adminRole.setResearchGroup(null); // Admin role doesn't need a research group
        adminUser.getResearchGroupRoles().add(adminRole);
        adminUser = userRepository.save(adminUser);
    }

    private void setupTestImages() {
        testImage = imageRepository.save(ImageTestData.newJobBanner(professorUser, researchGroup));
        secondTestImage = imageRepository.save(ImageTestData.newJobBanner(secondProfessorUser, secondResearchGroup));
    }

    @Nested
    class GetDefaultJobBannersTests {

        @Test
        void getDefaultJobBannersReturnsAllDefaultImagesWhenNoFilterProvided() {
            // Arrange
            Image defaultImage1 = imageRepository.save(ImageTestData.newDefaultJobBanner(adminUser, department));
            Image defaultImage2 = imageRepository.save(ImageTestData.newDefaultJobBanner(adminUser, department));

            // Act
            List<ImageDTO> result = api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(API_BASE_PATH + "/defaults/job-banners", Map.of(), new TypeReference<List<ImageDTO>>() {}, 200);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result).hasSize(2);
            assertThat(result).anyMatch(img -> img.imageId().equals(defaultImage1.getImageId()));
            assertThat(result).anyMatch(img -> img.imageId().equals(defaultImage2.getImageId()));
        }

        @Test
        void getDefaultJobBannersFiltersByDepartmentWhenIdProvided() {
            // Arrange - Create new research groups with different departments to test filtering
            ResearchGroup csResearchGroup = createTestResearchGroup("CS", "Computer Science");
            ResearchGroup eeResearchGroup = createTestResearchGroup("EE", "Electrical Engineering");

            Department csDepartment = csResearchGroup.getDepartment();
            Department eeDepartment = eeResearchGroup.getDepartment();

            Image defaultImageCS = createDefaultJobBanner(csDepartment);
            createDefaultJobBanner(eeDepartment);

            // Act - Filter by CS department
            List<ImageDTO> result = api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(
                    API_BASE_PATH + "/defaults/job-banners",
                    Map.of("departmentId", csDepartment.getDepartmentId().toString()),
                    new TypeReference<List<ImageDTO>>() {},
                    200
                );

            // Assert - Should only return default images from the same school (CS)
            assertThat(result).isNotNull();
            assertThat(result).hasSize(1);
            assertThat(result.get(0).imageId()).isEqualTo(defaultImageCS.getImageId());
        }

        @Test
        void getDefaultJobBannersReturnsEmptyListWhenNoDefaultsExist() {
            // Act - No default images have been created in this test
            List<ImageDTO> result = api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(API_BASE_PATH + "/defaults/job-banners", Map.of(), new TypeReference<List<ImageDTO>>() {}, 200);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result).isEmpty();
        }

        @Test
        void getDefaultJobBannersRequiresAuthentication() {
            // Act & Assert
            api.getAndRead(API_BASE_PATH + "/defaults/job-banners", Map.of(), Void.class, 401);
        }
    }

    @Nested
    class GetMyUploadedImagesTests {

        @Test
        void getMyUploadedImagesReturnsOnlyCurrentUserImages() {
            // Arrange - Add profile picture for professor
            Image profileImage = imageRepository.save(ImageTestData.newProfilePicture(professorUser));

            // Act
            List<ImageDTO> result = api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(API_BASE_PATH + "/my-uploads", Map.of(), new TypeReference<List<ImageDTO>>() {}, 200);

            // Assert
            assertThat(result).isNotNull();
            // Should include job banner and profile picture, but not default images
            assertThat(result).hasSizeGreaterThanOrEqualTo(2);
            assertThat(result).anyMatch(img -> img.imageId().equals(testImage.getImageId()));
            assertThat(result).anyMatch(img -> img.imageId().equals(profileImage.getImageId()));
            assertThat(result).noneMatch(img -> img.imageId().equals(secondTestImage.getImageId()));
        }

        @Test
        void getMyUploadedImagesDoesNotIncludeDefaultImages() {
            // Arrange
            Image defaultImage = imageRepository.save(ImageTestData.newDefaultJobBanner(professorUser, department));

            // Act
            List<ImageDTO> result = api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(API_BASE_PATH + "/my-uploads", Map.of(), new TypeReference<List<ImageDTO>>() {}, 200);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result).noneMatch(img -> img.imageId().equals(defaultImage.getImageId()));
            assertThat(result).noneMatch(img -> img.imageType() == ImageType.DEFAULT_JOB_BANNER);
        }

        @Test
        void getMyUploadedImagesRequiresAuthentication() {
            // Act & Assert
            api.getAndRead(API_BASE_PATH + "/my-uploads", Map.of(), Void.class, 401);
        }

        @Test
        void getMyUploadedImagesReturnsEmptyListWhenUserHasNoUploads() {
            // Arrange - Create a new user with no uploads
            User newUser = UserTestData.newUserAll(UUID.randomUUID(), "newuser@tum.de", "New", "User");
            newUser = userRepository.save(newUser);

            // Act
            List<ImageDTO> result = api
                .with(JwtPostProcessors.jwtUser(newUser.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(API_BASE_PATH + "/my-uploads", Map.of(), new TypeReference<List<ImageDTO>>() {}, 200);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result).isEmpty();
        }
    }

    @Nested
    class GetResearchGroupJobBannersTests {

        @Test
        void getResearchGroupJobBannersReturnsOnlyGroupImages() {
            // Act
            List<ImageDTO> result = api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(API_BASE_PATH + "/research-group/job-banners", Map.of(), new TypeReference<List<ImageDTO>>() {}, 200);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result).hasSize(1);
            assertThat(result.get(0).imageId()).isEqualTo(testImage.getImageId());
            assertThat(result.get(0).researchGroupId()).isEqualTo(researchGroup.getResearchGroupId());
        }

        @Test
        void getResearchGroupJobBannersDoesNotIncludeOtherGroupsImages() {
            // Act
            List<ImageDTO> result = api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(API_BASE_PATH + "/research-group/job-banners", Map.of(), new TypeReference<List<ImageDTO>>() {}, 200);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result).noneMatch(img -> img.imageId().equals(secondTestImage.getImageId()));
        }

        @Test
        void getResearchGroupJobBannersRequiresAuthentication() {
            // Act & Assert
            api.getAndRead(API_BASE_PATH + "/research-group/job-banners", Map.of(), Void.class, 401);
        }

        @Test
        void getResearchGroupJobBannersReturnsEmptyListWhenNoBannersExist() {
            // Arrange - Create a new research group with no job banners
            ResearchGroup newGroup = createTestResearchGroup("NEW", "New Department");
            User newProfessor = UserTestData.savedProfessor(userRepository, newGroup);

            // Act
            List<ImageDTO> result = api
                .with(JwtPostProcessors.jwtUser(newProfessor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(API_BASE_PATH + "/research-group/job-banners", Map.of(), new TypeReference<List<ImageDTO>>() {}, 200);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result).isEmpty();
        }
    }

    @Nested
    class GetResearchGroupJobBannersByResearchGroupTests {

        @Test
        void getResearchGroupJobBannersByResearchGroupReturnsImagesForRequestedGroup() {
            // Act
            List<ImageDTO> result = api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .getAndRead(
                    API_BASE_PATH + "/research-group/job-banners/by-research-group",
                    Map.of("researchGroupId", secondResearchGroup.getResearchGroupId().toString()),
                    new TypeReference<List<ImageDTO>>() {},
                    200
                );

            // Assert
            assertThat(result).isNotNull();
            assertThat(result).hasSize(1);
            assertThat(result.get(0).imageId()).isEqualTo(secondTestImage.getImageId());
            assertThat(result.get(0).researchGroupId()).isEqualTo(secondResearchGroup.getResearchGroupId());
        }

        @Test
        void getResearchGroupJobBannersByResearchGroupRequiresAdminRole() {
            api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(
                    API_BASE_PATH + "/research-group/job-banners/by-research-group",
                    Map.of("researchGroupId", researchGroup.getResearchGroupId().toString()),
                    Void.class,
                    403
                );
        }

        @Test
        void getResearchGroupJobBannersByResearchGroupReturns404ForUnknownGroup() {
            api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .getAndRead(
                    API_BASE_PATH + "/research-group/job-banners/by-research-group",
                    Map.of("researchGroupId", UUID.randomUUID().toString()),
                    Void.class,
                    404
                );
        }

        @Test
        void getResearchGroupJobBannersByResearchGroupRequiresAuthentication() {
            api.getAndRead(
                API_BASE_PATH + "/research-group/job-banners/by-research-group",
                Map.of("researchGroupId", researchGroup.getResearchGroupId().toString()),
                Void.class,
                401
            );
        }
    }

    @Nested
    class UploadJobBannerTests {

        @Test
        void uploadJobBannerSuccessfullyUploadsValidImage() throws Exception {
            // Arrange
            MockMultipartFile validImageFile = createValidImageFile("test-banner.jpg");

            // Act
            ImageDTO result = api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .multipartPostAndRead(API_BASE_PATH + "/upload/job-banner", List.of(validImageFile), new TypeReference<ImageDTO>() {}, 201);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.imageId()).isNotNull();
            assertThat(result.imageType()).isEqualTo(ImageType.JOB_BANNER);
            assertThat(result.uploadedById()).isEqualTo(professorUser.getUserId());
            assertThat(result.researchGroupId()).isEqualTo(researchGroup.getResearchGroupId());

            // Verify image was saved to database
            Image savedImage = imageRepository.findById(result.imageId()).orElse(null);
            assertThat(savedImage).isNotNull();
            assertThat(savedImage).isInstanceOf(ResearchGroupImage.class);
        }

        @ParameterizedTest(name = "should reject invalid file: {0}")
        @CsvSource(
            {
                "non-image mime type, test.gif,       image/gif,  fake image content",
                "empty file,          empty.jpg,      image/jpeg, ''",
                "corrupted content,   corrupted.jpg,  image/jpeg, This is not a valid image file content",
                "missing filename,    '',             image/jpeg, fake content",
            }
        )
        void shouldRejectInvalidJobBannerFile(String description, String filename, String mimeType, String content) {
            MockMultipartFile invalidFile = new MockMultipartFile("file", filename, mimeType, content.getBytes());
            api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .multipartPostAndRead(API_BASE_PATH + "/upload/job-banner", List.of(invalidFile), new TypeReference<ImageDTO>() {}, 400);
        }

        @Test
        void uploadJobBannerRequiresAuthentication() throws Exception {
            // Arrange
            MockMultipartFile validImageFile = createValidImageFile("test.jpg");

            // Act & Assert
            api.multipartPostAndRead(API_BASE_PATH + "/upload/job-banner", List.of(validImageFile), new TypeReference<ImageDTO>() {}, 401);
        }

        @Test
        void uploadJobBannerRejectsFileThatExceedsMaxSize() throws Exception {
            // Arrange - Create a file larger than 5MB (default max size)
            byte[] largeContent = new byte[6 * 1024 * 1024]; // 6MB
            MockMultipartFile largeFile = new MockMultipartFile("file", "large.jpg", "image/jpeg", largeContent);

            // Act & Assert
            api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .multipartPostAndRead(API_BASE_PATH + "/upload/job-banner", List.of(largeFile), new TypeReference<ImageDTO>() {}, 400);
        }

        @Test
        void uploadJobBannerRejectsImageWithExcessiveDimensions() throws Exception {
            // Arrange - Create an image that exceeds max dimensions (4096x4096 default)
            // Create a 5000x5000 image
            BufferedImage largeImage = new BufferedImage(5000, 5000, BufferedImage.TYPE_INT_RGB);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(largeImage, "jpg", baos);
            MockMultipartFile largeImageFile = new MockMultipartFile("file", "huge.jpg", "image/jpeg", baos.toByteArray());

            // Act & Assert
            api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .multipartPostAndRead(API_BASE_PATH + "/upload/job-banner", List.of(largeImageFile), new TypeReference<ImageDTO>() {}, 400);
        }

        @Test
        void uploadJobBannerSuccessfullyUploadsPngImage() throws Exception {
            // Arrange - Create a valid PNG image
            BufferedImage image = new BufferedImage(100, 100, BufferedImage.TYPE_INT_RGB);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(image, "png", baos);
            MockMultipartFile pngFile = new MockMultipartFile("file", "test.png", "image/png", baos.toByteArray());

            // Act
            ImageDTO result = api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .multipartPostAndRead(API_BASE_PATH + "/upload/job-banner", List.of(pngFile), new TypeReference<ImageDTO>() {}, 201);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.imageId()).isNotNull();
            assertThat(result.imageType()).isEqualTo(ImageType.JOB_BANNER);
        }

        @Test
        void uploadJobBannerSuccessfullyUploadsFileWithoutExtension() throws Exception {
            // Arrange - Create a valid image without file extension (fallback to mime type)
            BufferedImage image = new BufferedImage(100, 100, BufferedImage.TYPE_INT_RGB);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(image, "jpg", baos);
            MockMultipartFile fileWithoutExt = new MockMultipartFile("file", "testfile", "image/jpeg", baos.toByteArray());

            // Act
            ImageDTO result = api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .multipartPostAndRead(API_BASE_PATH + "/upload/job-banner", List.of(fileWithoutExt), new TypeReference<ImageDTO>() {}, 201);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.imageId()).isNotNull();
            assertThat(result.url()).endsWith(".jpg"); // Should default to .jpg based on mime type
        }

        @Test
        void uploadJobBannerSuccessfullyUploadsPngFileWithoutExtension() throws Exception {
            // Arrange - PNG without extension (tests PNG branch in getExtension fallback)
            BufferedImage image = new BufferedImage(100, 100, BufferedImage.TYPE_INT_RGB);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(image, "png", baos);
            MockMultipartFile pngWithoutExt = new MockMultipartFile("file", "testfile", "image/png", baos.toByteArray());

            // Act
            ImageDTO result = api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .multipartPostAndRead(API_BASE_PATH + "/upload/job-banner", List.of(pngWithoutExt), new TypeReference<ImageDTO>() {}, 201);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.imageId()).isNotNull();
            assertThat(result.url()).endsWith(".png"); // Should default to .png based on mime type
        }
    }

    @Nested
    class UploadJobBannerForResearchGroupTests {

        @Test
        void uploadJobBannerForResearchGroupSuccessfullyUploadsAsAdmin() throws Exception {
            // Arrange
            MockMultipartFile validImageFile = createValidImageFile("admin-job-banner.jpg");
            String url = API_BASE_PATH + "/upload/job-banner/by-research-group?researchGroupId=" + secondResearchGroup.getResearchGroupId();

            // Act
            ImageDTO result = api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .multipartPostAndRead(url, List.of(validImageFile), new TypeReference<ImageDTO>() {}, 201);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.imageId()).isNotNull();
            assertThat(result.imageType()).isEqualTo(ImageType.JOB_BANNER);
            assertThat(result.uploadedById()).isEqualTo(adminUser.getUserId());
            assertThat(result.researchGroupId()).isEqualTo(secondResearchGroup.getResearchGroupId());
        }

        @Test
        void uploadJobBannerForResearchGroupRequiresAdminRole() throws Exception {
            MockMultipartFile validImageFile = createValidImageFile("admin-job-banner.jpg");
            String url = API_BASE_PATH + "/upload/job-banner/by-research-group?researchGroupId=" + secondResearchGroup.getResearchGroupId();

            api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .multipartPostAndRead(url, List.of(validImageFile), new TypeReference<ImageDTO>() {}, 403);
        }

        @Test
        void uploadJobBannerForResearchGroupReturns404ForUnknownGroup() throws Exception {
            MockMultipartFile validImageFile = createValidImageFile("admin-job-banner.jpg");
            String url = API_BASE_PATH + "/upload/job-banner/by-research-group?researchGroupId=" + UUID.randomUUID();

            api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .multipartPostAndRead(url, List.of(validImageFile), new TypeReference<ImageDTO>() {}, 404);
        }

        @Test
        void uploadJobBannerForResearchGroupRequiresAuthentication() throws Exception {
            MockMultipartFile validImageFile = createValidImageFile("admin-job-banner.jpg");
            String url = API_BASE_PATH + "/upload/job-banner/by-research-group?researchGroupId=" + secondResearchGroup.getResearchGroupId();

            api.multipartPostAndRead(url, List.of(validImageFile), new TypeReference<ImageDTO>() {}, 401);
        }
    }

    @Nested
    class UploadProfilePictureTests {

        @Test
        void uploadProfilePictureSuccessfullyUploadsValidImageAndUpdatesAvatar() throws Exception {
            MockMultipartFile validImageFile = createValidImageFile("profile-picture.jpg");

            ImageDTO result = api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .multipartPostAndRead(
                    API_BASE_PATH + "/upload/profile-picture",
                    List.of(validImageFile),
                    new TypeReference<ImageDTO>() {},
                    201
                );

            assertThat(result).isNotNull();
            assertThat(result.imageId()).isNotNull();
            assertThat(result.imageType()).isEqualTo(ImageType.PROFILE_PICTURE);
            assertThat(result.uploadedById()).isEqualTo(professorUser.getUserId());

            Image savedImage = imageRepository.findById(result.imageId()).orElse(null);
            assertThat(savedImage).isInstanceOf(ProfileImage.class);

            User reloadedUser = userRepository.findById(professorUser.getUserId()).orElseThrow();
            assertThat(reloadedUser.getAvatar()).isEqualTo(result.url());
        }

        @Test
        void uploadProfilePictureReplacesExistingProfilePictureAndUpdatesAvatar() throws Exception {
            ProfileImage existingImage = imageRepository.save(ImageTestData.newProfilePicture(professorUser));
            professorUser.setAvatar(existingImage.getUrl());
            userRepository.saveAndFlush(professorUser);

            MockMultipartFile replacementImageFile = createValidImageFile("profile-picture-replacement.jpg");

            ImageDTO result = api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .multipartPostAndRead(
                    API_BASE_PATH + "/upload/profile-picture",
                    List.of(replacementImageFile),
                    new TypeReference<ImageDTO>() {},
                    201
                );

            assertThat(imageRepository.findById(existingImage.getImageId())).isEmpty();

            User reloadedUser = userRepository.findById(professorUser.getUserId()).orElseThrow();
            assertThat(reloadedUser.getAvatar()).isEqualTo(result.url());

            List<Image> uploadedImages = imageRepository.findByUploaderId(professorUser.getUserId());
            assertThat(uploadedImages.stream().filter(ProfileImage.class::isInstance)).hasSize(1);
        }

        @Test
        void uploadProfilePictureRequiresAuthentication() throws Exception {
            MockMultipartFile validImageFile = createValidImageFile("profile-picture.jpg");

            api.multipartPostAndRead(
                API_BASE_PATH + "/upload/profile-picture",
                List.of(validImageFile),
                new TypeReference<ImageDTO>() {},
                401
            );
        }
    }

    @Nested
    class UploadDefaultJobBannerTests {

        @Test
        void uploadDefaultJobBannerSuccessfullyUploadsAsAdmin() throws Exception {
            // Arrange
            MockMultipartFile validImageFile = createValidImageFile("default-banner.jpg");
            String url = API_BASE_PATH + "/upload/default-job-banner?departmentId=" + department.getDepartmentId();

            // Act
            ImageDTO result = api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .multipartPostAndRead(url, List.of(validImageFile), new TypeReference<ImageDTO>() {}, 201);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.imageId()).isNotNull();
            assertThat(result.imageType()).isEqualTo(ImageType.DEFAULT_JOB_BANNER);
            assertThat(result.uploadedById()).isEqualTo(adminUser.getUserId());
            assertThat(result.departmentId()).isEqualTo(department.getDepartmentId());

            // Verify image was saved to database
            Image savedImage = imageRepository.findById(result.imageId()).orElse(null);
            assertThat(savedImage).isNotNull();
            assertThat(savedImage).isInstanceOf(DepartmentImage.class);
        }

        @Test
        void uploadDefaultJobBannerRequiresAdminRole() throws Exception {
            // Arrange
            MockMultipartFile validImageFile = createValidImageFile("default-banner.jpg");
            String url = API_BASE_PATH + "/upload/default-job-banner?departmentId=" + department.getDepartmentId();

            // Act & Assert - Professor trying to upload default image
            api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .multipartPostAndRead(url, List.of(validImageFile), new TypeReference<ImageDTO>() {}, 403);
        }

        @Test
        void uploadDefaultJobBannerRequiresValidDepartmentId() throws Exception {
            // Arrange
            MockMultipartFile validImageFile = createValidImageFile("default-banner.jpg");
            UUID nonExistentId = UUID.randomUUID();

            // Create a multipart file with the departmentId as a separate part
            MockMultipartFile validImageFile2 = new MockMultipartFile(
                "file",
                "default-banner.jpg",
                "image/jpeg",
                validImageFile.getBytes()
            );

            String url = API_BASE_PATH + "/upload/default-job-banner?departmentId=" + nonExistentId;

            // Act & Assert - Admin user should get 404 when research group doesn't exist
            api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .multipartPostAndRead(url, List.of(validImageFile2), new TypeReference<ImageDTO>() {}, 404);
        }

        @Test
        void uploadDefaultJobBannerRejectsInvalidFile() throws Exception {
            // Arrange - Create a non-image file
            MockMultipartFile invalidFile = new MockMultipartFile("file", "test.gif", "image/gif", "fake content".getBytes());
            String url = API_BASE_PATH + "/upload/default-job-banner?researchGroupId=" + researchGroup.getResearchGroupId();

            // Act & Assert
            api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .multipartPostAndRead(url, List.of(invalidFile), new TypeReference<ImageDTO>() {}, 400);
        }

        @Test
        void uploadDefaultJobBannerRequiresAuthentication() throws Exception {
            // Arrange
            MockMultipartFile validImageFile = createValidImageFile("default-banner.jpg");
            String url = API_BASE_PATH + "/upload/default-job-banner?researchGroupId=" + researchGroup.getResearchGroupId();

            // Act & Assert
            api.multipartPostAndRead(url, List.of(validImageFile), new TypeReference<ImageDTO>() {}, 401);
        }
    }

    @Nested
    class DeleteImageTests {

        @Test
        void deleteImageSuccessfullyDeletesOwnImage() {
            // Act
            api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .deleteAndRead(API_BASE_PATH + "/" + testImage.getImageId(), null, Void.class, 204);

            // Assert - Verify image was deleted from database
            assertThat(imageRepository.findById(testImage.getImageId())).isEmpty();
        }

        @Test
        void deleteImageAllowsProfessorToDeleteJobBannerFromTheirResearchGroup() {
            // Arrange - Create another user in the same research group
            User anotherProfessor = UserTestData.newUserAll(UUID.randomUUID(), "another@tum.de", "Another", "Professor");
            anotherProfessor = userRepository.save(anotherProfessor);

            Image jobBannerFromOther = imageRepository.save(ImageTestData.newJobBanner(anotherProfessor, researchGroup));

            // Act - Original professor deletes image uploaded by another professor in same group
            api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .deleteAndRead(API_BASE_PATH + "/" + jobBannerFromOther.getImageId(), null, Void.class, 204);

            // Assert
            assertThat(imageRepository.findById(jobBannerFromOther.getImageId())).isEmpty();
        }

        @Test
        void deleteImagePreventsNonAdminFromDeletingDefaultImage() {
            // Arrange
            Image defaultImage = imageRepository.save(ImageTestData.newDefaultJobBanner(adminUser, department));

            // Act & Assert
            api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .deleteAndRead(API_BASE_PATH + "/" + defaultImage.getImageId(), null, Void.class, 403);

            // Verify image was not deleted
            assertThat(imageRepository.findById(defaultImage.getImageId())).isPresent();
        }

        @Test
        void deleteImageAllowsAdminToDeleteAnyImage() {
            // Arrange
            Image defaultImage = imageRepository.save(ImageTestData.newDefaultJobBanner(adminUser, department));

            // Act
            api
                .with(JwtPostProcessors.jwtUser(adminUser.getUserId(), "ROLE_ADMIN"))
                .deleteAndRead(API_BASE_PATH + "/" + defaultImage.getImageId(), null, Void.class, 204);

            // Assert
            assertThat(imageRepository.findById(defaultImage.getImageId())).isEmpty();
        }

        @Test
        void deleteImagePreventsUserFromDeletingOthersProfilePicture() {
            // Arrange
            Image otherUserImage = imageRepository.save(ImageTestData.newProfilePicture(secondProfessorUser));

            // Act & Assert
            api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .deleteAndRead(API_BASE_PATH + "/" + otherUserImage.getImageId(), null, Void.class, 403);

            // Verify image was not deleted
            assertThat(imageRepository.findById(otherUserImage.getImageId())).isPresent();
        }

        @Test
        void deleteImagePreventsUserFromDeletingJobBannerFromDifferentResearchGroup() {
            // Act & Assert - Professor from first group tries to delete image from second group
            api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .deleteAndRead(API_BASE_PATH + "/" + secondTestImage.getImageId(), null, Void.class, 403);

            // Verify image was not deleted
            assertThat(imageRepository.findById(secondTestImage.getImageId())).isPresent();
        }

        @Test
        void deleteImageReturns404WhenImageNotFound() {
            // Arrange
            UUID nonExistentId = UUID.randomUUID();

            // Act & Assert
            api
                .with(JwtPostProcessors.jwtUser(professorUser.getUserId(), "ROLE_PROFESSOR"))
                .deleteAndRead(API_BASE_PATH + "/" + nonExistentId, null, Void.class, 404);
        }

        @Test
        void deleteImageRequiresAuthentication() {
            // Act & Assert
            api.deleteAndRead(API_BASE_PATH + "/" + testImage.getImageId(), null, Void.class, 401);
        }

        @Test
        void deleteImagePreventsUserWithoutResearchGroupFromDeletingJobBanner() {
            // Arrange - Create a user without a research group
            User userWithoutGroup = UserTestData.newUserAll(UUID.randomUUID(), "nogroup@tum.de", "No", "Group");
            userWithoutGroup = userRepository.save(userWithoutGroup);

            // Act & Assert - User without research group tries to delete a job banner
            api
                .with(JwtPostProcessors.jwtUser(userWithoutGroup.getUserId(), "ROLE_PROFESSOR"))
                .deleteAndRead(API_BASE_PATH + "/" + testImage.getImageId(), null, Void.class, 403);

            // Verify image was not deleted
            assertThat(imageRepository.findById(testImage.getImageId())).isPresent();
        }
    }

    // --- Helper methods ---

    /**
     * Creates a valid test image file as a MockMultipartFile
     */
    private MockMultipartFile createValidImageFile(String filename) throws Exception {
        // Create a simple 100x100 image
        BufferedImage image = new BufferedImage(100, 100, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(image, "jpg", baos);
        byte[] imageBytes = baos.toByteArray();

        return new MockMultipartFile("file", filename, "image/jpeg", imageBytes);
    }

    private ResearchGroup createTestResearchGroup(String abbreviation, String departmentName) {
        // Create a school if we're creating a new department
        School testSchool = SchoolTestData.saved(schoolRepository, "School for " + abbreviation, abbreviation);
        Department testDepartment = DepartmentTestData.saved(departmentRepository, departmentName, testSchool);

        return ResearchGroupTestData.savedAll(
            researchGroupRepository,
            testDepartment,
            "Prof. " + abbreviation,
            abbreviation + " Research Group",
            abbreviation,
            "Munich",
            abbreviation + " research",
            abbreviation.toLowerCase() + "@tum.de",
            "80333",
            abbreviation + " Street 1",
            "https://" + abbreviation.toLowerCase() + ".tum.de",
            "ACTIVE"
        );
    }

    private Image createDefaultJobBanner(Department department) {
        return imageRepository.save(ImageTestData.newDefaultJobBanner(adminUser, department));
    }
}
