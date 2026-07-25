package de.tum.cit.aet.usermanagement.service;

import de.tum.cit.aet.core.exception.UnauthorizedException;
import de.tum.cit.aet.core.service.AppTokenService;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.dto.auth.AuthResponseDTO;
import java.util.Objects;
import java.util.Optional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Authenticates applicants with email and a locally stored password hash, replacing the Keycloak password
 * grant for the decommissioned external-login realm. On success it mints app-issued tokens via
 * {@link AppTokenService}. TUM staff continue to authenticate through Keycloak and never use this path.
 */
@Service
public class LocalAuthenticationService {

    /**
     * A valid BCrypt hash (cost 10) matched against when the account is missing or has no local password, so a
     * hash comparison always runs and login response times cannot be used to enumerate registered emails.
     */
    private static final String DUMMY_PASSWORD_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final AppTokenService appTokenService;

    public LocalAuthenticationService(UserService userService, PasswordEncoder passwordEncoder, AppTokenService appTokenService) {
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
        this.appTokenService = appTokenService;
    }

    /**
     * Verifies the given credentials and issues an app session on success.
     *
     * @param email       the user's email
     * @param rawPassword the plaintext password
     * @return app-issued access and refresh tokens
     * @throws UnauthorizedException if the user does not exist, has no local password, or the password is wrong
     */
    public AuthResponseDTO loginWithCredentials(String email, String rawPassword) {
        Optional<User> maybeUser = userService.findByEmail(email);
        // Always run a password comparison — against a dummy hash when the account is missing or has no local
        // password — so the response time stays constant and cannot be used to enumerate registered emails.
        String storedHash = maybeUser.map(User::getPasswordHash).filter(Objects::nonNull).orElse(DUMMY_PASSWORD_HASH);
        boolean passwordMatches = rawPassword != null && passwordEncoder.matches(rawPassword, storedHash);

        User user = maybeUser.orElse(null);
        // Require an existing local password and a verified email as well; the message stays generic to avoid
        // revealing which check failed.
        boolean credentialsValid = user != null && user.getPasswordHash() != null && passwordMatches && user.isEmailVerified();
        if (!credentialsValid) {
            throw new UnauthorizedException("Invalid username or password");
        }
        return appTokenService.issueFor(user);
    }
}
