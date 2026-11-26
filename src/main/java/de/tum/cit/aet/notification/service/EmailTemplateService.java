package de.tum.cit.aet.notification.service;

import de.tum.cit.aet.core.constants.Language;
import de.tum.cit.aet.core.dto.PageDTO;
import de.tum.cit.aet.core.dto.PageResponseDTO;
import de.tum.cit.aet.core.exception.EmailTemplateException;
import de.tum.cit.aet.core.exception.EntityNotFoundException;
import de.tum.cit.aet.core.exception.ResourceAlreadyExistsException;
import de.tum.cit.aet.core.service.CurrentUserService;
import de.tum.cit.aet.core.util.HtmlSanitizer;
import de.tum.cit.aet.core.util.TemplateUtil;
import de.tum.cit.aet.notification.constants.EmailType;
import de.tum.cit.aet.notification.domain.EmailTemplate;
import de.tum.cit.aet.notification.dto.EmailTemplateDTO;
import de.tum.cit.aet.notification.dto.EmailTemplateOverviewDTO;
import de.tum.cit.aet.notification.dto.EmailTemplateTranslationDTO;
import de.tum.cit.aet.notification.repository.EmailTemplateRepository;
import de.tum.cit.aet.notification.service.DefaultEmailTemplateProvider.DefaultContent;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.AllArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.Jsoup;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
@AllArgsConstructor
public class EmailTemplateService {

    /**
     * Resolved subject + body for a (group, type, language) lookup.
     */
    public record EmailContent(String subject, String bodyHtml) {}

    private final EmailTemplateRepository emailTemplateRepository;
    private final DefaultEmailTemplateProvider defaultProvider;
    private final CurrentUserService currentUserService;

    /**
     * Resolves the subject + body to use for the given research group, email type, and language.
     * Returns the customised content if a row exists, otherwise the system default loaded from resource files.
     *
     * @param researchGroup the research group whose customisations should be considered (may be {@code null} for system-wide emails)
     * @param emailType     the email type whose content is needed
     * @param language      the language to render
     * @return the resolved subject and body
     */
    public EmailContent resolveContent(ResearchGroup researchGroup, EmailType emailType, Language language) {
        if (researchGroup != null) {
            EmailTemplate custom = emailTemplateRepository.findByResearchGroupAndEmailType(researchGroup, emailType).orElse(null);
            if (custom != null) {
                return contentFromCustom(custom, language);
            }
        }
        DefaultContent def = defaultProvider.load(emailType, language);
        return new EmailContent(def.subject(), def.bodyHtml());
    }

    /**
     * Returns the merged page of templates for the research group: customs first (most recent first),
     * then defaults loaded from resource files. Only EmailTypes flagged {@code customizable} are
     * included — system-only types (e.g. data deletion warnings, research group approval) are hidden.
     * Content is converted to Quill-mention form for the editor.
     *
     * @param researchGroup the research group whose templates should be listed
     * @param pageDTO       the requested page (size + zero-based page index)
     * @return the merged page (content + total count) of customs followed by defaults
     */
    public PageResponseDTO<EmailTemplateOverviewDTO> listMerged(ResearchGroup researchGroup, PageDTO pageDTO) {
        // 1) Load all customs for this research group, indexed by email type, restricted to customizable types.
        Map<EmailType, EmailTemplate> customsByType = emailTemplateRepository
            .findAllByResearchGroup(researchGroup)
            .stream()
            .filter(template -> template.getEmailType().isCustomizable())
            .collect(Collectors.toMap(EmailTemplate::getEmailType, Function.identity()));

        // 2) Build the custom rows ordered by most recently modified first.
        Stream<EmailTemplateOverviewDTO> customRows = customsByType
            .values()
            .stream()
            .sorted(Comparator.comparing(EmailTemplate::getLastModifiedAt, Comparator.nullsLast(Comparator.reverseOrder())))
            .map(this::toOverviewCustom);

        // 3) Build the default rows for every customizable email type without a custom, ordered alphabetically.
        Stream<EmailTemplateOverviewDTO> defaultRows = Arrays.stream(EmailType.values())
            .filter(EmailType::isCustomizable)
            .filter(type -> !customsByType.containsKey(type))
            .sorted(Comparator.comparing(EmailType::name))
            .map(this::toOverviewDefault);

        // 4) Concatenate: customs come first, then defaults.
        List<EmailTemplateOverviewDTO> merged = Stream.concat(customRows, defaultRows).toList();

        // 5) Slice the merged list according to the requested page.
        int fromIndex = Math.min(pageDTO.pageNumber() * pageDTO.pageSize(), merged.size());
        int toIndex = Math.min(fromIndex + pageDTO.pageSize(), merged.size());
        return new PageResponseDTO<>(merged.subList(fromIndex, toIndex), merged.size());
    }

    /**
     * Retrieves a custom template by its ID. Throws if the template does not exist.
     *
     * @param templateId the ID of the custom template
     * @return the matching template as a DTO
     */
    public EmailTemplateDTO getTemplate(UUID templateId) {
        EmailTemplate template = findById(templateId);
        currentUserService.assertAccessTo(template);
        return toDTOForEditing(template);
    }

    /**
     * Creates a new custom template for the (group, emailType) pair.
     *
     * @param dto           the template payload to persist
     * @param researchGroup the owning research group
     * @param createdBy     the user creating the customisation
     * @return the persisted template as a DTO
     * @throws ResourceAlreadyExistsException if a custom already exists for this (group, emailType) pair
     * @throws EmailTemplateException         if the EmailType is not customizable per research group
     */
    public EmailTemplateDTO createTemplate(EmailTemplateDTO dto, ResearchGroup researchGroup, User createdBy) {
        // 1) Validate that the email type is allowed to be customised per research group.
        if (!dto.emailType().isCustomizable()) {
            throw new EmailTemplateException(String.format("EmailType %s cannot be customised per research group", dto.emailType()));
        }
        // 2) Reject if a custom row already exists for this (group, emailType) pair.
        if (emailTemplateRepository.existsByResearchGroupAndEmailType(researchGroup, dto.emailType())) {
            throw new ResourceAlreadyExistsException(
                String.format("Custom template for emailType %s already exists in this research group", dto.emailType())
            );
        }

        // 3) Build the new entity with the validated metadata and sanitised content.
        EmailTemplate template = new EmailTemplate();
        template.setResearchGroup(researchGroup);
        template.setCreatedBy(createdBy);
        template.setEmailType(dto.emailType());
        applyContent(template, dto);

        // 4) Persist; the unique constraint guards against races that the existence check missed.
        try {
            return toDTOForEditing(emailTemplateRepository.save(template));
        } catch (DataIntegrityViolationException e) {
            throw new ResourceAlreadyExistsException(
                String.format("Custom template for emailType %s already exists in this research group", dto.emailType())
            );
        }
    }

    /**
     * Updates content of an existing custom template. EmailType may be changed to another customizable type
     * as long as no other custom row already exists for the new (group, emailType) pair.
     *
     * @param dto the updated template payload (must include the existing id)
     * @return the persisted template as a DTO
     * @throws ResourceAlreadyExistsException if changing the EmailType would collide with an existing custom
     * @throws EmailTemplateException         if the new EmailType is not customizable
     */
    public EmailTemplateDTO updateTemplate(EmailTemplateDTO dto) {
        // 1) Load the existing custom and verify the caller may modify it.
        EmailTemplate template = findById(dto.emailTemplateId());
        currentUserService.assertAccessTo(template);

        // 2) If the email type is being changed, validate the new type and ensure it does not collide.
        if (dto.emailType() != template.getEmailType()) {
            if (!dto.emailType().isCustomizable()) {
                throw new EmailTemplateException(String.format("EmailType %s cannot be customised per research group", dto.emailType()));
            }
            if (emailTemplateRepository.existsByResearchGroupAndEmailType(template.getResearchGroup(), dto.emailType())) {
                throw new ResourceAlreadyExistsException(
                    String.format("Custom template for emailType %s already exists in this research group", dto.emailType())
                );
            }
            template.setEmailType(dto.emailType());
        }

        // 3) Apply sanitised content and bump the last-modified timestamp.
        applyContent(template, dto);
        template.setLastModifiedAt(java.time.LocalDateTime.now(java.time.ZoneOffset.UTC));

        // 4) Persist; the unique constraint guards against races that the existence check missed.
        try {
            return toDTOForEditing(emailTemplateRepository.save(template));
        } catch (DataIntegrityViolationException e) {
            throw new ResourceAlreadyExistsException(
                String.format("Custom template for emailType %s already exists in this research group", dto.emailType())
            );
        }
    }

    /**
     * Deletes a custom template. The system default (loaded from resource files) takes its place automatically.
     *
     * @param templateId the ID of the custom template to delete
     */
    public void deleteTemplate(UUID templateId) {
        EmailTemplate toDelete = findById(templateId);
        currentUserService.assertAccessTo(toDelete);
        emailTemplateRepository.delete(toDelete);
    }

    /**
     * Loads an {@link EmailTemplate} by its ID or throws if it is missing.
     *
     * @param id the template ID
     * @return the matching template
     * @throws EntityNotFoundException if no template exists with this ID
     */
    private EmailTemplate findById(UUID id) {
        return emailTemplateRepository.findById(id).orElseThrow(() -> EntityNotFoundException.forId("EmailTemplate", id));
    }

    /**
     * Picks the language-specific subject and body off a custom {@link EmailTemplate}. A template whose recipient language
     * was left empty would otherwise send an email without subject or text, so an incomplete language falls back to the
     * other one, as a whole when the other language is complete and field by field when neither is.
     *
     * @param template the custom template
     * @param language the language to extract
     * @return the resolved {@link EmailContent}
     */
    private EmailContent contentFromCustom(EmailTemplate template, Language language) {
        EmailContent english = new EmailContent(template.getSubjectEn(), template.getBodyHtmlEn());
        EmailContent german = new EmailContent(template.getSubjectDe(), template.getBodyHtmlDe());
        EmailContent preferred = language == Language.GERMAN ? german : english;
        EmailContent other = language == Language.GERMAN ? english : german;
        if (isComplete(preferred) || !isComplete(other)) {
            return new EmailContent(
                StringUtils.isBlank(preferred.subject()) ? other.subject() : preferred.subject(),
                isBlankHtml(preferred.bodyHtml()) ? other.bodyHtml() : preferred.bodyHtml()
            );
        }
        return other;
    }

    /**
     * Tells whether a language of a template has both a subject and a body.
     *
     * @param content the subject and body of one language
     * @return whether neither is blank
     */
    private static boolean isComplete(EmailContent content) {
        return !StringUtils.isBlank(content.subject()) && !isBlankHtml(content.bodyHtml());
    }

    /**
     * Tells whether editor HTML shows no text, such as the empty paragraph an untouched editor stores.
     *
     * @param html the stored body
     * @return whether the body has no visible text
     */
    private static boolean isBlankHtml(String html) {
        return html == null || Jsoup.parse(html).text().isBlank();
    }

    /**
     * Maps a custom {@link EmailTemplate} to an overview DTO with both translations converted to Quill-mention form.
     *
     * @param template the custom template
     * @return the overview DTO with {@code isCustom = true}
     */
    private EmailTemplateOverviewDTO toOverviewCustom(EmailTemplate template) {
        return new EmailTemplateOverviewDTO(
            template.getEmailTemplateId(),
            template.getEmailType(),
            true,
            new EmailTemplateTranslationDTO(template.getSubjectEn(), toQuill(template.getBodyHtmlEn())),
            new EmailTemplateTranslationDTO(template.getSubjectDe(), toQuill(template.getBodyHtmlDe())),
            template.getCreatedBy() != null ? template.getCreatedBy().getFirstName() : null,
            template.getCreatedBy() != null ? template.getCreatedBy().getLastName() : null,
            template.getLastModifiedAt() != null ? template.getLastModifiedAt().toInstant(java.time.ZoneOffset.UTC) : null
        );
    }

    /**
     * Builds an overview DTO from the system default content for a given email type.
     *
     * @param emailType the email type to load defaults for
     * @return the overview DTO with {@code isCustom = false}
     */
    private EmailTemplateOverviewDTO toOverviewDefault(EmailType emailType) {
        DefaultContent englishContent = defaultProvider.load(emailType, Language.ENGLISH);
        DefaultContent germanContent = defaultProvider.load(emailType, Language.GERMAN);
        return new EmailTemplateOverviewDTO(
            null,
            emailType,
            false,
            new EmailTemplateTranslationDTO(englishContent.subject(), toQuill(englishContent.bodyHtml())),
            new EmailTemplateTranslationDTO(germanContent.subject(), toQuill(germanContent.bodyHtml())),
            null,
            null,
            null
        );
    }

    /**
     * Maps a custom template to a full DTO suitable for the edit page (Quill-mention form).
     *
     * @param template the custom template
     * @return the DTO carrying both translations
     */
    private EmailTemplateDTO toDTOForEditing(EmailTemplate template) {
        return new EmailTemplateDTO(
            template.getEmailTemplateId(),
            template.getEmailType(),
            new EmailTemplateTranslationDTO(template.getSubjectEn(), toQuill(template.getBodyHtmlEn())),
            new EmailTemplateTranslationDTO(template.getSubjectDe(), toQuill(template.getBodyHtmlDe()))
        );
    }

    /**
     * Writes the DTO's English and German content onto the entity, sanitising and converting Quill mentions to FreeMarker.
     *
     * @param template the entity to update
     * @param dto      the DTO carrying the new content (both translations are required)
     * @throws EmailTemplateException if either translation is missing
     */
    private void applyContent(EmailTemplate template, EmailTemplateDTO dto) {
        if (dto.english() == null || dto.german() == null) {
            throw new EmailTemplateException("Both English and German content are required");
        }
        template.setSubjectEn(dto.english().subject());
        template.setBodyHtmlEn(toFreemarker(dto.english().body()));
        template.setSubjectDe(dto.german().subject());
        template.setBodyHtmlDe(toFreemarker(dto.german().body()));
    }

    /**
     * Sanitises Quill-mention HTML and converts the mention spans into FreeMarker placeholders for storage.
     *
     * @param html the editor-side HTML with Quill mention spans
     * @return the FreeMarker-ready HTML
     */
    private static String toFreemarker(String html) {
        String sanitized = HtmlSanitizer.sanitizeQuillMentions(html);
        return TemplateUtil.convertQuillMentionsToFreemarker(sanitized);
    }

    /**
     * Converts FreeMarker placeholders back into Quill-mention spans for the editor.
     *
     * @param html the stored HTML with FreeMarker placeholders
     * @return the Quill-mention-ready HTML
     */
    private static String toQuill(String html) {
        return TemplateUtil.convertFreemarkerToQuillMentions(html);
    }
}
