package de.tum.cit.aet.core.dto;

import java.util.Set;
import org.springframework.data.domain.Sort;

public record SortDTO(String sortBy, Direction direction) {
    public enum Direction {
        ASC,
        DESC,
    }

    /**
     * Converts this {@link SortDTO} to a Spring Data {@link Sort} object, validating the requested field
     * against a predefined set of allowed sortable fields.
     *
     * @param sortableFields a set of field names that are permitted to be used for sorting
     * @return a {@link Sort} instance representing the sorting configuration
     * @throws IllegalArgumentException if the sort field is not in {@code sortableFields}
     */
    public Sort toSpringSort(Set<String> sortableFields) {
        if (sortBy == null || direction == null) {
            return Sort.unsorted();
        }

        if (!sortableFields.contains(sortBy)) {
            throw new IllegalArgumentException("Invalid sort field: " + sortBy);
        }

        Sort.Direction springDirection = Sort.Direction.fromString(direction.name());
        // Empty values sort first ascending and last descending, as users knew them before PostgreSQL
        Sort.NullHandling nullHandling = springDirection.isAscending() ? Sort.NullHandling.NULLS_FIRST : Sort.NullHandling.NULLS_LAST;
        return Sort.by(new Sort.Order(springDirection, sortBy, nullHandling));
    }
}
