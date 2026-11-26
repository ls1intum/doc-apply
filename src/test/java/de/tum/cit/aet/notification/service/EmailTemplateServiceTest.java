package de.tum.cit.aet.notification.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.tum.cit.aet.core.constants.Language;
import de.tum.cit.aet.core.dto.PageDTO;
import de.tum.cit.aet.core.dto.PageResponseDTO;
import de.tum.cit.aet.core.exception.EmailTemplateException;
import de.tum.cit.aet.core.exception.EntityNotFoundException;
import de.tum.cit.aet.core.exception.ResourceAlreadyExistsException;
import de.tum.cit.aet.core.service.CurrentUserService;
import de.tum.cit.aet.notification.constants.EmailType;
import de.tum.cit.aet.notification.domain.EmailTemplate;
import de.tum.cit.aet.notification.dto.EmailTemplateDTO;
import de.tum.cit.aet.notification.dto.EmailTemplateOverviewDTO;
import de.tum.cit.aet.notification.dto.EmailTemplateTranslationDTO;
import de.tum.cit.aet.notification.repository.EmailTemplateRepository;
import de.tum.cit.aet.notification.service.DefaultEmailTemplateProvider.DefaultContent;
import de.tum.cit.aet.notification.service.EmailTemplateService.EmailContent;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.utility.testdata.EmailTemplateTestData;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EmailTemplateServiceTest {

    @Mock
    private EmailTemplateRepository repository;

    @Mock
    private DefaultEmailTemplateProvider defaultProvider;

    @Mock
    private CurrentUserService currentUserService;

    @InjectMocks
    private EmailTemplateService service;

    private ResearchGroup researchGroup;
    private User user;

    @BeforeEach
    void init() {
        researchGroup = new ResearchGroup();
        researchGroup.setResearchGroupId(UUID.randomUUID());
        user = new User();
        user.setUserId(UUID.randomUUID());
    }

    @Test
    void resolveContent_returnsCustom_whenRowExists() {
        EmailTemplate custom = EmailTemplateTestData.newTemplate(researchGroup, user, EmailType.APPLICATION_SENT);
        when(repository.findByResearchGroupAndEmailType(researchGroup, EmailType.APPLICATION_SENT)).thenReturn(Optional.of(custom));

        EmailContent content = service.resolveContent(researchGroup, EmailType.APPLICATION_SENT, Language.ENGLISH);

        assertThat(content.subject()).isEqualTo(custom.getSubjectEn());
        assertThat(content.bodyHtml()).isEqualTo(custom.getBodyHtmlEn());
        verify(defaultProvider, never()).load(any(), any());
    }

    @ParameterizedTest
    @CsvSource(
        delimiter = '|',
        value = {
            "Subject | <p>Body</p> | '' | <p><br></p> | Subject | <p>Body</p>",
            "Subject | <p>Body</p> | '' | <p>Text</p> | Subject | <p>Body</p>",
            "'' | <p>Body</p> | Betreff | <p><br></p> | Betreff | <p>Body</p>",
        }
    )
    void shouldFallBackToOtherLanguageWhenRecipientLanguageIsIncomplete(
        String subjectEn,
        String bodyEn,
        String subjectDe,
        String bodyDe,
        String expectedSubject,
        String expectedBody
    ) {
        EmailTemplate custom = EmailTemplateTestData.newTemplate(researchGroup, user, EmailType.APPLICATION_SENT);
        custom.setSubjectEn(subjectEn);
        custom.setBodyHtmlEn(bodyEn);
        custom.setSubjectDe(subjectDe);
        custom.setBodyHtmlDe(bodyDe);
        when(repository.findByResearchGroupAndEmailType(researchGroup, EmailType.APPLICATION_SENT)).thenReturn(Optional.of(custom));

        EmailContent content = service.resolveContent(researchGroup, EmailType.APPLICATION_SENT, Language.GERMAN);

        assertThat(content.subject()).isEqualTo(expectedSubject);
        assertThat(content.bodyHtml()).isEqualTo(expectedBody);
    }

    @Test
    void resolveContent_fallsBackToDefault_whenNoCustom() {
        when(repository.findByResearchGroupAndEmailType(researchGroup, EmailType.APPLICATION_SENT)).thenReturn(Optional.empty());
        when(defaultProvider.load(EmailType.APPLICATION_SENT, Language.ENGLISH)).thenReturn(
            new DefaultContent("Default", "<p>Default</p>")
        );

        EmailContent content = service.resolveContent(researchGroup, EmailType.APPLICATION_SENT, Language.ENGLISH);

        assertThat(content.subject()).isEqualTo("Default");
        assertThat(content.bodyHtml()).isEqualTo("<p>Default</p>");
    }

    @Test
    void resolveContent_loadsDefault_whenNoResearchGroup() {
        when(defaultProvider.load(EmailType.APPLICATION_SENT, Language.GERMAN)).thenReturn(new DefaultContent("DE", "body"));

        EmailContent content = service.resolveContent(null, EmailType.APPLICATION_SENT, Language.GERMAN);

        assertThat(content.subject()).isEqualTo("DE");
    }

    @Test
    void listMerged_emitsCustomsFirstThenDefaults_onlyForCustomizableTypes() {
        EmailTemplate custom = EmailTemplateTestData.newTemplate(researchGroup, user, EmailType.APPLICATION_SENT);
        custom.setEmailTemplateId(UUID.randomUUID());
        custom.setLastModifiedAt(LocalDateTime.now());
        when(repository.findAllByResearchGroup(researchGroup)).thenReturn(List.of(custom));
        lenient()
            .when(defaultProvider.load(any(EmailType.class), any(Language.class)))
            .thenReturn(new DefaultContent("default-subject", "default-body"));

        PageResponseDTO<EmailTemplateOverviewDTO> page = service.listMerged(researchGroup, new PageDTO(100, 0));
        List<EmailTemplateOverviewDTO> rows = List.copyOf(page.getContent());

        long customizableCount = java.util.Arrays.stream(EmailType.values()).filter(EmailType::isCustomizable).count();
        assertThat(rows).hasSize((int) customizableCount);
        assertThat(page.getTotalElements()).isEqualTo(customizableCount);
        assertThat(rows.get(0).isCustom()).isTrue();
        assertThat(rows.get(0).emailType()).isEqualTo(EmailType.APPLICATION_SENT);
        assertThat(rows.stream().filter(EmailTemplateOverviewDTO::isCustom).count()).isEqualTo(1);
        assertThat(rows.stream().map(EmailTemplateOverviewDTO::emailType)).allMatch(EmailType::isCustomizable);
    }

    @Test
    void listMerged_excludesCustomsForNonCustomizableTypes() {
        EmailTemplate strayCustom = EmailTemplateTestData.newTemplate(researchGroup, user, EmailType.RESEARCH_GROUP_APPROVED);
        strayCustom.setEmailTemplateId(UUID.randomUUID());
        strayCustom.setLastModifiedAt(LocalDateTime.now());
        when(repository.findAllByResearchGroup(researchGroup)).thenReturn(List.of(strayCustom));
        lenient()
            .when(defaultProvider.load(any(EmailType.class), any(Language.class)))
            .thenReturn(new DefaultContent("default-subject", "default-body"));

        PageResponseDTO<EmailTemplateOverviewDTO> page = service.listMerged(researchGroup, new PageDTO(100, 0));
        List<EmailTemplateOverviewDTO> rows = List.copyOf(page.getContent());

        assertThat(rows.stream().map(EmailTemplateOverviewDTO::emailType)).doesNotContain(EmailType.RESEARCH_GROUP_APPROVED);
    }

    @Test
    void createTemplate_throwsForNonCustomizableType() {
        EmailTemplateDTO dto = new EmailTemplateDTO(
            null,
            EmailType.RESEARCH_GROUP_APPROVED,
            new EmailTemplateTranslationDTO("S", "<p>B</p>"),
            new EmailTemplateTranslationDTO("S", "<p>B</p>")
        );

        assertThatThrownBy(() -> service.createTemplate(dto, researchGroup, user)).isInstanceOf(EmailTemplateException.class);

        verify(repository, never()).save(any(EmailTemplate.class));
    }

    @Test
    void createTemplate_throwsConflict_whenDuplicateExists() {
        when(repository.existsByResearchGroupAndEmailType(researchGroup, EmailType.APPLICATION_SENT)).thenReturn(true);
        EmailTemplateDTO dto = new EmailTemplateDTO(
            null,
            EmailType.APPLICATION_SENT,
            new EmailTemplateTranslationDTO("S", "<p>B</p>"),
            new EmailTemplateTranslationDTO("S", "<p>B</p>")
        );

        assertThatThrownBy(() -> service.createTemplate(dto, researchGroup, user)).isInstanceOf(ResourceAlreadyExistsException.class);

        verify(repository, never()).save(any(EmailTemplate.class));
    }

    @Test
    void getTemplate_throwsWhenMissing() {
        UUID missing = UUID.randomUUID();
        when(repository.findById(missing)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getTemplate(missing)).isInstanceOf(EntityNotFoundException.class);
    }
}
