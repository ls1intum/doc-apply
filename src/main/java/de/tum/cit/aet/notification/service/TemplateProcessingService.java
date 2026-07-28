package de.tum.cit.aet.notification.service;

import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.core.constants.Language;
import de.tum.cit.aet.core.exception.TemplateProcessingException;
import de.tum.cit.aet.core.service.SiteSettingService;
import de.tum.cit.aet.core.util.HtmlSanitizer;
import de.tum.cit.aet.interview.domain.InterviewSlot;
import de.tum.cit.aet.interview.domain.Interviewee;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.notification.constants.SignoffType;
import de.tum.cit.aet.notification.constants.TemplateVariable;
import de.tum.cit.aet.notification.dto.DataExportEmailContextDTO;
import de.tum.cit.aet.notification.dto.JobPublicationEmailContextDTO;
import de.tum.cit.aet.notification.dto.ReferenceLetterContextDTO;
import de.tum.cit.aet.notification.dto.ResearchGroupEmailContextDTO;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import freemarker.core.TemplateClassResolver;
import freemarker.template.Configuration;
import freemarker.template.Template;
import freemarker.template.TemplateException;
import java.io.IOException;
import java.io.StringReader;
import java.io.StringWriter;
import java.util.HashMap;
import java.util.Map;
import lombok.NonNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class TemplateProcessingService {

    private static final String DOCUMENTATION_URL = "https://ls1intum.github.io/doc-apply/";
    private static final String EMAIL_COMPONENTS_IMPORT = "<#import \"base/email-components.ftl\" as ui>" + System.lineSeparator();
    private final Configuration freemarkerConfig;
    private final SiteSettingService siteSettingService;
    private static final String BASE_RAW_TEMPLATE = "base/raw.ftl";

    @Value("${aet.client.url}")
    private String url;

    public TemplateProcessingService(Configuration freemarkerConfig, SiteSettingService siteSettingService) {
        this.freemarkerConfig = freemarkerConfig;
        this.siteSettingService = siteSettingService;
        // Prevent Server-Side Template Injection (SSTI) by disabling the ?new built-in,
        // which would otherwise allow instantiation of arbitrary Java classes (e.g.
        // freemarker.template.utility.Execute) from user-supplied email templates.
        freemarkerConfig.setNewBuiltinClassResolver(TemplateClassResolver.ALLOWS_NOTHING_RESOLVER);
    }

    /**
     * Renders a raw subject string using FreeMarker variables.
     *
     * @param rawSubject the raw subject string
     * @param content    the domain object for variable binding
     * @return the rendered and prefixed subject line
     */
    public String renderSubject(String rawSubject, Object content) {
        try {
            Map<String, Object> dataModel = content == null ? new HashMap<>() : createDataModel(content);
            dataModel.put(TemplateVariable.SITE_NAME.getValue(), siteSettingService.getSiteName());
            // Render subject through Freemarker string template
            Template subjectTemplate = new Template("subject", new StringReader(rawSubject), freemarkerConfig);
            String renderedSubject = render(subjectTemplate, dataModel);
            return siteSettingService.getSiteName() + " - " + renderedSubject;
        } catch (IOException ex) {
            throw new TemplateProcessingException("Failed to render subject template", ex);
        }
    }

    /**
     * Renders the HTML email body using FreeMarker and applies layout formatting.
     * No sign-off is appended; use {@link #renderTemplate(Language, String, Object, SignoffType)}
     * to have the layout auto-attach a sign-off.
     *
     * @param language the email language
     * @param bodyHtml the raw template body (FreeMarker source)
     * @param content  the domain object (e.g. Application, Job) for variable binding
     * @return the fully rendered HTML email body
     * @throws TemplateProcessingException if template parsing or rendering fails
     */
    public String renderTemplate(@NonNull Language language, @NonNull String bodyHtml, @NonNull Object content) {
        return renderTemplate(language, bodyHtml, content, SignoffType.NONE);
    }

    /**
     * Renders the HTML email body using FreeMarker and applies layout formatting,
     * with the layout auto-appending the requested sign-off variant.
     *
     * @param language the email language
     * @param bodyHtml the raw template body (FreeMarker source)
     * @param content  the domain object (e.g. Application, Job) for variable binding
     * @param signoff  which sign-off the layout should append after the body
     * @return the fully rendered HTML email body
     * @throws TemplateProcessingException if template parsing or rendering fails
     */
    public String renderTemplate(
        @NonNull Language language,
        @NonNull String bodyHtml,
        @NonNull Object content,
        @NonNull SignoffType signoff
    ) {
        try {
            Map<String, Object> dataModel = createDataModel(content);
            addMetaData(language, dataModel);

            Template inlineTemplate = new Template("inline", new StringReader(asHtmlTemplate(bodyHtml)), freemarkerConfig);

            String htmlBody = render(inlineTemplate, dataModel);
            return renderLayout(language, htmlBody, false, signoff, dataModel);
        } catch (IOException ex) {
            throw new TemplateProcessingException("Failed to process inline FreeMarker template for language: " + language, ex);
        }
    }

    private String asHtmlTemplate(String html) {
        return "<#ftl output_format=\"HTML\">" + System.lineSeparator() + EMAIL_COMPONENTS_IMPORT + html;
    }

    /**
     * Wraps raw HTML content in the base layout template, without appending a sign-off.
     *
     * @param language the language for metadata injection
     * @param html     the raw HTML to wrap
     * @return the wrapped and sanitized HTML
     */
    public String renderRawTemplate(@NonNull Language language, String html) {
        return renderRawTemplate(language, html, SignoffType.NONE);
    }

    /**
     * Wraps raw HTML content in the base layout template and asks the layout to append
     * the requested sign-off variant.
     *
     * @param language the language for metadata injection
     * @param html     the raw HTML to wrap
     * @param signoff  which sign-off the layout should append after the body
     * @return the wrapped and sanitized HTML
     */
    public String renderRawTemplate(@NonNull Language language, String html, @NonNull SignoffType signoff) {
        return renderLayout(language, html, true, signoff, null);
    }

    /**
     * Renders HTML inside the base layout template, with optional sanitization,
     * and asks the layout to render the given sign-off after the body.
     *
     * @param language       the email language
     * @param html           the raw body HTML
     * @param sanitize       whether to sanitize the HTML
     * @param signoff        the sign-off variant to append (NONE for no sign-off)
     * @param dataModelSeed  optional data model produced by the inline render (carries
     *                       template variables like {@code RESEARCH_GROUP_NAME} that the
     *                       sign-off macro may reference); may be {@code null}
     * @return fully rendered HTML including layout
     * @throws TemplateProcessingException if layout template rendering fails
     */
    private String renderLayout(Language language, String html, boolean sanitize, SignoffType signoff, Map<String, Object> dataModelSeed) {
        try {
            Template layout = freemarkerConfig.getTemplate(BASE_RAW_TEMPLATE);

            Map<String, Object> model = dataModelSeed == null ? new HashMap<>() : new HashMap<>(dataModelSeed);
            model.put("bodyHtml", sanitize ? HtmlSanitizer.sanitize(html) : html);
            model.put("SIGNOFF_TYPE", signoff.getValue());
            addMetaData(language, model);

            return render(layout, model);
        } catch (IOException ex) {
            throw new TemplateProcessingException("Failed to load raw FreeMarker template", ex);
        }
    }

    /**
     * Processes a FreeMarker template using the given data model.
     *
     * @param template  the FreeMarker template
     * @param dataModel the data model used for rendering
     * @return the rendered HTML as a string
     * @throws TemplateProcessingException if rendering fails
     */
    private String render(Template template, Map<String, Object> dataModel) {
        try (StringWriter writer = new StringWriter()) {
            template.process(dataModel, writer);
            return writer.toString();
        } catch (IOException | TemplateException ex) {
            throw new TemplateProcessingException("Failed to render FreeMarker template '" + template.getName() + "'", ex);
        }
    }

    /**
     * Builds the data model used in templates from the provided domain object.
     *
     * @param content the object to extract data from (Application, Job, or
     *                ResearchGroup)
     * @return a data model for template binding
     * @throws TemplateProcessingException if the content type is unsupported
     */
    private Map<String, Object> createDataModel(Object content) {
        Map<String, Object> dataModel = new HashMap<>();
        switch (content) {
            case Application application -> addApplicationData(dataModel, application);
            case Job job -> addJobData(dataModel, job);
            case ResearchGroup researchGroup -> addResearchGroupData(dataModel, researchGroup);
            case InterviewSlot slot -> addInterviewSlotData(dataModel, slot);
            case ResearchGroupEmailContextDTO ctx -> addResearchGroupContextData(dataModel, ctx);
            case Interviewee interviewee -> addIntervieweeData(dataModel, interviewee);
            case DataExportEmailContextDTO ctx -> addDataExportContextData(dataModel, ctx);
            case JobPublicationEmailContextDTO ctx -> addJobPublicationContextData(dataModel, ctx);
            case ReferenceLetterContextDTO ctx -> addReferenceLetterInvitationContextData(dataModel, ctx);
            case User user -> addUserData(dataModel, user);
            default -> throw new TemplateProcessingException("Unsupported content type: " + content.getClass().getName());
        }
        return dataModel;
    }

    /**
     * Adds application-related variables to the template data model.
     *
     * @param dataModel   the data model map
     * @param application the application object
     */
    private void addApplicationData(Map<String, Object> dataModel, Application application) {
        User applicant = application.getApplicant().getUser();
        dataModel.put(TemplateVariable.APPLICANT_FIRST_NAME.getValue(), applicant.getFirstName());
        dataModel.put(TemplateVariable.APPLICANT_LAST_NAME.getValue(), applicant.getLastName());

        String applicationLink =
            url + "/evaluation/application?sortBy=appliedAt&sortDir=DESC&applicationId=" + application.getApplicationId();
        dataModel.put(TemplateVariable.APPLICATION_LINK.getValue(), applicationLink);

        addJobData(dataModel, application.getJob());
    }

    /**
     * Adds job-related variables to the template data model.
     *
     * @param dataModel the data model map
     * @param job       the job object
     */
    private void addJobData(Map<String, Object> dataModel, Job job) {
        dataModel.put(TemplateVariable.JOB_ID.getValue(), job.getJobId());
        dataModel.put(TemplateVariable.JOB_TITLE.getValue(), job.getTitle());

        User supervisingProfessor = job.getSupervisingProfessor();
        dataModel.put(TemplateVariable.SUPERVISING_PROFESSOR_FIRST_NAME.getValue(), supervisingProfessor.getFirstName());
        dataModel.put(TemplateVariable.SUPERVISING_PROFESSOR_LAST_NAME.getValue(), supervisingProfessor.getLastName());
        dataModel.put(TemplateVariable.SUPERVISING_PROFESSOR_EMAIL.getValue(), supervisingProfessor.getEmail());

        addResearchGroupData(dataModel, job.getResearchGroup());
    }

    private static final java.time.ZoneId CET_TIMEZONE = java.time.ZoneId.of("Europe/Berlin");
    private static final java.time.format.DateTimeFormatter DATE_FORMATTER = java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private static final java.time.format.DateTimeFormatter TIME_FORMATTER = java.time.format.DateTimeFormatter.ofPattern("HH:mm");

    private void addInterviewSlotData(Map<String, Object> dataModel, InterviewSlot slot) {
        java.time.ZonedDateTime startTime = slot.getStartDateTime().atZone(CET_TIMEZONE);
        java.time.ZonedDateTime endTime = slot.getEndDateTime().atZone(CET_TIMEZONE);

        dataModel.put(TemplateVariable.INTERVIEW_DATE.getValue(), startTime.format(DATE_FORMATTER));
        dataModel.put(TemplateVariable.INTERVIEW_START_TIME.getValue(), startTime.format(TIME_FORMATTER));
        dataModel.put(TemplateVariable.INTERVIEW_END_TIME.getValue(), endTime.format(TIME_FORMATTER));
        dataModel.put(TemplateVariable.INTERVIEW_LOCATION.getValue(), slot.getLocation());
        dataModel.put(TemplateVariable.INTERVIEW_STREAM_LINK.getValue(), slot.getStreamLink());

        // Add applicant data from interviewee
        if (slot.getInterviewee() != null && slot.getInterviewee().getApplication() != null) {
            Application application = slot.getInterviewee().getApplication();
            User applicant = application.getApplicant().getUser();
            dataModel.put(TemplateVariable.APPLICANT_FIRST_NAME.getValue(), applicant.getFirstName());
            dataModel.put(TemplateVariable.APPLICANT_LAST_NAME.getValue(), applicant.getLastName());
            dataModel.put(TemplateVariable.APPLICANT_GENDER.getValue(), application.getApplicantGender());
        }

        addJobData(dataModel, slot.getInterviewProcess().getJob());
    }

    /**
     * Adds combined user and research group data for research-group-related emails.
     */
    private void addResearchGroupContextData(Map<String, Object> dataModel, ResearchGroupEmailContextDTO context) {
        dataModel.put(TemplateVariable.USER_FIRST_NAME.getValue(), context.userFirstName());
        dataModel.put(TemplateVariable.USER_LAST_NAME.getValue(), context.userLastName());
        dataModel.put(TemplateVariable.RESEARCH_GROUP_NAME.getValue(), context.researchGroupName());
    }

    /**
     * Adds interviewee-related variables to the template data model.
     * Including the self-scheduling booking link.
     *
     * @param dataModel   the data model map
     * @param interviewee the interviewee object
     */
    private void addIntervieweeData(Map<String, Object> dataModel, Interviewee interviewee) {
        // Reuse application data (name, etc.)
        addApplicationData(dataModel, interviewee.getApplication());

        // Add booking link: {clientUrl}/interview-booking/{processId}
        String bookingLink = url + "/interview-booking/" + interviewee.getInterviewProcess().getId();
        dataModel.put(TemplateVariable.BOOKING_LINK.getValue(), bookingLink);
    }

    /**
     * Adds research group-related variables to the template data model.
     *
     * @param dataModel     the data model map
     * @param researchGroup the research group object
     */
    private void addResearchGroupData(Map<String, Object> dataModel, ResearchGroup researchGroup) {
        dataModel.put(TemplateVariable.RESEARCH_GROUP_NAME.getValue(), researchGroup.getName());
    }

    private void addDataExportContextData(Map<String, Object> dataModel, DataExportEmailContextDTO ctx) {
        dataModel.put(TemplateVariable.USER_FIRST_NAME.getValue(), ctx.userFirstName());
        dataModel.put(TemplateVariable.USER_LAST_NAME.getValue(), ctx.userLastName());
        dataModel.put(TemplateVariable.DOWNLOAD_LINK.getValue(), ctx.downloadLink());
        dataModel.put(TemplateVariable.EXPORT_EXPIRES_DAYS.getValue(), ctx.expiresDays());
    }

    /**
     * Adds applicant and job-related variables for subject-area job publication emails.
     */
    private void addJobPublicationContextData(Map<String, Object> dataModel, JobPublicationEmailContextDTO ctx) {
        dataModel.put(TemplateVariable.APPLICANT_FIRST_NAME.getValue(), ctx.applicantFirstName());
        dataModel.put(TemplateVariable.APPLICANT_LAST_NAME.getValue(), ctx.applicantLastName());
        dataModel.put(TemplateVariable.JOB_ID.getValue(), ctx.jobId());
        dataModel.put(TemplateVariable.JOB_TITLE.getValue(), ctx.jobTitle());
        dataModel.put(TemplateVariable.SUPERVISING_PROFESSOR_FIRST_NAME.getValue(), ctx.supervisingProfessorFirstName());
        dataModel.put(TemplateVariable.SUPERVISING_PROFESSOR_LAST_NAME.getValue(), ctx.supervisingProfessorLastName());
        dataModel.put(TemplateVariable.SUPERVISING_PROFESSOR_EMAIL.getValue(), ctx.supervisingProfessorEmail());
        dataModel.put(TemplateVariable.RESEARCH_GROUP_NAME.getValue(), ctx.researchGroupName());
        dataModel.put(TemplateVariable.SUBJECT_AREA.getValue(), ctx.subjectArea());
    }

    /**
     * Adds variables related to reference letter invitations to the template data model.
     *
     * @param dataModel the data model map
     * @param ctx       the invitation context for the external referee
     */
    private void addReferenceLetterInvitationContextData(Map<String, Object> dataModel, ReferenceLetterContextDTO ctx) {
        dataModel.put(TemplateVariable.REFEREE_NAME_TITLE.getValue(), ctx.refereeNameTitle());
        dataModel.put(TemplateVariable.REFEREE_FIRST_NAME.getValue(), ctx.refereeFirstName());
        dataModel.put(TemplateVariable.REFEREE_LAST_NAME.getValue(), ctx.refereeLastName());
        dataModel.put(TemplateVariable.APPLICANT_FIRST_NAME.getValue(), ctx.applicantFirstName());
        dataModel.put(TemplateVariable.APPLICANT_LAST_NAME.getValue(), ctx.applicantLastName());
        dataModel.put(TemplateVariable.JOB_TITLE.getValue(), ctx.jobTitle());
        dataModel.put(TemplateVariable.RESEARCH_GROUP_NAME.getValue(), ctx.researchGroupName());
        dataModel.put(TemplateVariable.REFERENCE_LINK.getValue(), ctx.referenceLink());
        dataModel.put(TemplateVariable.REFERENCE_DEADLINE.getValue(), ctx.referenceDeadline());
        dataModel.put(
            TemplateVariable.RECOMMENDATION_TYPE.getValue(),
            ctx.recommendationType() != null ? ctx.recommendationType().name() : null
        );
    }

    /**
     * Adds generic user data to the template data model.
     *
     * @param dataModel the data model map
     * @param user      the user object
     */
    private void addUserData(Map<String, Object> dataModel, User user) {
        dataModel.put(TemplateVariable.USER_FIRST_NAME.getValue(), user.getFirstName());
        dataModel.put(TemplateVariable.USER_LAST_NAME.getValue(), user.getLastName());
        dataModel.put(TemplateVariable.LOGIN_LINK.getValue(), url);
        dataModel.put(TemplateVariable.APPLICATIONS_LINK.getValue(), url + "/application/overview");
    }

    /**
     * Adds language metadata, application URL and the configurable site name to the data model.
     *
     * @param language  the language used for rendering
     * @param dataModel the data model map
     */
    private void addMetaData(Language language, Map<String, Object> dataModel) {
        dataModel.put("language", language.getCode());
        dataModel.put("url", url);
        dataModel.put(TemplateVariable.SITE_NAME.getValue(), siteSettingService.getSiteName());
        dataModel.put(TemplateVariable.DOCUMENTATION_LINK.getValue(), DOCUMENTATION_URL);
    }
}
