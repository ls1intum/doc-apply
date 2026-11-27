package de.tum.cit.aet.usermanagement.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.when;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.usermanagement.constants.OtpPurpose;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.dto.auth.AuthSessionInfoDTO;
import de.tum.cit.aet.usermanagement.dto.auth.LoginRequestDTO;
import de.tum.cit.aet.usermanagement.dto.auth.OtpCompleteDTO;
import de.tum.cit.aet.usermanagement.repository.EmailVerificationOtpRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import de.tum.cit.aet.usermanagement.service.UserService;
import de.tum.cit.aet.utility.DatabaseCleaner;
import de.tum.cit.aet.utility.MvcTestClient;
import de.tum.cit.aet.utility.testdata.EmailVerificationOtpTestData;
import de.tum.cit.aet.utility.testdata.UserTestData;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Integration tests for {@link de.tum.cit.aet.usermanagement.web.AuthenticationResource} that exercise the local
 * email/password sign-in and the OTP registration end to end.
 *
 * {@code UserService} is a spy in the test security context, so the user lookup for the password sign-in is
 * stubbed; the password encoder, OTP verification and app-token minting are the real beans.
 */
public class AuthenticationResourceTest extends AbstractResourceTest {

    private static final String LOGIN_PATH = "/api/auth/login";
    private static final String EMAIL = "applicant@example.org";
    private static final String PASSWORD = "secret-password";
    private static final String OTP_COMPLETE_PATH = "/api/auth/otp-complete";
    private static final String OTP_CODE = "12345678";

    @Autowired
    MvcTestClient api;

    @Autowired
    PasswordEncoder passwordEncoder;

    @Autowired
    UserService userService;

    @Autowired
    DatabaseCleaner databaseCleaner;

    @Autowired
    UserRepository userRepository;

    @Autowired
    EmailVerificationOtpRepository otpRepository;

    @Value("${security.otp.hmac-secret}")
    String otpHmacSecret;

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
        doReturn(Optional.of(user)).when(userService).findByEmail(EMAIL);

        MockHttpServletResponse response = api.postAndReturnResponse(LOGIN_PATH, new LoginRequestDTO(EMAIL, PASSWORD), 200);

        List<String> setCookies = response.getHeaders("Set-Cookie");
        assertThat(setCookies).anyMatch(header -> header.startsWith("access_token="));
        assertThat(setCookies).anyMatch(header -> header.startsWith("refresh_token="));
    }

    @Test
    void rejectsWrongPassword() {
        doReturn(Optional.of(user)).when(userService).findByEmail(EMAIL);

        api.postAndRead(LOGIN_PATH, new LoginRequestDTO(EMAIL, "wrong-password"), Void.class, 401);
    }

    @Test
    void rejectsUnverifiedEmailEvenWithCorrectPassword() {
        user.setEmailVerified(false);
        doReturn(Optional.of(user)).when(userService).findByEmail(EMAIL);

        api.postAndRead(LOGIN_PATH, new LoginRequestDTO(EMAIL, PASSWORD), Void.class, 401);
    }

    @Test
    void rejectsUserWithoutLocalPassword() {
        user.setPasswordHash(null);
        doReturn(Optional.of(user)).when(userService).findByEmail(EMAIL);

        api.postAndRead(LOGIN_PATH, new LoginRequestDTO(EMAIL, PASSWORD), Void.class, 401);
    }

    @Test
    void rejectsUnknownUser() {
        doReturn(Optional.empty()).when(userService).findByEmail("ghost@example.org");

        api.postAndRead(LOGIN_PATH, new LoginRequestDTO("ghost@example.org", PASSWORD), Void.class, 401);
    }

    @Nested
    class OtpRegistration {

        private AuthSessionInfoDTO completeRegistration() {
            EmailVerificationOtpTestData.savedActiveOtp(otpRepository, EMAIL, OTP_CODE, otpHmacSecret);
            OtpCompleteDTO body = new OtpCompleteDTO(EMAIL, OTP_CODE, OtpPurpose.REGISTER, null);
            return api.postAndRead(OTP_COMPLETE_PATH, body, AuthSessionInfoDTO.class, 200);
        }

        @Test
        void shouldReportExistingAccountWhenEmailAlreadyRegistered() {
            UserTestData.savedUserAll(userRepository, UUID.randomUUID(), EMAIL, "Max", "Applicant");

            AuthSessionInfoDTO session = completeRegistration();

            assertThat(session.accountExisted()).as("account should be reported as existing").isTrue();
            assertThat(session.profileRequired()).as("existing account with a name needs no profile").isFalse();
        }

        @Test
        void shouldReportNewAccountWhenEmailNotRegistered() {
            AuthSessionInfoDTO session = completeRegistration();

            assertThat(session.accountExisted()).as("account should be reported as new").isFalse();
            assertThat(session.profileRequired()).as("new account without a name needs a profile").isTrue();
            assertThat(userRepository.findTopByEmailIgnoreCaseOrderByCreatedAtAsc(EMAIL)).isPresent();
        }
    }
}
