package de.tum.cit.aet.core.util;

import de.tum.cit.aet.core.dto.PageDTO;
import de.tum.cit.aet.core.dto.SortDTO;
import jakarta.validation.constraints.NotNull;
import java.util.Set;
import lombok.Getter;
import org.springframework.data.domain.PageRequest;

/**
 * Utility class for creating {@link PageRequest} objects with optional sorting,
 * based on predefined sets of sortable fields.
 */
public class PageUtil {

    /**
     * Enum for grouping valid sortable column names for different pageable use
     * cases.
     * Helps ensure only supported fields are passed to sorting logic.
     */
    @Getter
    public enum ColumnMapping {
        /**
         * Sortable columns used in available job listings.
         */
        AVAILABLE_JOBS(Set.of("title", "subjectArea", "location", "professorName", "workload", "startDate")),
        /**
         * Sortable columns used in job listings by professors.
         */
        PROFESSOR_JOBS(Set.of("title", "state", "startDate", "createdAt", "lastModifiedAt")),

        /**
         * Sortable columns used in research group listings.
         */
        RESEARCH_GROUPS(Set.of("head", "name", "abbreviation", "email", "website", "description", "street", "postalCode", "city")),

        /**
         * Sortable columns used in admin research group listings.
         */
        RESEARCH_GROUPS_ADMIN(Set.of("name", "head", "state", "createdAt")),

        /**
         * Sortable columns used in admin departments listings.
         */
        DEPARTMENTS_ADMIN(Set.of("name", "school.name")),

        /**
         * Sortable columns used in admin schools listings.
         */
        SCHOOLS_ADMIN(Set.of("name", "abbreviation")),

        /**
         * Sortable columns used in admin "Manage Users" listings.
         */
        USERS_ADMIN(Set.of("firstName", "lastName", "email", "universityId", "lastActivityAt")),

        /**
         * Sortable columns used in applicant's application listings.
         */
        APPLICANT_APPLICATIONS(Set.of("createdAt"));

        private final Set<String> sortableColumns;

        ColumnMapping(Set<String> sortableColumns) {
            this.sortableColumns = sortableColumns;
        }
    }

    /**
     * Creates a {@link PageRequest} object for pagination with optional sorting.
     *
     * @param pageDTO       the pagination information (page number and size)
     * @param sortDTO       the sorting configuration (field and direction)
     * @param columnMapping the enum containing allowed sortable columns
     * @param applySorting  flag to determine whether sorting should be applied
     * @return a configured {@link PageRequest} with or without sorting
     */
    @NotNull
    public static PageRequest createPageRequest(PageDTO pageDTO, SortDTO sortDTO, ColumnMapping columnMapping, boolean applySorting) {
        if (!applySorting) {
            return PageRequest.of(pageDTO.pageNumber(), pageDTO.pageSize());
        } else {
            return PageRequest.of(pageDTO.pageNumber(), pageDTO.pageSize(), sortDTO.toSpringSort(columnMapping.getSortableColumns()));
        }
    }
}
