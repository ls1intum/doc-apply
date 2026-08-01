package de.tum.cit.aet.core.service;

import de.tum.cit.aet.core.constants.ImageType;
import de.tum.cit.aet.core.domain.DepartmentImage;
import de.tum.cit.aet.core.domain.Image;
import de.tum.cit.aet.core.domain.ProfileImage;
import de.tum.cit.aet.core.domain.ResearchGroupImage;
import de.tum.cit.aet.core.dto.ImageDTO;
import de.tum.cit.aet.core.exception.AccessDeniedException;
import de.tum.cit.aet.core.exception.BadRequestException;
import de.tum.cit.aet.core.exception.EntityNotFoundException;
import de.tum.cit.aet.core.exception.InternalServerException;
import de.tum.cit.aet.core.exception.NoProfilePictureException;
import de.tum.cit.aet.core.exception.UploadException;
import de.tum.cit.aet.core.repository.ImageRepository;
import de.tum.cit.aet.core.util.StringUtil;
import de.tum.cit.aet.job.repository.JobRepository;
import de.tum.cit.aet.usermanagement.domain.Department;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.repository.DepartmentRepository;
import de.tum.cit.aet.usermanagement.repository.ResearchGroupRepository;
import de.tum.cit.aet.usermanagement.repository.SchoolRepository;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import javax.imageio.ImageIO;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.FilenameUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@Service
public class ImageService {

    private static final List<String> ALLOWED_MIME_TYPES = List.of("image/jpeg", "image/png", "image/jpg");

    private final ImageRepository imageRepository;
    private final JobRepository jobRepository;
    private final DepartmentRepository departmentRepository;
    private final ResearchGroupRepository researchGroupRepository;
    private final SchoolRepository schoolRepository;
    private final CurrentUserService currentUserService;
    private final Path imageRoot;
    private final long maxFileSize;
    private final int maxWidth;
    private final int maxHeight;

    public ImageService(
        ImageRepository imageRepository,
        JobRepository jobRepository,
        DepartmentRepository departmentRepository,
        ResearchGroupRepository researchGroupRepository,
        SchoolRepository schoolRepository,
        CurrentUserService currentUserService,
        @Value("${aet.storage.image-root:/storage/images}") String imageRootDir,
        @Value("${aet.storage.max-image-size-bytes:5242880}") long maxFileSize, // 5MB default
        @Value("${aet.storage.max-image-width:4096}") int maxWidth, // 4096px width default
        @Value("${aet.storage.max-image-height:4096}") int maxHeight // 4096px height default
    ) {
        this.imageRepository = imageRepository;
        this.jobRepository = jobRepository;
        this.departmentRepository = departmentRepository;
        this.researchGroupRepository = researchGroupRepository;
        this.schoolRepository = schoolRepository;
        this.currentUserService = currentUserService;
        this.imageRoot = Paths.get(imageRootDir).toAbsolutePath().normalize();
        this.maxFileSize = maxFileSize;
        this.maxWidth = maxWidth;
        this.maxHeight = maxHeight;

        initializeImageDirectories();
    }

    private void initializeImageDirectories() {
        try {
            Files.createDirectories(imageRoot);
            // Create subdirectories for each image type
            Files.createDirectories(imageRoot.resolve("jobs"));
            Files.createDirectories(imageRoot.resolve("profiles"));
            Files.createDirectories(imageRoot.resolve("defaults"));
        } catch (IOException ioe) {
            throw new IllegalStateException("Cannot create image root: " + imageRoot, ioe);
        }
    }

    /**
     * Uploads a default job banner image for a specific department (admin only).
     * The image will be available to all research groups within the department.
     *
     * The file is validated for type (JPEG/PNG), size, and dimensions before being
     * stored.
     *
     * @param file         the multipart file to be uploaded
     * @param departmentId the ID of the department this default image belongs to
     * @return the persisted DepartmentImage entity
     * @throws AccessDeniedException   if the current user is not an admin
     * @throws EntityNotFoundException if the department is not found
     * @throws UploadException         if the file is invalid or cannot be stored
     */
    @Transactional
    public DepartmentImage uploadDefaultImage(MultipartFile file, UUID departmentId) {
        User uploader = currentUserService.getUser();
        Department department = departmentRepository
            .findById(departmentId)
            .orElseThrow(() -> EntityNotFoundException.forId("Department", departmentId));

        String relativePath = storeImageFile(file, ImageType.DEFAULT_JOB_BANNER);

        DepartmentImage image = new DepartmentImage();
        setBaseImageProperties(image, file, relativePath, uploader);
        image.setDepartment(department);

        return imageRepository.save(image);
    }

    /**
     * Uploads a job banner image associated with the current user's research group.
     *
     * The file is validated for type (JPEG/PNG), size, and dimensions before being
     * stored.
     * A unique filename is generated and the image is saved to the jobs
     * subdirectory.
     *
     * @param file the multipart file to be uploaded
     * @return the persisted ResearchGroupImage entity
     * @throws IllegalStateException if the user is not a member of a research group
     * @throws UploadException       if the file is invalid or cannot be stored
     */
    @Transactional
    public ResearchGroupImage uploadJobBanner(MultipartFile file) {
        User uploader = currentUserService.getUser();
        UUID researchGroupId = currentUserService.getResearchGroupIdIfMember();
        ResearchGroup researchGroup = researchGroupRepository
            .findById(researchGroupId)
            .orElseThrow(() -> EntityNotFoundException.forId("ResearchGroup", researchGroupId));

        return uploadJobBanner(researchGroup, file, uploader);
    }

    /**
     * Uploads a job banner image for a specific research group (admin use case).
     *
     * @param researchGroupId the ID of the target research group
     * @param file            the multipart file to be uploaded
     * @return the persisted ResearchGroupImage entity
     * @throws EntityNotFoundException if the research group does not exist
     * @throws UploadException         if the file is invalid or cannot be stored
     */
    public ResearchGroupImage uploadJobBannerForResearchGroup(UUID researchGroupId, MultipartFile file) {
        User uploader = currentUserService.getUser();
        ResearchGroup researchGroup = researchGroupRepository
            .findById(researchGroupId)
            .orElseThrow(() -> EntityNotFoundException.forId("ResearchGroup", researchGroupId));

        return uploadJobBanner(researchGroup, file, uploader);
    }

    private ResearchGroupImage uploadJobBanner(ResearchGroup researchGroup, MultipartFile file, User uploader) {
        if (researchGroup == null) {
            throw new IllegalStateException("Research group is required to upload job banners");
        }

        String relativePath = storeImageFile(file, ImageType.JOB_BANNER);

        ResearchGroupImage image = new ResearchGroupImage();
        setBaseImageProperties(image, file, relativePath, uploader);
        image.setResearchGroup(researchGroup);

        return imageRepository.save(image);
    }

    /**
     * Uploads a profile picture image for the current user.
     *
     * The file is validated for type (JPEG/PNG), size, and dimensions before being
     * stored.
     * A unique filename is generated and the image is saved to the profiles
     * subdirectory.
     *
     * @param file the multipart file to be uploaded
     * @return the persisted ProfileImage entity
     * @throws UploadException if the file is invalid or cannot be stored
     */
    @Transactional
    public ProfileImage uploadProfilePicture(MultipartFile file) {
        User uploader = currentUserService.getUser();
        deleteProfilePictureForUser(uploader);
        String relativePath = storeImageFile(file, ImageType.PROFILE_PICTURE);

        ProfileImage image = new ProfileImage();
        setBaseImageProperties(image, file, relativePath, uploader);
        uploader.setAvatar(image.getUrl());

        return imageRepository.save(image);
    }

    /**
     * Deletes the current user's profile picture, including any stored files.
     */
    @Transactional
    public void deleteCurrentUserProfilePicture() {
        deleteProfilePictureForUser(currentUserService.getUser());
    }

    /**
     * Deletes the stored profile picture for the given user ID.
     * Intended for cleanup flows such as retention processing.
     *
     * @param userId the user whose stored profile picture should be removed
     */
    @Transactional
    public void deleteProfilePictureByUserId(UUID userId) {
        deleteStoredProfilePictureByUserId(userId);
    }

    /**
     * Ensures the provided avatar URL references a persisted profile picture owned by the given user.
     *
     * @param userId the owner that must match the stored profile picture
     * @param avatarUrl the avatar URL to validate
     * @throws BadRequestException when the URL is not a stored profile image of the user
     */
    public void assertUserOwnsProfilePictureUrl(UUID userId, String avatarUrl) {
        String normalizedAvatarUrl = StringUtil.normalize(avatarUrl, false);
        if (normalizedAvatarUrl == null || normalizedAvatarUrl.isBlank()) {
            throw new NoProfilePictureException("No profile picture URL was provided");
        }

        if (!normalizedAvatarUrl.startsWith("/images/profiles/")) {
            throw new BadRequestException("Avatar URL must reference an existing profile picture owned by the current user");
        }

        if (!imageRepository.existsProfileImageByUserIdAndUrl(userId, normalizedAvatarUrl)) {
            if (imageRepository.findProfileImageByUserId(userId).isEmpty()) {
                throw new NoProfilePictureException();
            }
            throw new BadRequestException("Avatar URL must reference an existing profile picture owned by the current user");
        }
    }

    /**
     * Ensures the provided avatar URL references a persisted profile picture owned by the current user.
     *
     * @param avatarUrl the avatar URL to validate
     * @throws BadRequestException when the URL is not a stored profile image of the current user
     */
    public void assertCurrentUserOwnsProfilePictureUrl(String avatarUrl) {
        assertUserOwnsProfilePictureUrl(currentUserService.getUserId(), avatarUrl);
    }

    /**
     * Sets common properties for all image types.
     * Extracted to avoid code duplication across upload methods.
     *
     * @param image        the image entity to populate
     * @param file         the multipart file being uploaded
     * @param relativePath the relative storage path
     * @param uploader     the user uploading the image
     */
    private void setBaseImageProperties(Image image, MultipartFile file, String relativePath, User uploader) {
        image.setUrl("/images/" + relativePath);
        image.setMimeType(file.getContentType());
        image.setSizeBytes(file.getSize());
        image.setUploadedBy(uploader);
    }

    private void deleteProfilePictureForUser(User user) {
        user.setAvatar(null);
        deleteStoredProfilePictureByUserId(user.getUserId());
    }

    private void deleteStoredProfilePictureByUserId(UUID userId) {
        Optional<ProfileImage> existingImage = imageRepository.findProfileImageByUserId(userId);
        if (existingImage.isEmpty()) {
            return;
        }

        deleteImageFile(existingImage.get());
        imageRepository.delete(existingImage.get());
        // Flush the delete before a replacement upload inserts a new PROFILE_PICTURE row.
        imageRepository.flush();
    }

    /**
     * Core file storage logic shared by all upload methods.
     * Validates the file, stores it to disk, and returns the relative path.
     *
     * @param file      the multipart file to be stored
     * @param imageType the type of image (determines subdirectory)
     * @return the relative path to the stored file
     * @throws UploadException if the file is invalid or cannot be stored
     */
    private String storeImageFile(MultipartFile file, ImageType imageType) {
        validateImage(file);

        try {
            // Read the image to validate it's a real image
            BufferedImage bufferedImage;
            try (InputStream inputStream = file.getInputStream()) {
                bufferedImage = ImageIO.read(inputStream);
            }
            if (bufferedImage == null) {
                throw new UploadException("Invalid image file");
            }

            validateImageDimensions(bufferedImage);

            // Generate unique filename
            String extension = getExtension(file);
            String filename = UUID.randomUUID() + extension;
            String subdirectory = getSubdirectory(imageType);
            String relativePath = subdirectory + "/" + filename;

            // Full path on disk
            Path fullPath = imageRoot.resolve(relativePath);

            // Save original image
            try (InputStream inputStream = file.getInputStream()) {
                Files.copy(inputStream, fullPath, StandardCopyOption.REPLACE_EXISTING);
            }

            return relativePath;
        } catch (IOException e) {
            throw new UploadException("Failed to store image", e);
        }
    }

    /**
     * Retrieves default job banner images, optionally filtered by department or
     * school.
     * If departmentId is provided, returns images for that specific department.
     * If null, returns all default job banners across all departments.
     *
     * @param departmentId the ID of a department to filter by, or null to retrieve
     *                     all default job banners
     * @return list of default job banner images for the department or all
     *         departments
     */
    public List<DepartmentImage> getDefaultJobBanners(UUID departmentId) {
        if (departmentId == null) {
            return imageRepository.findDefaultJobBanners();
        }

        return imageRepository.findDepartmentImagesByDepartmentId(departmentId);
    }

    /**
     * Retrieves default job banner images for a specific school.
     * Returns all default images from all departments within the school.
     *
     * @param schoolId the school ID to find banners for
     * @return list of default job banner images for the school
     * @throws EntityNotFoundException if the school is not found
     */
    public List<DepartmentImage> getDefaultJobBannersBySchool(UUID schoolId) {
        // Verify school exists
        if (!schoolRepository.existsById(schoolId)) {
            throw EntityNotFoundException.forId("School", schoolId);
        }

        return imageRepository.findDefaultJobBannersBySchool(schoolId);
    }

    /**
     * Retrieves default job banner images for the current user's department.
     * Automatically determines the department from the user's research group.
     * If the user has no research group or the research group has no department,
     * returns an empty list.
     *
     * @return list of default job banner images for the current user's department
     */
    public List<DepartmentImage> getMyDefaultJobBanners() {
        UUID researchGroupId;
        try {
            researchGroupId = currentUserService.getResearchGroupIdIfMember();
        } catch (AccessDeniedException e) {
            return List.of();
        }
        ResearchGroup researchGroup = researchGroupRepository.findById(researchGroupId).orElse(null);
        if (researchGroup == null) {
            return List.of();
        }
        Department department = researchGroup.getDepartment();
        if (department == null) {
            return List.of();
        }

        return getDefaultJobBanners(department.getDepartmentId());
    }

    /**
     * Retrieves all non-default images uploaded by the current user.
     * This excludes DEFAULT_JOB_BANNER (DepartmentImage) and returns results
     * ordered by creation date (newest first).
     *
     * @return list of images uploaded by the current user, excluding default images
     */
    public List<Image> getMyUploadedImages() {
        UUID userId = currentUserService.getUserId();
        return imageRepository.findByUploaderId(userId);
    }

    /**
     * Retrieves all job banner images (non-default) for the current user's research
     * group.
     * This returns only ResearchGroupImage type images, excluding DepartmentImage.
     *
     * @return list of job banner images belonging to the current user's research
     *         group
     */
    public List<ResearchGroupImage> getResearchGroupJobBanners() {
        UUID researchGroupId = currentUserService.getResearchGroupIdIfMember();
        return imageRepository.findResearchGroupImagesByResearchGroupId(researchGroupId);
    }

    /**
     * Retrieves all job banner images (non-default) for a specific research group.
     *
     * @param researchGroupId the target research group ID
     * @return list of job banner images belonging to the given research group
     * @throws EntityNotFoundException if the research group does not exist
     */
    public List<ResearchGroupImage> getResearchGroupJobBannersByResearchGroup(UUID researchGroupId) {
        if (!researchGroupRepository.existsById(researchGroupId)) {
            throw EntityNotFoundException.forId("ResearchGroup", researchGroupId);
        }

        return imageRepository.findResearchGroupImagesByResearchGroupId(researchGroupId);
    }

    /**
     * Converts a list of images to DTOs with isInUse flag populated.
     * The isInUse flag indicates whether any job currently references the image.
     * This method optimizes performance by querying all image usage in a single
     * database call.
     *
     * @param images the images to convert
     * @return list of ImageDTOs with isInUse flag
     */
    public List<ImageDTO> toImageDTOsWithUsageInfo(List<? extends Image> images) {
        if (images.isEmpty()) {
            return List.of();
        }

        // Collect all image IDs and query once for all in-use images
        List<UUID> imageIds = images.stream().map(Image::getImageId).toList();
        Set<UUID> inUseImageIds = jobRepository.findInUseImageIds(imageIds);

        // Map images to DTOs with isInUse flag
        return images
            .stream()
            .map(image -> {
                boolean isInUse = inUseImageIds.contains(image.getImageId());
                return ImageDTO.fromEntity(image, isInUse);
            })
            .toList();
    }

    /**
     * Deletes an image with ownership and permission checks.
     * Regular users can only delete images they uploaded themselves (excluding
     * default school images).
     * For job banners (JOB_BANNER), users can delete any banner belonging to their
     * research group.
     * Admins can delete any image, including default school images.
     *
     * The image file is deleted from the filesystem and the database record is
     * removed.
     *
     * @param imageId the ID of the image to delete
     * @throws EntityNotFoundException if the image is not found
     * @throws AccessDeniedException   if the user lacks permission to delete the
     *                                 image
     */
    @Transactional
    public void delete(UUID imageId) {
        User currentUser = currentUserService.getUser();
        boolean isAdmin = currentUserService.isAdmin();

        Image image = imageRepository.findById(imageId).orElseThrow(() -> EntityNotFoundException.forId("Image", imageId));

        validateDeletePermission(image, currentUser, isAdmin);

        deleteImageFile(image);
        imageRepository.delete(image);
    }

    /**
     * Validates whether the current user has permission to delete the given image.
     *
     * @param image       the image to be deleted
     * @param currentUser the user attempting to delete the image
     * @param isAdmin     whether the current user is an admin
     * @throws AccessDeniedException if the user lacks permission to delete the
     *                               image
     */
    private void validateDeletePermission(Image image, User currentUser, boolean isAdmin) {
        if (isAdmin) {
            return; // Admins can delete any image
        }

        if (image instanceof DepartmentImage) {
            throw new AccessDeniedException("Only admins can delete default images");
        }

        if (image instanceof ResearchGroupImage) {
            validateResearchGroupImageDeletePermission((ResearchGroupImage) image, currentUser);
        } else {
            validateOwnershipDeletePermission(image, currentUser);
        }
    }

    /**
     * Validates whether the user can delete a research group job banner.
     *
     * @param image       the research group job banner image
     * @param currentUser the user attempting to delete the image
     * @throws AccessDeniedException if the user's research group doesn't match the
     *                               image's research group
     */
    private void validateResearchGroupImageDeletePermission(ResearchGroupImage image, User currentUser) {
        if (image.getResearchGroup() == null) {
            throw new AccessDeniedException("You do not have permission to delete this image");
        }

        UUID imageGroupId = image.getResearchGroup().getResearchGroupId();
        if (!currentUserService.getCurrentUser().isMemberOf(imageGroupId)) {
            throw new AccessDeniedException("You can only delete job banners from your research group");
        }
    }

    /**
     * Validates whether the user is the uploader of the image.
     *
     * @param image       the image
     * @param currentUser the user attempting to delete the image
     * @throws AccessDeniedException if the user is not the uploader
     */
    private void validateOwnershipDeletePermission(Image image, User currentUser) {
        if (image.getUploadedBy() != null && !image.getUploadedBy().getUserId().equals(currentUser.getUserId())) {
            throw new AccessDeniedException("You can only delete images you uploaded");
        }
    }

    /**
     * Deletes an image without ownership checks (for internal use only).
     * This method is intended for system cleanup operations and will NOT delete
     * default department images.
     * If a default image ID is provided, the deletion is skipped and a warning is
     * logged.
     *
     * @param imageId the ID of the image to delete
     * @throws EntityNotFoundException if the image is not found
     */
    @Transactional
    public void deleteWithoutChecks(UUID imageId) {
        Image image = imageRepository.findById(imageId).orElseThrow(() -> EntityNotFoundException.forId("Image", imageId));

        if (image instanceof DepartmentImage) {
            log.warn("Attempted to delete default department image: {}", imageId);
            return;
        }

        deleteImageFile(image);
        imageRepository.delete(image);
    }

    /**
     * Cleans up orphaned default images (DepartmentImages with no department).
     * This can happen if departments are deleted without proper cleanup.
     * Should be called periodically or after department deletions.
     */
    @Transactional
    public void cleanupOrphanedDefaultImages() {
        List<DepartmentImage> orphanedImages = imageRepository.findOrphanedDepartmentImages();
        for (DepartmentImage image : orphanedImages) {
            deleteImageFile(image);
            imageRepository.delete(image);
        }
    }

    /**
     * Replaces an old image with a new one, safely deleting the old image if
     * appropriate.
     * This is typically used when updating a job's banner image. The old image will
     * only be deleted if:
     * - It exists and is not null
     * - It is not a DepartmentImage (default images)
     * - It is not a ResearchGroupImage (job banners) - these are kept in the
     * research group's image library
     * - It is different from the new image
     *
     * Default department images and research group job banners are never
     * automatically deleted during replacement
     * to preserve the image library for reuse.
     *
     * @param oldImage the current image to be replaced (can be null)
     * @param newImage the new image to use (can be null)
     * @return the new image (unchanged)
     */
    public Image replaceImage(Image oldImage, Image newImage) {
        // Don't auto-delete default images or research group job banners (they're part
        // of the reusable library)
        if (
            oldImage != null &&
            !(oldImage instanceof DepartmentImage) &&
            !(oldImage instanceof ResearchGroupImage) &&
            (newImage == null || !oldImage.getImageId().equals(newImage.getImageId()))
        ) {
            try {
                deleteWithoutChecks(oldImage.getImageId());
            } catch (Exception e) {
                log.error("Failed to delete old image during replacement: {}", oldImage.getImageId(), e);
            }
        }
        return newImage;
    }

    private void deleteImageFile(Image image) {
        try {
            String relativePath = image.getUrl().replace("/images/", "");
            Path imagePath = imageRoot.resolve(relativePath).normalize();
            Path normalizedRoot = imageRoot.normalize();

            if (!imagePath.startsWith(normalizedRoot)) {
                throw new IllegalStateException("Stored path lies outside storage root: " + imagePath);
            }

            Files.deleteIfExists(imagePath);
        } catch (IOException e) {
            log.error("Failed to delete image file for: {}", image.getImageId(), e);
        }
    }

    private void validateImage(MultipartFile file) {
        if (file.isEmpty() || !StringUtils.hasText(file.getOriginalFilename())) {
            throw new UploadException("Empty file or missing filename");
        }

        if (file.getSize() > maxFileSize) {
            throw new UploadException("Image exceeds maximum size of " + maxFileSize + " bytes");
        }

        String mimeType = file.getContentType();
        if (mimeType == null || !ALLOWED_MIME_TYPES.contains(mimeType.toLowerCase())) {
            throw new UploadException("Invalid image type. Allowed: JPG, JPEG, PNG");
        }
    }

    private void validateImageDimensions(BufferedImage image) {
        int width = image.getWidth();
        int height = image.getHeight();

        if (width > maxWidth || height > maxHeight) {
            throw new UploadException(
                String.format("Image dimensions (%dx%d) exceed maximum allowed dimensions (%dx%d)", width, height, maxWidth, maxHeight)
            );
        }
    }

    private String getExtension(MultipartFile file) {
        String mimeType = file.getContentType();
        if (!StringUtils.hasText(mimeType)) {
            String extension = FilenameUtils.getExtension(file.getOriginalFilename());
            return StringUtils.hasText(extension) ? "." + extension.toLowerCase() : ".jpg";
        }

        return switch (mimeType.toLowerCase()) {
            case "image/jpeg", "image/jpg" -> ".jpg";
            case "image/png" -> ".png";
            default -> {
                String extension = FilenameUtils.getExtension(file.getOriginalFilename());
                yield StringUtils.hasText(extension) ? "." + extension.toLowerCase() : ".jpg";
            }
        };
    }

    private String getSubdirectory(ImageType imageType) {
        return switch (imageType) {
            case JOB_BANNER -> "jobs";
            case PROFILE_PICTURE -> "profiles";
            case DEFAULT_JOB_BANNER -> "defaults";
        };
    }

    /**
     * Retrieves the raw bytes of an image file for embedding in documents (e.g.,
     * PDF export).
     *
     * @param imageId the ID of the image to retrieve
     * @return the image file contents as a byte array
     * @throws EntityNotFoundException if the image is not found
     * @throws InternalServerException if the image file cannot be read
     */
    public byte[] getImageBytes(UUID imageId) {
        Image image = imageRepository.findById(imageId).orElseThrow(() -> EntityNotFoundException.forId("Image", imageId));

        String relativePath = image.getUrl().replace("/images/", "");
        Path imagePath = imageRoot.resolve(relativePath).normalize();
        Path normalizedRoot = imageRoot.normalize();

        if (!imagePath.startsWith(normalizedRoot)) {
            throw new IllegalStateException("Image path lies outside storage root: " + imagePath);
        }

        try {
            return Files.readAllBytes(imagePath);
        } catch (IOException e) {
            throw new InternalServerException("Failed to read image file: " + imageId, e);
        }
    }
}
