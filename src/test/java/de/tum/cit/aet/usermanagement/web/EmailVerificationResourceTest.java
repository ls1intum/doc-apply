package de.tum.cit.aet.usermanagement.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.notification.service.AsyncEmailSender;
import de.tum.cit.aet.notification.service.mail.Email;
import de.tum.cit.aet.usermanagement.domain.EmailVerificationOtp;
import de.tum.cit.aet.usermanagement.repository.EmailVerificationOtpRepository;
import de.tum.cit.aet.usermanagement.service.EmailVerificationService;
import de.tum.cit.aet.utility.DatabaseCleaner;
import de.tum.cit.aet.utility.MvcTestClient;
import de.tum.cit.aet.utility.security.JwtPostProcessors;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Integration tests for the {@link de.tum.cit.aet.usermanagement.web.EmailVerificationResource}. The send-code flow
 * asserts the resend cooldown through the persisted OTP rows, since the code itself is only delivered by email. The
 * registration confirmation flow verifies the queued {@link Email} through a mocked {@link AsyncEmailSender}, since it
 * has no database side effect.
 */
public class EmailVerificationResourceTest extends AbstractResourceTest {

    private static final String SEND_CODE_PATH = "/api/auth/send-code";
    private static final String SEND_REGISTRATION_PATH = "/api/auth/send-registration-email";
    private static final String EMAIL = "applicant@example.org";
    private static final int ACCEPTED = 202;
    private static final int BAD_REQUEST = 400;
    private static final int UNAUTHORIZED = 401;

    @Autowired
    MvcTestClient api;

    @Autowired
    EmailVerificationOtpRepository otpRepository;

    @Autowired
    EmailVerificationService emailVerificationService;

    @Autowired
    DatabaseCleaner databaseCleaner;

    private AsyncEmailSender asyncEmailSenderMock;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
        asyncEmailSenderMock = Mockito.mock(AsyncEmailSender.class);
        ReflectionTestUtils.setField(emailVerificationService, "asyncEmailSender", asyncEmailSenderMock);
        api.withoutPostProcessors();
    }

    @Nested
    class SendCode {

        private void sendCode(String email, boolean registration) {
            api.postAndRead(SEND_CODE_PATH, new EmailVerificationResource.SendCodeRequest(email, registration), Void.class, ACCEPTED);
        }

        @Test
        void persistsOtpWhenNoRecentCodeExists() {
            sendCode(EMAIL, true);

            assertThat(otpRepository.count()).isEqualTo(1);
        }

        @Test
        void doesNotPersistNewCodeWithinResendCooldown() {
            sendCode(EMAIL, true);
            sendCode(EMAIL, true);

            // The second request is inside the resend cooldown, so no additional OTP is stored.
            assertThat(otpRepository.count()).isEqualTo(1);
        }

        @Test
        void persistsNewCodeAfterCooldownElapses() {
            sendCode(EMAIL, true);
            EmailVerificationOtp otp = otpRepository.findAll().getFirst();
            otp.setCreatedAt(Instant.now().minusSeconds(120));
            otpRepository.saveAndFlush(otp);

            sendCode(EMAIL, true);

            assertThat(otpRepository.count()).isEqualTo(2);
        }

        @Test
        void doesNotPersistCodeForUnknownEmailOnLoginFlow() {
            sendCode("nobody@example.org", false);

            assertThat(otpRepository.count()).isZero();
        }
    }

    @Nested
    class SendRegistrationEmail {

        /**
         * Sends an authenticated registration-email request and captures the single queued email.
         *
         * @param email the address submitted in the request body
         * @return a captor holding the queued {@link Email}
         */
        private ArgumentCaptor<Email> sendRegistrationEmail(String email) {
            api
                .with(JwtPostProcessors.jwtUser(UUID.randomUUID(), "ROLE_APPLICANT"))
                .postAndRead(SEND_REGISTRATION_PATH, new EmailVerificationResource.SendCodeRequest(email, true), Void.class, ACCEPTED);

            ArgumentCaptor<Email> emailCaptor = ArgumentCaptor.forClass(Email.class);
            verify(asyncEmailSenderMock, times(1)).sendAsync(emailCaptor.capture());
            return emailCaptor;
        }

        @ParameterizedTest
        @CsvSource({ "applicant@example.org, applicant@example.org", "Applicant@Example.ORG, applicant@example.org" })
        void shouldQueueConfirmationEmailWithNormalizedRecipientWhenAddressIsValid(String requestedEmail, String expectedRecipient) {
            Email actual = sendRegistrationEmail(requestedEmail).getValue();

            assertThat(actual.getRecipients()).isEqualTo(expectedRecipient);
            assertThat(actual.getCustomSubject()).isEqualTo("Welcome to TUMApply!");
            assertThat(actual.getCustomBody()).contains("Welcome to TUMApply");
            assertThat(actual.isSendAlways()).isTrue();
        }

        @ParameterizedTest
        @ValueSource(strings = { " ", "not-an-email", "plainaddress" })
        void shouldRejectAndNotQueueEmailWhenAddressIsInvalid(String invalidEmail) {
            api
                .with(JwtPostProcessors.jwtUser(UUID.randomUUID(), "ROLE_APPLICANT"))
                .postAndRead(
                    SEND_REGISTRATION_PATH,
                    new EmailVerificationResource.SendCodeRequest(invalidEmail, true),
                    Void.class,
                    BAD_REQUEST
                );

            verify(asyncEmailSenderMock, never()).sendAsync(any());
        }

        @Test
        void shouldRejectAndNotQueueEmailWhenRequestIsUnauthenticated() {
            api.postAndRead(SEND_REGISTRATION_PATH, new EmailVerificationResource.SendCodeRequest(EMAIL, true), Void.class, UNAUTHORIZED);

            verify(asyncEmailSenderMock, never()).sendAsync(any());
        }
    }
}
