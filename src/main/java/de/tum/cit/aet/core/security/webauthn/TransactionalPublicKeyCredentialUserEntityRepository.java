package de.tum.cit.aet.core.security.webauthn;

import org.springframework.security.web.webauthn.api.Bytes;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialUserEntity;
import org.springframework.security.web.webauthn.management.PublicKeyCredentialUserEntityRepository;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Runs every call to the delegate {@link PublicKeyCredentialUserEntityRepository} inside its own transaction.
 *
 * The connection pool disables auto-commit, and Spring Security's WebAuthn ceremony filters call the
 * repository outside any Spring-managed transaction, so without an explicit commit the pool silently
 * rolls the writes back when the connection is returned.
 */
public final class TransactionalPublicKeyCredentialUserEntityRepository implements PublicKeyCredentialUserEntityRepository {

    private final PublicKeyCredentialUserEntityRepository delegate;
    private final TransactionTemplate readTransaction;
    private final TransactionTemplate writeTransaction;

    /**
     * Wraps the given repository so each of its methods commits its own transaction.
     *
     * @param delegate           the repository doing the actual user entity storage
     * @param transactionManager manages the per-call transactions
     */
    public TransactionalPublicKeyCredentialUserEntityRepository(
        PublicKeyCredentialUserEntityRepository delegate,
        PlatformTransactionManager transactionManager
    ) {
        this.delegate = delegate;
        this.writeTransaction = new TransactionTemplate(transactionManager);
        this.readTransaction = new TransactionTemplate(transactionManager);
        this.readTransaction.setReadOnly(true);
    }

    @Override
    public PublicKeyCredentialUserEntity findById(Bytes id) {
        return readTransaction.execute(status -> delegate.findById(id));
    }

    @Override
    public PublicKeyCredentialUserEntity findByUsername(String username) {
        return readTransaction.execute(status -> delegate.findByUsername(username));
    }

    @Override
    public void save(PublicKeyCredentialUserEntity userEntity) {
        writeTransaction.executeWithoutResult(status -> delegate.save(userEntity));
    }

    @Override
    public void delete(Bytes id) {
        writeTransaction.executeWithoutResult(status -> delegate.delete(id));
    }
}
