package de.tum.cit.aet.usermanagement.repository;

import de.tum.cit.aet.core.repository.DocApplyJpaRepository;
import de.tum.cit.aet.usermanagement.domain.DeletedUser;
import java.util.UUID;
import org.springframework.stereotype.Repository;

@Repository
public interface DeletedUserRepository extends DocApplyJpaRepository<DeletedUser, UUID> {}
