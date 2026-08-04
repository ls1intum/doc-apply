package de.tum.cit.aet.usermanagement.repository;

import de.tum.cit.aet.core.repository.DocApplyJpaRepository;
import de.tum.cit.aet.usermanagement.domain.School;
import de.tum.cit.aet.usermanagement.dto.SchoolShortDTO;
import jakarta.validation.constraints.NotNull;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA repository for the {@link School} entity.
 */
@Repository
public interface SchoolRepository extends DocApplyJpaRepository<School, UUID> {
    @NotNull
    default School findByIdElseThrow(UUID schoolId) {
        return getArbitraryValueElseThrow(findById(schoolId));
    }

    Optional<School> findByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCase(String name);

    boolean existsByAbbreviationIgnoreCase(String abbreviation);

    @Query(
        """
            SELECT new de.tum.cit.aet.usermanagement.dto.SchoolShortDTO(
                s.schoolId,
                s.name,
                s.abbreviation
            )
            FROM School s
            WHERE (:searchQuery IS NULL OR
                   LOWER(s.name) LIKE LOWER(CONCAT('%', :searchQuery, '%')) OR
                   LOWER(s.abbreviation) LIKE LOWER(CONCAT('%', :searchQuery, '%')))
        """
    )
    Page<SchoolShortDTO> findAllForAdmin(@Param("searchQuery") String searchQuery, Pageable pageable);
}
