package de.tum.cit.aet.notification.web;

import de.tum.cit.aet.core.dto.PageDTO;
import de.tum.cit.aet.core.dto.PageResponseDTO;
import de.tum.cit.aet.core.security.annotations.Professor;
import de.tum.cit.aet.core.security.annotations.ProfessorOrEmployee;
import de.tum.cit.aet.core.service.CurrentUserService;
import de.tum.cit.aet.notification.dto.EmailTemplateDTO;
import de.tum.cit.aet.notification.dto.EmailTemplateOverviewDTO;
import de.tum.cit.aet.notification.service.EmailTemplateService;
import java.util.UUID;
import lombok.AllArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/email-templates")
@AllArgsConstructor
public class EmailTemplateResource {

    private final EmailTemplateService emailTemplateService;
    private final CurrentUserService currentUserService;

    /**
     * Returns the unified list of templates for the current user's research group:
     * customs first (most recently modified), then defaults loaded from resource files.
     *
     * @param page zero-based page index (default: 0)
     * @param size the size of the page (default: 20)
     * @return the merged page of customs and defaults
     */
    @ProfessorOrEmployee
    @GetMapping
    public ResponseEntity<PageResponseDTO<EmailTemplateOverviewDTO>> getTemplates(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        PageDTO pageDTO = new PageDTO(size, page);
        return ResponseEntity.ok(emailTemplateService.listMerged(currentUserService.getResearchGroupIfMember(), pageDTO));
    }

    /**
     * Retrieves a single custom email template by its ID.
     *
     * @param templateId the ID of the custom template
     * @return the matching custom template
     */
    @ProfessorOrEmployee
    @GetMapping("/{templateId}")
    public ResponseEntity<EmailTemplateDTO> getTemplate(@PathVariable UUID templateId) {
        return ResponseEntity.ok(emailTemplateService.getTemplate(templateId));
    }

    /**
     * Updates an existing custom template's content. The {@code emailType} may be changed to
     * any other customizable type that does not yet have a custom row in this research group.
     *
     * @param emailTemplateDTO the updated template payload (must include the existing id)
     * @return the persisted template
     */
    @ProfessorOrEmployee
    @PutMapping
    public ResponseEntity<EmailTemplateDTO> updateTemplate(@RequestBody EmailTemplateDTO emailTemplateDTO) {
        return ResponseEntity.ok(emailTemplateService.updateTemplate(emailTemplateDTO));
    }

    /**
     * Creates a new custom template for the current user's research group.
     * Returns 409 Conflict if a custom already exists for the (group, emailType) pair.
     *
     * @param emailTemplateDTO the template payload to persist
     * @return the created template wrapped in a 201 response
     */
    @ProfessorOrEmployee
    @PostMapping
    public ResponseEntity<EmailTemplateDTO> createTemplate(@RequestBody EmailTemplateDTO emailTemplateDTO) {
        EmailTemplateDTO created = emailTemplateService.createTemplate(
            emailTemplateDTO,
            currentUserService.getResearchGroupIfMember(),
            currentUserService.getUser()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Deletes a custom template. The system default reappears in the list automatically.
     *
     * @param templateId the ID of the custom template to delete
     * @return an empty 204 response
     */
    @Professor
    @DeleteMapping("/{templateId}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable UUID templateId) {
        emailTemplateService.deleteTemplate(templateId);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }
}
