package de.tum.cit.aet.usermanagement.repository;

import de.tum.cit.aet.core.repository.DocApplyJpaRepository;
import de.tum.cit.aet.usermanagement.domain.Department;
import de.tum.cit.aet.usermanagement.dto.DepartmentDTO;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Locale;
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
                   LOWER(d.name) LIKE LOWER(CONCAT('%', CAST(:searchQuery AS String), '%')) OR
                   LOWER(s.name) LIKE LOWER(CONCAT('%', CAST(:searchQuery AS String), '%')) OR
                   LOWER(s.abbreviation) LIKE LOWER(CONCAT('%', CAST(:searchQuery AS String), '%'))
            )
            AND (:schoolNames IS NULL OR LOWER(s.name) IN :schoolNames)
        """
    )
    Page<DepartmentDTO> findAllForAdminByLowerCaseSchoolNames(
        @Param("searchQuery") String searchQuery,
        @Param("schoolNames") List<String> lowerCaseSchoolNames,
        Pageable pageable
    );

    /**
     * Pages departments for the admin overview, filtered by an optional search string and optional school names.
     * The school names are matched case-insensitively, so they are lower-cased here because JPQL cannot apply
     * LOWER to a collection parameter.
     *
     * @param searchQuery optional search string matching department name, school name or school abbreviation
     * @param schoolNames optional school names to include, in any letter case
     * @param pageable    pagination and sorting information
     * @return a page of matching departments
     */
    default Page<DepartmentDTO> findAllForAdmin(String searchQuery, List<String> schoolNames, Pageable pageable) {
        List<String> lowerCaseSchoolNames =
            schoolNames == null
                ? null
                : schoolNames
                      .stream()
                      .map(name -> name.toLowerCase(Locale.ROOT))
                      .toList();
        return findAllForAdminByLowerCaseSchoolNames(searchQuery, lowerCaseSchoolNames, pageable);
    }

    boolean existsByNameIgnoreCaseAndSchoolSchoolId(String name, UUID schoolId);
}
