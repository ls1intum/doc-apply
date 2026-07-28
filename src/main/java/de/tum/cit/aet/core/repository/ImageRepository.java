package de.tum.cit.aet.core.repository;

import de.tum.cit.aet.core.domain.DepartmentImage;
import de.tum.cit.aet.core.domain.Image;
import de.tum.cit.aet.core.domain.ProfileImage;
import de.tum.cit.aet.core.domain.ResearchGroupImage;
import de.tum.cit.aet.usermanagement.domain.User;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ImageRepository extends DocApplyJpaRepository<Image, UUID> {
    /**
     * Find all research group job banner images for a specific research group.
     * Results are ordered by creation date (oldest first).
     *
     * @param researchGroupId the specific research group ID to filter by
     * @return a list of images belonging to that specific research group, ordered by creation date ascending
     */
    @Query("SELECT rgi FROM ResearchGroupImage rgi WHERE rgi.researchGroup.researchGroupId = :researchGroupId ORDER BY rgi.createdAt ASC")
    List<ResearchGroupImage> findResearchGroupImagesByResearchGroupId(@Param("researchGroupId") UUID researchGroupId);

    /**
     * Find all default job banners with user information across all schools.
     *
     * @return a list of all default job banners with uploader information
     */
    @Query("SELECT di FROM DepartmentImage di LEFT JOIN FETCH di.uploadedBy ORDER BY di.createdAt ASC")
    List<DepartmentImage> findAllDepartmentImages();

    /**
     * Find images by uploader (non-default images only).
     * This excludes DEFAULT_JOB_BANNER (DepartmentImage) and returns results ordered by creation date (newest first).
     *
     * @param userId the ID of the user who uploaded the images
     * @return a list of images uploaded by the user (excludes default images)
     */
    @Query("SELECT i FROM Image i WHERE i.uploadedBy.userId = :userId AND TYPE(i) != DepartmentImage ORDER BY i.createdAt DESC")
    List<Image> findByUploaderId(@Param("userId") UUID userId);

    /**
     * Find all default job banner images for a specific school.
     *
     * @param schoolId the school ID to find banners for
     * @return a list of default job banners for the school
     */
    @Query(
        "SELECT di FROM DepartmentImage di LEFT JOIN FETCH di.uploadedBy WHERE di.department.school.schoolId = :schoolId ORDER BY di.createdAt ASC"
    )
    List<DepartmentImage> findDepartmentImagesBySchoolId(@Param("schoolId") UUID schoolId);

    /**
     * Find all default job banner images for a specific department.
     *
     * @param departmentId the department ID to find banners for
     * @return a list of default job banners for the department
     */
    @Query("SELECT di FROM DepartmentImage di WHERE di.department.departmentId = :departmentId ORDER BY di.createdAt ASC")
    List<DepartmentImage> findDepartmentImagesByDepartmentId(@Param("departmentId") UUID departmentId);

    /**
     * Find all default job banner images across all schools.
     *
     * @return a list of all default job banners from all schools
     */
    default List<DepartmentImage> findDefaultJobBanners() {
        return findAllDepartmentImages();
    }

    /**
     * Convenience method to find default job banners by school ID.
     *
     * @param schoolId the school ID to find banners for
     * @return a list of default job banners for the school
     */
    default List<DepartmentImage> findDefaultJobBannersBySchool(UUID schoolId) {
        return findDepartmentImagesBySchoolId(schoolId);
    }

    /**
     * Find orphaned default images (DepartmentImages with no department).
     * This can happen if departments are deleted without proper cleanup.
     *
     * @return a list of orphaned default images
     */
    @Query("SELECT di FROM DepartmentImage di WHERE di.department IS NULL")
    List<DepartmentImage> findOrphanedDepartmentImages();

    /**
     * Finds the profile image associated with the given user.
     *
     * @param userId the ID of the user whose profile image should be returned
     * @return the stored profile image for the given user, if present
     */
    @Query("SELECT pi FROM ProfileImage pi WHERE pi.uploadedBy.userId = :userId")
    Optional<ProfileImage> findProfileImageByUserId(@Param("userId") UUID userId);

    /**
     * Checks whether the given user owns a persisted profile image with the provided URL.
     *
     * @param userId the owner of the profile image
     * @param url the exact profile image URL
     * @return {@code true} when the URL belongs to a stored profile image of that user
     */
    @Query("SELECT COUNT(pi) > 0 FROM ProfileImage pi WHERE pi.uploadedBy.userId = :userId AND pi.url = :url")
    boolean existsProfileImageByUserIdAndUrl(@Param("userId") UUID userId, @Param("url") String url);

    /**
     * Updates all {@link Image} records uploaded by the given {@code user} to associate them with the
     * provided {@code deletedUser} instead of the original user.
     *
     * @param user the user whose uploaded images should be dissociated
     * @param deletedUser the user to set as the uploader for those images
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Image i SET i.uploadedBy = :deletedUser WHERE i.uploadedBy = :user")
    void dissociateImagesFromUser(@Param("user") User user, @Param("deletedUser") User deletedUser);
}
