package de.tum.cit.aet.usermanagement.repository;

import de.tum.cit.aet.core.repository.DocApplyJpaRepository;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.usermanagement.domain.User;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA repository for the {@link Job} entity.
 */
@Repository
public interface UserRepository extends DocApplyJpaRepository<User, UUID> {
    @EntityGraph(attributePaths = { "researchGroupRoles", "researchGroupRoles.role", "researchGroupRoles.researchGroup" })
    Optional<User> findWithResearchGroupRolesByUserId(UUID userId);

    /**
     * Loads a user together with the research group roles eagerly fetched, so the collection
     * stays accessible after the persistence session closes.
     *
     * @param userId the ID of the user to load
     * @return the user with initialized research group roles
     */
    @NotNull
    default User findWithResearchGroupRolesByUserIdElseThrow(UUID userId) {
        return getArbitraryValueElseThrow(findWithResearchGroupRolesByUserId(userId));
    }

    /**
     * Finds users by their IDs with eagerly loaded research group roles.
     *
     * @param userIds the list of user IDs
     * @return list of users with eagerly loaded collections
     */
    @Query(
        """
            SELECT u FROM User u
            LEFT JOIN FETCH u.researchGroupRoles
            WHERE u.userId IN :userIds
            ORDER BY u.firstName, u.lastName
        """
    )
    List<User> findUsersWithRolesByIds(@Param("userIds") List<UUID> userIds);

    /**
     * Finds user IDs by research group ID with pagination support.
     *
     * @param researchGroupId the research group ID
     * @param pageable        the pagination information
     * @return page of user IDs in the research group
     */
    @Query(
        """
            SELECT DISTINCT u.userId FROM User u
            JOIN u.researchGroupRoles rgr
            WHERE rgr.researchGroup.researchGroupId = :researchGroupId
        """
    )
    Page<UUID> findUserIdsByResearchGroupId(@Param("researchGroupId") UUID researchGroupId, Pageable pageable);

    /**
     * Finds all user IDs by research group ID.
     *
     * @param researchGroupId the research group ID
     * @return list of user IDs in the research group
     */
    @Query(
        """
            SELECT DISTINCT u.userId FROM User u
            JOIN u.researchGroupRoles rgr
            WHERE rgr.researchGroup.researchGroupId = :researchGroupId
        """
    )
    List<UUID> findUserIdsByResearchGroupId(@Param("researchGroupId") UUID researchGroupId);

    /**
     * Returns the user ids of every user that holds the PROFESSOR role in any research group.
     *
     * @return list of professor user ids across all research groups
     */
    @Query(
        """
            SELECT DISTINCT rgr.user.userId FROM UserResearchGroupRole rgr
            WHERE rgr.role = de.tum.cit.aet.usermanagement.constants.UserRole.PROFESSOR
        """
    )
    List<UUID> findAllProfessorUserIds();

    /**
     * Finds users by their IDs with eagerly loaded research group roles and research group.
     * If a currentUserId is provided (non-null), the result will order that user first
     * and then the rest alphabetically by first and last name. If currentUserId is null,
     * the list will be ordered alphabetically.
     *
     * @param userIds       the list of user IDs
     * @param currentUserId (nullable) the current user's ID to display first. Pass null to fallback to pure alphabetical order.
     * @return list of users with eagerly loaded collections
     */
    @Query(
        """
            SELECT u FROM User u
            LEFT JOIN FETCH u.researchGroupRoles
            WHERE u.userId IN :userIds
            ORDER BY
            CASE WHEN :currentUserId IS NOT NULL AND u.userId = :currentUserId THEN 0 ELSE 1 END,
            u.firstName, u.lastName
        """
    )
    List<User> findUsersWithRolesByIdsForResearchGroup(@Param("userIds") List<UUID> userIds, @Param("currentUserId") UUID currentUserId);

    /**
     * Finds a user by their university ID in a case-insensitive manner.
     *
     * @param universityId normalized university ID (e.g., "ab12cde")
     * @return optional user with matching university ID
     */
    Optional<User> findByUniversityIdIgnoreCase(String universityId);

    /**
     * Finds a user by email in a case-insensitive manner.
     *
     * @param email normalized email address
     * @return optional user
     */
    Optional<User> findByEmailIgnoreCase(String email);

    /**
     * Finds the earliest-created user with the given email (case-insensitive). Email is not globally unique
     * — the same address can legitimately back both a TUM staff account (Keycloak-provisioned) and an
     * applicant account — so this returns a single deterministic match instead of failing when more than one
     * row exists.
     *
     * @param email normalized email address
     * @return the oldest matching user, if any
     */
    Optional<User> findTopByEmailIgnoreCaseOrderByCreatedAtAsc(String email);

    /**
     * Checks if a user exists with the given email in a case-insensitive manner.
     *
     * @param email normalized email address
     * @return true if a user exists with the email, false otherwise
     */
    boolean existsByEmailIgnoreCase(String email);

    /**
     * Checks if a user exists with the given user ID.
     *
     * @param userId the user ID
     * @return true if a user exists with the ID, false otherwise
     */
    boolean existsById(UUID userId);

    /**
     * Deletes a user by ID using a bulk operation to avoid merging detached entities.
     *
     * @param userId the user ID to delete
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM User u WHERE u.userId = :userId")
    void deleteByUserId(@Param("userId") UUID userId);

    /**
     * Finds user IDs for users available to be added to a research group.
     * Returns only IDs without JOIN FETCH for safe pagination.
     * Only includes TUM-affiliated users (email domain contains 'tum').
     *
     * @param searchQuery optional search query to filter by name or email
     * @param pageable pagination information
     * @return a Page of user IDs matching the criteria
     */
    @Query(
        """
            SELECT u.userId FROM User u
            LEFT JOIN u.researchGroupRoles rgr ON rgr.role = de.tum.cit.aet.usermanagement.constants.UserRole.ADMIN
            WHERE NOT EXISTS (
                SELECT 1 FROM UserResearchGroupRole r
                WHERE r.user = u
                  AND r.researchGroup IS NOT NULL
                  AND (r.role = de.tum.cit.aet.usermanagement.constants.UserRole.PROFESSOR
                       OR r.role = de.tum.cit.aet.usermanagement.constants.UserRole.EMPLOYEE)
            )
            AND rgr.id IS NULL
            AND u.email LIKE '%@%tum%'
            AND (:searchQuery IS NULL OR
                 LOWER(CONCAT(u.firstName, ' ', u.lastName)) LIKE LOWER(CONCAT('%', :searchQuery, '%')) OR
                 LOWER(u.email) LIKE LOWER(CONCAT('%', :searchQuery, '%'))
            )
        """
    )
    Page<UUID> findAvailableUserIdsForResearchGroup(@Param("searchQuery") String searchQuery, Pageable pageable);

    /**
     * Finds user IDs that are inactive (based on last activity or creation date) and are NOT admins.
     *
     * @param cutoff the cutoff timestamp used to determine inactivity
     * @param pageable pagination information
     * @return a page of inactive non-admin user IDs
     */
    @Query(
        """
            SELECT u.userId
            FROM User u
            WHERE COALESCE(u.lastActivityAt, u.createdAt) < :cutoff
              AND NOT EXISTS (
                SELECT 1
                FROM UserResearchGroupRole urgr
                WHERE urgr.user = u
                  AND urgr.role = de.tum.cit.aet.usermanagement.constants.UserRole.ADMIN
              )
            ORDER BY COALESCE(u.lastActivityAt, u.createdAt) ASC
        """
    )
    Page<UUID> findInactiveNonAdminUserIdsForRetention(@Param("cutoff") LocalDateTime cutoff, Pageable pageable);

    /**
     * Returns lower-cased university IDs that are already assigned to the given research group.
     * When {@code researchGroupId} is {@code null}, returns an empty list so no users are excluded.
     *
     * @param universityIds   lower-cased university IDs to check
     * @param researchGroupId target research group, or {@code null} to skip the filter
     * @return subset of IDs that hold PROFESSOR/EMPLOYEE in the target group
     */
    @Query(
        """
            SELECT LOWER(u.universityId)
            FROM User u
            WHERE :researchGroupId IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM UserResearchGroupRole r
                WHERE r.user = u
                  AND r.researchGroup.researchGroupId = :researchGroupId
                  AND (r.role = de.tum.cit.aet.usermanagement.constants.UserRole.PROFESSOR
                       OR r.role = de.tum.cit.aet.usermanagement.constants.UserRole.EMPLOYEE)
              )
              AND u.universityId IS NOT NULL
              AND LOWER(u.universityId) IN :universityIds
        """
    )
    List<String> findAssignedUniversityIdsIn(
        @Param("universityIds") List<String> universityIds,
        @Param("researchGroupId") UUID researchGroupId
    );

    /**
     * Searches for users available to be added to a research group, including non-TUM users.
     * Excludes users with an ADMIN role. When {@code researchGroupId} is provided, also excludes
     * users already holding PROFESSOR/EMPLOYEE in that specific group; when {@code null}, applies
     * no group-membership filter (used by admin flows that have no target group yet).
     *
     * @param searchQuery     optional search query to filter by name or email
     * @param researchGroupId target research group, or {@code null} to skip the per-group filter
     * @return list of users matching the criteria
     */
    @Query(
        """
            SELECT u FROM User u
            LEFT JOIN u.researchGroupRoles rgr ON rgr.role = de.tum.cit.aet.usermanagement.constants.UserRole.ADMIN
            WHERE (:researchGroupId IS NULL OR NOT EXISTS (
                SELECT 1 FROM UserResearchGroupRole r
                WHERE r.user = u
                  AND r.researchGroup.researchGroupId = :researchGroupId
                  AND (r.role = de.tum.cit.aet.usermanagement.constants.UserRole.PROFESSOR
                       OR r.role = de.tum.cit.aet.usermanagement.constants.UserRole.EMPLOYEE)
            ))
            AND rgr.id IS NULL
            AND (:searchQuery IS NULL OR
                 LOWER(CONCAT(u.firstName, ' ', u.lastName)) LIKE LOWER(CONCAT('%', :searchQuery, '%')) OR
                 LOWER(u.email) LIKE LOWER(CONCAT('%', :searchQuery, '%'))
            )
        """
    )
    List<User> searchAvailableUsersForResearchGroup(
        @Param("searchQuery") String searchQuery,
        @Param("researchGroupId") UUID researchGroupId
    );

    /**
     * Returns user IDs that are already assigned to the given research group.
     * When {@code researchGroupId} is {@code null}, returns an empty list so no users are excluded.
     *
     * @param userIds         user IDs to check
     * @param researchGroupId target research group, or {@code null} to skip the filter
     * @return subset of IDs that hold PROFESSOR/EMPLOYEE in the target group
     */
    @Query(
        """
            SELECT u.userId FROM User u
            WHERE :researchGroupId IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM UserResearchGroupRole r
                WHERE r.user = u
                  AND r.researchGroup.researchGroupId = :researchGroupId
                  AND (r.role = de.tum.cit.aet.usermanagement.constants.UserRole.PROFESSOR
                       OR r.role = de.tum.cit.aet.usermanagement.constants.UserRole.EMPLOYEE)
              )
              AND u.userId IN :userIds
        """
    )
    List<UUID> findAssignedUserIdsIn(@Param("userIds") List<UUID> userIds, @Param("researchGroupId") UUID researchGroupId);

    @Query(
        """
            SELECT u.userId
            FROM User u
            WHERE function('date', COALESCE(u.lastActivityAt, u.createdAt)) = function('date', :warningDate)
                AND NOT EXISTS (
                    SELECT 1
                    FROM UserResearchGroupRole urgr
                    WHERE urgr.user = u
                        AND urgr.role = de.tum.cit.aet.usermanagement.constants.UserRole.ADMIN
                )
            ORDER BY COALESCE(u.lastActivityAt, u.createdAt) ASC
        """
    )
    List<UUID> findInactiveNonAdminUserIdsForWarning(@Param("warningDate") LocalDateTime warningDate);

    /**
     * Finds every user holding a PROFESSOR role in any research group, with roles eagerly loaded.
     *
     * @return distinct list of users with at least one PROFESSOR role, ordered by first then last name
     */
    @Query(
        """
            SELECT DISTINCT u FROM User u
            LEFT JOIN FETCH u.researchGroupRoles
            WHERE EXISTS (
                SELECT 1 FROM UserResearchGroupRole urgr
                WHERE urgr.user = u
                  AND urgr.role = de.tum.cit.aet.usermanagement.constants.UserRole.PROFESSOR
            )
            ORDER BY u.firstName, u.lastName
        """
    )
    List<User> findAllProfessors();
}
