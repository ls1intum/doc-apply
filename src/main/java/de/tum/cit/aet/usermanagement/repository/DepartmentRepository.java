package de.tum.cit.aet.usermanagement.repository;

import de.tum.cit.aet.core.repository.DocApplyJpaRepository;
import de.tum.cit.aet.usermanagement.domain.Department;
import de.tum.cit.aet.usermanagement.dto.DepartmentDTO;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA repository for the {@link Department} entity.
 */
@Repository
public interface DepartmentRepository extends DocApplyJpaRepository<Department, UUID> {
    @NotNull
    default Department findByIdElseThrow(UUID departmentId) {
        return getArbitraryValueElseThrow(findById(departmentId));
    }

    List<Department> findBySchoolSchoolIdOrderByNameAsc(UUID schoolId);

    List<Department> findBySchoolSchoolIdInOrderBySchoolSchoolIdAscNameAsc(List<UUID> schoolIds);

    boolean existsBySchoolSchoolId(UUID schoolId);

    List<Department> findAllByOrderBySchoolSchoolIdAscNameAsc();

    @Query(
        """
            SELECT new de.tum.cit.aet.usermanagement.dto.DepartmentDTO(
                d.departmentId,
                d.name,
                new de.tum.cit.aet.usermanagement.dto.SchoolShortDTO(
                    d.school.schoolId,
                    d.school.name,
                    d.school.abbreviation
                )
            )
            FROM Department d
            LEFT JOIN d.school s
            WHERE (:searchQuery IS NULL OR
                   LOWER(d.name) LIKE LOWER(CONCAT('%', :searchQuery, '%')) OR
                   LOWER(s.name) LIKE LOWER(CONCAT('%', :searchQuery, '%')) OR
                   LOWER(s.abbreviation) LIKE LOWER(CONCAT('%', :searchQuery, '%'))
            )
            AND (:schoolNames IS NULL OR LOWER(s.name) IN :schoolNames)
        """
    )
    Page<DepartmentDTO> findAllForAdmin(
        @Param("searchQuery") String searchQuery,
        @Param("schoolNames") List<String> schoolNames,
        Pageable pageable
    );

    boolean existsByNameIgnoreCaseAndSchoolSchoolId(String name, UUID schoolId);
}
