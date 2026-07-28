package de.tum.cit.aet.usermanagement.repository;

import de.tum.cit.aet.core.repository.DocApplyJpaRepository;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.domain.UserResearchGroupRole;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface UserResearchGroupRoleRepository extends DocApplyJpaRepository<UserResearchGroupRole, UUID> {
    boolean existsByUserUserId(UUID userId);

    Set<UserResearchGroupRole> findAllByUser(User user);

    Optional<UserResearchGroupRole> findByUserAndResearchGroup(User user, ResearchGroup researchGroup);

    boolean existsByUserAndResearchGroup(User user, ResearchGroup researchGroup);

    Set<UserResearchGroupRole> findAllByResearchGroup(ResearchGroup researchGroup);

    /**
     * Removes research group association from all roles for a specific user.
     *
     * @param userId the ID of the user whose research group associations should be removed
     */
    @Modifying
    @Query("UPDATE UserResearchGroupRole urgr SET urgr.researchGroup = null WHERE urgr.user.userId = :userId")
    void removeResearchGroupFromUserRoles(@Param("userId") UUID userId);

    /**
     * Deletes all roles for a given user ID using a bulk operation.
     *
     * @param userId the user ID whose roles should be deleted
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM UserResearchGroupRole urgr WHERE urgr.user.userId = :userId")
    void deleteByUserId(@Param("userId") UUID userId);
}
