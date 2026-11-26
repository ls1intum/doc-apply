package de.tum.cit.aet.notification.service;

import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.tum.cit.aet.core.constants.Language;
import de.tum.cit.aet.core.documents.service.DocumentService;
import de.tum.cit.aet.notification.constants.EmailType;
import de.tum.cit.aet.notification.service.EmailTemplateService.EmailContent;
import de.tum.cit.aet.notification.service.mail.Email;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class EmailServiceTest {

    @Mock
    private TemplateProcessingService templateProcessingService;

    @Mock
    private ObjectProvider<JavaMailSender> mailSenderProvider;

    @Mock
    private DocumentService documentService;

    @Mock
    private EmailSettingService emailSettingService;

    @Mock
    private EmailTemplateService emailTemplateService;

    @Mock
    private JavaMailSender mailSender;

    @InjectMocks
    private EmailService emailService;

    private Email.EmailBuilder baseEmail;

    @BeforeEach
    void init() {
        ReflectionTestUtils.setField(emailService, "from", "noreply@test.local");
        ReflectionTestUtils.setField(emailService, "fromName", "Test");
        baseEmail = Email.builder().to(user("to@test.local")).emailType(EmailType.APPLICATION_SENT).researchGroup(new ResearchGroup());
    }

    @Test
    void send_resolvesContentFromTemplateService_whenNoCustomBodyOrSubject() {
        ReflectionTestUtils.setField(emailService, "emailEnabled", false);
        EmailContent content = new EmailContent("Hello", "<p>body</p>");
        when(
            emailTemplateService.resolveContent(any(ResearchGroup.class), eq(EmailType.APPLICATION_SENT), eq(Language.ENGLISH))
        ).thenReturn(content);
        when(templateProcessingService.renderSubject(eq("Hello"), any())).thenReturn("rendered-subject");
        when(templateProcessingService.renderTemplate(eq(Language.ENGLISH), eq("<p>body</p>"), any(), any(), eq(true))).thenReturn(
            "rendered-body"
        );
        lenient().when(emailSettingService.canNotify(any(), any())).thenReturn(true);

        Email email = baseEmail.content(new Object()).build();
        ReflectionTestUtils.invokeMethod(emailService, "send", email);

        verify(emailTemplateService).resolveContent(any(ResearchGroup.class), eq(EmailType.APPLICATION_SENT), eq(Language.ENGLISH));
        verify(templateProcessingService).renderSubject(eq("Hello"), any());
        verify(templateProcessingService).renderTemplate(eq(Language.ENGLISH), eq("<p>body</p>"), any(), any(), eq(true));
    }

    @Test
    void send_skipsTemplateLookup_whenCustomSubjectAndBodyAreSet() {
        ReflectionTestUtils.setField(emailService, "emailEnabled", false);
        when(templateProcessingService.renderSubject(eq("Custom"), any())).thenReturn("Custom");
        when(templateProcessingService.renderRawTemplate(eq(Language.ENGLISH), anyString(), any(), eq(true))).thenReturn("body");
        lenient().when(emailSettingService.canNotify(any(), any())).thenReturn(true);

        Email email = baseEmail.customSubject("Custom").customBody("<p>x</p>").build();
        ReflectionTestUtils.invokeMethod(emailService, "send", email);

        verify(emailTemplateService, org.mockito.Mockito.never()).resolveContent(any(), any(), any());
    }

    @Test
    void send_doesNotThrow_whenNoRecipients() {
        ReflectionTestUtils.setField(emailService, "emailEnabled", true);
        when(mailSenderProvider.getIfAvailable()).thenReturn(mailSender);
        MimeMessage message = new JavaMailSenderImpl().createMimeMessage();
        when(mailSender.createMimeMessage()).thenReturn(message);
        lenient().when(emailSettingService.canNotify(any(), any())).thenReturn(false);
        when(emailTemplateService.resolveContent(any(), any(), any())).thenReturn(new EmailContent("s", "b"));
        when(templateProcessingService.renderSubject(eq("s"), any())).thenReturn("s");
        when(templateProcessingService.renderTemplate(eq(Language.ENGLISH), eq("b"), any(), any(), eq(true))).thenReturn("b");

        Email email = baseEmail.content(new Object()).build();

        assertThatNoException().isThrownBy(() -> ReflectionTestUtils.invokeMethod(emailService, "send", email));
    }

    @Test
    void send_omitsNotificationSettingsLink_whenEmailTypeIsMandatory() {
        ReflectionTestUtils.setField(emailService, "emailEnabled", false);
        when(emailTemplateService.resolveContent(any(), eq(EmailType.RESEARCH_GROUP_APPROVED), any())).thenReturn(
            new EmailContent("s", "b")
        );
        when(templateProcessingService.renderSubject(eq("s"), any())).thenReturn("s");
        when(templateProcessingService.renderTemplate(eq(Language.ENGLISH), eq("b"), any(), any(), eq(false))).thenReturn("b");
        lenient().when(emailSettingService.canNotify(any(), any())).thenReturn(true);

        Email email = baseEmail.emailType(EmailType.RESEARCH_GROUP_APPROVED).content(new Object()).build();
        ReflectionTestUtils.invokeMethod(emailService, "send", email);

        verify(templateProcessingService).renderTemplate(eq(Language.ENGLISH), eq("b"), any(), any(), eq(false));
    }

    private static User user(String email) {
        User u = new User();
        u.setEmail(email);
        return u;
    }
}
