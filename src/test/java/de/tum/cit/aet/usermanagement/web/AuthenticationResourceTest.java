package de.tum.cit.aet.usermanagement.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.dto.auth.LoginRequestDTO;
import de.tum.cit.aet.usermanagement.service.UserService;
import de.tum.cit.aet.utility.DatabaseCleaner;
import de.tum.cit.aet.utility.MvcTestClient;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Integration tests for {@link de.tum.cit.aet.usermanagement.web.AuthenticationResource#login} that exercise
 * the local email/password sign-in end to end.
 *
 * {@code UserService} is a mock in the test security context, so the user lookup is stubbed; the password
 * encoder and app-token minting are the real beans.
 */
public class AuthenticationResourceTest extends AbstractResourceTest {

    private static final String LOGIN_PATH = "/api/auth/login";
    private static final String EMAIL = "applicant@example.org";
    private static final String PASSWORD = "secret-password";

    @Autowired
    MvcTestClient api;

    @Autowired
    PasswordEncoder passwordEncoder;

    @Autowired
    UserService userService;

    @Autowired
    DatabaseCleaner databaseCleaner;

    private User user;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
        api.withoutPostProcessors();
        Mockito.reset(userService);

        user = new User();
        user.setUserId(UUID.randomUUID());
        user.setEmail(EMAIL);
        user.setFirstName("Max");
        user.setLastName("Applicant");
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setEmailVerified(true);
    }

    @Test
    void issuesSessionCookiesOnValidCredentials() {
        when(userService.findByEmail(EMAIL)).thenReturn(Optional.of(user));

        MockHttpServletResponse response = api.postAndReturnResponse(LOGIN_PATH, new LoginRequestDTO(EMAIL, PASSWORD), 200);

        List<String> setCookies = response.getHeaders("Set-Cookie");
        assertThat(setCookies).anyMatch(header -> header.startsWith("access_token="));
        assertThat(setCookies).anyMatch(header -> header.startsWith("refresh_token="));
    }

    @Test
    void rejectsWrongPassword() {
        when(userService.findByEmail(EMAIL)).thenReturn(Optional.of(user));

        api.postAndRead(LOGIN_PATH, new LoginRequestDTO(EMAIL, "wrong-password"), Void.class, 401);
    }

    @Test
    void rejectsUnverifiedEmailEvenWithCorrectPassword() {
        user.setEmailVerified(false);
        when(userService.findByEmail(EMAIL)).thenReturn(Optional.of(user));

        api.postAndRead(LOGIN_PATH, new LoginRequestDTO(EMAIL, PASSWORD), Void.class, 401);
    }

    @Test
    void rejectsUserWithoutLocalPassword() {
        user.setPasswordHash(null);
        when(userService.findByEmail(EMAIL)).thenReturn(Optional.of(user));

        api.postAndRead(LOGIN_PATH, new LoginRequestDTO(EMAIL, PASSWORD), Void.class, 401);
    }

    @Test
    void rejectsUnknownUser() {
        when(userService.findByEmail("ghost@example.org")).thenReturn(Optional.empty());

        api.postAndRead(LOGIN_PATH, new LoginRequestDTO("ghost@example.org", PASSWORD), Void.class, 401);
    }
}
