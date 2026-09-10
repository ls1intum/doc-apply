package de.tum.cit.aet.core.security.webauthn;

import java.util.List;
import org.springframework.security.web.webauthn.api.Bytes;
import org.springframework.security.web.webauthn.api.CredentialRecord;
import org.springframework.security.web.webauthn.management.UserCredentialRepository;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Runs every call to the delegate {@link UserCredentialRepository} inside its own transaction.
 *
 * The connection pool disables auto-commit, and Spring Security's WebAuthn ceremony filters call the
 * repository outside any Spring-managed transaction, so without an explicit commit the pool silently
 * rolls the writes back when the connection is returned.
 */
public final class TransactionalUserCredentialRepository implements UserCredentialRepository {

    private final UserCredentialRepository delegate;
    private final TransactionTemplate readTransaction;
    private final TransactionTemplate writeTransaction;

    /**
     * Wraps the given repository so each of its methods commits its own transaction.
     *
     * @param delegate           the repository doing the actual credential storage
     * @param transactionManager manages the per-call transactions
     */
    public TransactionalUserCredentialRepository(UserCredentialRepository delegate, PlatformTransactionManager transactionManager) {
        this.delegate = delegate;
        this.writeTransaction = new TransactionTemplate(transactionManager);
        this.readTransaction = new TransactionTemplate(transactionManager);
        this.readTransaction.setReadOnly(true);
    }

    @Override
    public List<CredentialRecord> findByUserId(Bytes userId) {
        return readTransaction.execute(status -> delegate.findByUserId(userId));
    }

    @Override
    public CredentialRecord findByCredentialId(Bytes credentialId) {
        return readTransaction.execute(status -> delegate.findByCredentialId(credentialId));
    }

    @Override
    public void save(CredentialRecord credentialRecord) {
        writeTransaction.executeWithoutResult(status -> delegate.save(credentialRecord));
    }

    @Override
    public void delete(Bytes credentialId) {
        writeTransaction.executeWithoutResult(status -> delegate.delete(credentialId));
    }
}
