package de.tum.cit.aet.core.repository;

import de.tum.cit.aet.core.exception.EntityNotFoundException;
import jakarta.validation.constraints.NotNull;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.NoRepositoryBean;

/**
 * Base repository interface for all repositories in the application.
 * <p>
 * This interface extends {@link JpaRepository} and provides additional methods for
 * handling entities.
 *
 * @param <T>  the type of the entity
 * @param <ID> the type of the entity's identifier
 */
@NoRepositoryBean
public interface DocApplyJpaRepository<T, ID> extends JpaRepository<T, ID> {
    /**
     * Get the entity if it exists or throw an EntityNotFoundException.
     *
     * @param <U>      the type of the entity
     * @param optional the optional to get the entity from
     * @return the entity if it exists
     */
    @NotNull
    default <U> U getArbitraryValueElseThrow(Optional<U> optional) {
        return optional.orElseThrow(() -> new EntityNotFoundException("Entity not found"));
    }

    /**
     * Get an arbitrary value if it exists or throw an EntityNotFoundException.
     *
     * @param <U>      the type of the entity
     * @param optional the optional to get the entity from
     * @param id       the id of the entity to find in string representation
     * @return the entity if it exists
     */
    default <U> U getArbitraryValueElseThrow(Optional<U> optional, String id) {
        return optional.orElseThrow(() -> EntityNotFoundException.forId("Entity", id));
    }
}
