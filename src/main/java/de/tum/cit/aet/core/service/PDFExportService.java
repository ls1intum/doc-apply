package de.tum.cit.aet.core.service;

import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.application.domain.dto.ApplicationDetailDTO;
import de.tum.cit.aet.core.dto.JobOverviewData;
import de.tum.cit.aet.core.dto.UiTextFormatter;
import de.tum.cit.aet.core.exception.AccessDeniedException;
import de.tum.cit.aet.core.util.PDFBuilder;
import de.tum.cit.aet.interview.domain.InterviewSlot;
import de.tum.cit.aet.interview.domain.Interviewee;
import de.tum.cit.aet.interview.domain.enumeration.AssessmentRating;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.job.dto.JobDetailDTO;
import de.tum.cit.aet.job.dto.JobFormDTO;
import de.tum.cit.aet.job.service.JobService;
import de.tum.cit.aet.reference.constants.ReferenceRequestStatus;
import de.tum.cit.aet.reference.dto.ReferenceRequestDTO;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.dto.ResearchGroupSummaryDTO;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class PDFExportService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm 'UTC'");
    private static final DateTimeFormatter DATETIME_FORMATTER = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm 'UTC'");

    private final JobService jobService;
    private final CurrentUserService currentUserService;
    private final ImageService imageService;

    private final UserRepository userRepository;

    // ------------------- Main methods -------------------

    /**
     * Exports application details to PDF. All timestamps are rendered in UTC.
     *
     * @param app    the ApplicationDetailDTO containing application data
     * @param labels translation labels for PDF content
     * @return the PDF file as Resource
     */
    public Resource exportApplicationToPDF(ApplicationDetailDTO app, Map<String, String> labels) {
        PDFBuilder builder = new PDFBuilder(labels.get("headline") + "'" + app.jobTitle() + "'");

        // currentUserFullNameOrEmpty() wraps the request-scoped proxy so it
        // degrades to Optional.empty() when called off-request (e.g. the
        // admin bulk export's background task executor). We then fall back
        // to the applicant's name so the header still makes sense.
        String displayName = currentUserFullNameOrEmpty().orElseGet(() ->
            app.applicant() != null && app.applicant().user() != null ? app.applicant().user().name() : ""
        );
        builder
            .addHeaderItem(labels.get("applicationBy") + displayName + labels.get("forPosition") + "'" + app.jobTitle() + "'")
            .addHeaderItem(labels.get("status") + UiTextFormatter.formatEnumValue(app.applicationState()));

        String lang = labels.getOrDefault("lang", "en");
        if (app.jobId() != null) {
            JobDetailDTO job = jobService.getJobDetails(app.jobId());
            // Determine job description language and content
            String descriptionForExport = selectJobDescriptionForLang(job.jobDescriptionEN(), job.jobDescriptionDE(), lang);

            // Overview Section if no in preview
            builder
                .setOverviewTitle(labels.get("overview"))
                .addOverviewItem(labels.get("supervisor"), getValue(app.supervisingProfessorName()))
                .addOverviewItem(labels.get("researchGroup"), getValue(app.researchGroup()))
                .addOverviewItem(
                    labels.get("location"),
                    app.jobLocation() != null ? getValue(app.jobLocation().correctLanguageValue(lang)) : "-"
                )
                .addOverviewItem(
                    labels.get("subjectArea"),
                    job.subjectArea() != null ? getValue(job.subjectArea().correctLanguageValue(lang)) : "-"
                )
                .addOverviewItem(labels.get("researchArea"), getValue(job.researchArea()))
                .addOverviewItem(labels.get("workload"), formatWorkload(job.workload(), labels.get("hoursPerWeek")))
                .addOverviewItem(
                    labels.get("duration"),
                    formatContractDuration(job.contractDuration(), labels.get("year"), labels.get("years"))
                )
                .addOverviewItem(
                    labels.get("fundingType"),
                    job.fundingType() != null ? getValue(job.fundingType().correctLanguageValue(lang)) : "-"
                )
                .addOverviewItem(labels.get("tvlGrade"), job.tvlGrade() != null ? job.tvlGrade().name() : "-")
                .addOverviewItem(
                    labels.get("startDate"),
                    formatStartDateForOverview(formatDate(job.startDate()), job.startDateByArrangement(), labels)
                )
                .addOverviewItem(labels.get("endDate"), formatDate(job.endDate()));
            if (job.referenceLettersRequired() > 0) {
                builder.addOverviewItem(labels.get("referenceLettersRequired"), String.valueOf(job.referenceLettersRequired()));
            }
            builder
                .addOverviewItem(labels.get("suitableForDisabled"), formatYesNo(job.suitableForDisabled(), labels))
                .setOverviewDescriptionTitle(labels.get("jobDetails"))
                .setOverviewDescription(descriptionForExport);
        }

        // Personal Statements Group
        builder.startSectionGroup(labels.get("personalStatements"));
        builder.startInfoSection(labels.get("motivation")).addSectionContent(getValue(app.motivation()));
        builder.startInfoSection(labels.get("skills")).addSectionContent(getValue(app.specialSkills()));
        builder.startInfoSection(labels.get("researchExperience")).addSectionContent(getValue(app.projects()));

        // Recommendation Letters Group (one row per requested referee with their current status)
        if (app.references() != null && !app.references().isEmpty()) {
            builder.startSectionGroup(labels.get("references"));
            builder.startInfoSection(labels.get(""));
            for (ReferenceRequestDTO reference : app.references()) {
                builder.addSectionData(
                    formatRefereeName(reference),
                    getValue(reference.email()) + " " + formatReferenceStatus(reference.status(), labels)
                );
            }
        }

        // Personal Information Group
        builder.startSectionGroup(labels.get("personalInformation"));

        builder
            .startInfoSection(labels.get("applicantInfo"))
            .addSectionData(labels.get("name"), getValue(app.applicant().user().name()))
            .addSectionData(labels.get("email"), getValue(app.applicant().user().email()))
            .addSectionData(labels.get("phoneNumber"), getValue(app.applicant().user().phoneNumber()))
            .addSectionData(labels.get("desiredStartDate"), formatDate(app.desiredDate()))
            .addSectionData(labels.get("gender"), getValue(app.applicant().user().gender()))
            .addSectionData(labels.get("nationality"), getValue(app.applicant().user().nationality()));

        String street = formatAddress(app.applicant().street(), app.applicant().postalCode(), app.applicant().city());
        if (hasValue(street)) {
            builder.addSectionData(labels.get("address"), street);
        }
        if (hasValue(app.applicant().country())) {
            builder.addSectionData(labels.get("country"), getCountry(app.applicant().country(), lang));
        }

        if (app.applicant().user().website() != null) {
            builder.addSectionData(labels.get("website"), getValue(app.applicant().user().website()));
        }
        if (app.applicant().user().linkedinUrl() != null) {
            builder.addSectionData(labels.get("linkedIn"), getValue(app.applicant().user().linkedinUrl()));
        }

        // Bachelor Section
        builder
            .startInfoSection(labels.get("bachelorInfo"))
            .addSectionData(labels.get("degreeName"), getValue(app.applicant().bachelorDegreeName()))
            .addSectionData(labels.get("university"), getValue(app.applicant().bachelorUniversity()))
            .addSectionData(labels.get("grade"), labels.getOrDefault("bachelorGradeDisplay", getValue(app.applicant().bachelorGrade())));

        // Master Section
        if (app.applicant().masterDegreeName() != null) {
            builder
                .startInfoSection(labels.get("masterInfo"))
                .addSectionData(labels.get("degreeName"), getValue(app.applicant().masterDegreeName()))
                .addSectionData(labels.get("university"), getValue(app.applicant().masterUniversity()))
                .addSectionData(labels.get("grade"), labels.getOrDefault("masterGradeDisplay", getValue(app.applicant().masterGrade())));
        }

        // Metadata
        String metadataText = buildMetadataText(labels);
        builder.setMetadata(metadataText);
        builder.setMetadataEnd(labels.get("metaEndText"));

        builder.setPageLabels(labels.get("page"), labels.get("of"));

        return builder.build();
    }

    /**
     * Exports job details to PDF. All timestamps are rendered in UTC.
     *
     * @param jobId  the job ID
     * @param labels translation labels for PDF content
     * @return the PDF file as Resource
     */
    public Resource exportJobToPDF(UUID jobId, Map<String, String> labels) {
        JobDetailDTO job = jobService.getJobDetails(jobId);

        PDFBuilder builder = new PDFBuilder(job.title());

        // Add banner image if available
        if (job.imageId() != null) {
            try {
                byte[] imageBytes = imageService.getImageBytes(job.imageId());
                builder.setBannerImage(imageBytes);
            } catch (Exception e) {
                log.debug("Could not load banner image for job PDF export: {}", e.getMessage());
            }
        }

        builder.addHeaderItem(labels.get("jobBy") + job.supervisingProfessorName() + labels.get("forJob") + "'" + job.title() + "'");
        try {
            if (currentUserService.isProfessor() || currentUserService.isEmployee()) {
                builder.addHeaderItem(labels.get("status") + UiTextFormatter.formatEnumValue(job.state()));
            }
        } catch (Exception e) {
            log.debug("User not needed to see job status in PDF export as it's always published for them.");
        }

        String lang = labels.getOrDefault("lang", "en");

        // Overview Section
        addJobOverview(
            builder,
            labels,
            new JobOverviewData(
                job.supervisingProfessorName(),
                job.location() != null ? job.location().correctLanguageValue(lang) : "-",
                job.subjectArea() != null ? job.subjectArea().correctLanguageValue(lang) : "-",
                job.researchArea(),
                formatWorkload(job.workload(), labels.get("hoursPerWeek")),
                formatContractDuration(job.contractDuration(), labels.get("year"), labels.get("years")),
                job.fundingType() != null ? getValue(job.fundingType().correctLanguageValue(lang)) : "-",
                job.tvlGrade() != null ? job.tvlGrade().name() : "-",
                job.referenceLettersRequired(),
                formatStartDateForOverview(formatDate(job.startDate()), job.startDateByArrangement(), labels),
                formatDate(job.endDate()),
                formatYesNo(job.suitableForDisabled(), labels)
            )
        );

        // Job Details Section
        String descriptionForExport = selectJobDescriptionForLang(job.jobDescriptionEN(), job.jobDescriptionDE(), lang);
        addJobDetailsSection(builder, labels, descriptionForExport);

        // Research Group Section
        addResearchGroupSection(builder, job.researchGroup(), labels);

        // Metadata
        String metadataText = buildMetadataText(labels);
        builder.setMetadata(metadataText);
        builder.setMetadataEnd(labels.get("metaEndText"));

        builder.setPageLabels(labels.get("page"), labels.get("of"));

        return builder.build();
    }

    /**
     * Exports job details to PDF. All timestamps are rendered in UTC.
     *
     * @param jobFormDTO the job form data
     * @param labels     translation labels for PDF content
     * @return the PDF file as Resource
     */
    public Resource exportJobPreviewToPDF(JobFormDTO jobFormDTO, Map<String, String> labels) {
        PDFBuilder builder = new PDFBuilder(jobFormDTO.title());

        // Add banner image if available
        if (jobFormDTO.imageId() != null) {
            try {
                byte[] imageBytes = imageService.getImageBytes(jobFormDTO.imageId());
                builder.setBannerImage(imageBytes);
            } catch (Exception e) {
                log.debug("Could not load banner image for job preview PDF export: {}", e.getMessage());
            }
        }

        String supervisingProfessorName = userRepository
            .findById(jobFormDTO.supervisingProfessor())
            .map(user -> (user.getFirstName() + " " + user.getLastName()).trim())
            .orElse("-");

        builder
            .addHeaderItem(labels.get("jobBy") + supervisingProfessorName + labels.get("forJob") + "'" + jobFormDTO.title() + "'")
            .addHeaderItem(labels.get("status") + UiTextFormatter.formatEnumValue(jobFormDTO.state()));

        String lang = labels.getOrDefault("lang", "en");

        // Overview Section
        addJobOverview(
            builder,
            labels,
            new JobOverviewData(
                supervisingProfessorName,
                jobFormDTO.location() != null ? jobFormDTO.location().correctLanguageValue(lang) : "-",
                jobFormDTO.subjectArea() != null ? jobFormDTO.subjectArea().correctLanguageValue(lang) : "-",
                jobFormDTO.researchArea(),
                jobFormDTO.workload() != null ? jobFormDTO.workload() + labels.get("hoursPerWeek") : "-",
                formatContractDuration(jobFormDTO.contractDuration(), labels.get("year"), labels.get("years")),
                jobFormDTO.fundingType() != null ? jobFormDTO.fundingType().correctLanguageValue(lang) : "-",
                jobFormDTO.tvlGrade() != null ? jobFormDTO.tvlGrade().name() : "-",
                jobFormDTO.referenceLettersRequired(),
                formatStartDateForOverview(
                    jobFormDTO.startDate() != null ? jobFormDTO.startDate().format(DATE_FORMATTER) : "-",
                    jobFormDTO.startDateByArrangement(),
                    labels
                ),
                jobFormDTO.endDate() != null ? jobFormDTO.endDate().format(DATE_FORMATTER) : "-",
                formatYesNo(jobFormDTO.suitableForDisabled(), labels)
            )
        );

        // Job Details Section
        String descriptionForExport = selectJobDescriptionForLang(jobFormDTO.jobDescriptionEN(), jobFormDTO.jobDescriptionDE(), lang);
        addJobDetailsSection(builder, labels, descriptionForExport);

        // Metadata
        builder.setMetadata(buildMetadataText(labels));
        builder.setMetadataEnd(labels.get("metaEndText"));
        builder.setPageLabels(labels.get("page"), labels.get("of"));

        try {
            ResearchGroup group = currentUserService.getResearchGroupIfProfessor();
            addResearchGroupSection(builder, group, labels);
        } catch (AccessDeniedException ignored) {
            log.debug("Nothing is added if there is no research group information.");
        }

        return builder.build();
    }

    /**
     * Exports a one-page summary of an {@link Interviewee} record to PDF: header
     * with applicant name and current rating, scheduled slots (date/time/location/
     * stream link/booked), and the professor's assessment notes.
     *
     * @param interviewee the interviewee whose data should be exported
     * @param app         the linked application (used for the applicant header)
     * @param job         the job the application is for (used for the title)
     * @param labels      translation labels for PDF content
     * @return the PDF file as Resource
     */
    public Resource exportInterviewToPDF(Interviewee interviewee, Application app, Job job, Map<String, String> labels) {
        String jobTitle = job == null || job.getTitle() == null ? "-" : job.getTitle();
        String applicantName = formatApplicantName(app);

        PDFBuilder builder = new PDFBuilder(labels.get("interviewHeading") + jobTitle);
        builder.addHeaderItem(labels.get("applicantInfo") + ": " + applicantName);
        builder.addHeaderItem(labels.get("status") + formatRating(interviewee.getRating(), labels));
        if (interviewee.getLastInvited() != null) {
            builder.addHeaderItem(labels.get("invitedAt") + formatInstantDateTime(interviewee.getLastInvited()));
        }

        // Schedule
        builder.startSectionGroup(labels.get("interviewSchedule"));
        List<InterviewSlot> slots = interviewee.getSlots() == null ? List.of() : interviewee.getSlots();
        if (slots.isEmpty()) {
            builder.startInfoSection(labels.get("interviewNoSlotTitle")).addSectionContent(labels.get("interviewNoSlotMessage"));
        } else {
            int idx = 1;
            for (InterviewSlot slot : slots) {
                String sectionTitle = slots.size() == 1 ? labels.get("interviewSlot") : labels.get("interviewSlot") + " " + idx++;
                builder.startInfoSection(sectionTitle);
                builder.addSectionData(labels.get("interviewDate"), formatInstantDate(slot.getStartDateTime()));
                builder.addSectionData(
                    labels.get("interviewTime"),
                    formatInstantTime(slot.getStartDateTime()) + " – " + formatInstantTime(slot.getEndDateTime())
                );
                builder.addSectionData(labels.get("interviewLocation"), getValue(slot.getLocation()));
                if (slot.getStreamLink() != null && !slot.getStreamLink().isBlank()) {
                    builder.addSectionData(labels.get("interviewStreamLink"), slot.getStreamLink());
                }
                builder.addSectionData(
                    labels.get("interviewBooked"),
                    Boolean.TRUE.equals(slot.getIsBooked()) ? labels.get("yes") : labels.get("no")
                );
            }
        }

        // Assessment
        builder.startSectionGroup(labels.get("interviewAssessment"));
        builder
            .startInfoSection(labels.get("interviewRating"))
            .addSectionData(labels.get("interviewRating"), formatRating(interviewee.getRating(), labels));
        builder.startInfoSection(labels.get("interviewNotes")).addSectionContent(getValue(interviewee.getAssessmentNotes()));

        // Footer
        builder.setMetadata(buildMetadataText(labels));
        builder.setMetadataEnd(labels.get("metaEndText"));
        builder.setPageLabels(labels.get("page"), labels.get("of"));

        return builder.build();
    }

    // ------------------- Helper methods -------------------

    private String formatApplicantName(Application app) {
        if (app == null) {
            return "-";
        }
        String last = app.getApplicantLastName();
        String first = app.getApplicantFirstName();
        String composed = ((last == null ? "" : last) + ", " + (first == null ? "" : first)).trim();
        return composed.replaceAll("^,\\s*|,\\s*$", "").isBlank() ? "-" : composed;
    }

    private String formatRating(AssessmentRating rating, Map<String, String> labels) {
        return rating == null ? labels.get("interviewNotRated") : rating.name() + " (" + rating.getValue() + ")";
    }

    private String formatInstantDate(Instant instant) {
        return instant == null ? "-" : DATE_FORMATTER.format(instant.atOffset(ZoneOffset.UTC));
    }

    private String formatInstantTime(Instant instant) {
        return instant == null ? "-" : TIME_FORMATTER.format(instant.atOffset(ZoneOffset.UTC));
    }

    private String formatInstantDateTime(Instant instant) {
        return instant == null ? "-" : DATETIME_FORMATTER.format(instant.atOffset(ZoneOffset.UTC));
    }

    private void addJobOverview(PDFBuilder builder, Map<String, String> labels, JobOverviewData data) {
        builder
            .setOverviewTitle(labels.get("overview"))
            .addOverviewItem(labels.get("supervisor"), getValue(data.supervisor()))
            .addOverviewItem(labels.get("location"), getValue(data.location()))
            .addOverviewItem(labels.get("subjectArea"), getValue(data.subjectArea()))
            .addOverviewItem(labels.get("researchArea"), getValue(data.researchArea()))
            .addOverviewItem(labels.get("workload"), getValue(data.workload()))
            .addOverviewItem(labels.get("duration"), getValue(data.duration()))
            .addOverviewItem(labels.get("fundingType"), getValue(data.fundingType()))
            .addOverviewItem(labels.get("tvlGrade"), getValue(data.tvlGrade()))
            .addOverviewItem(labels.get("startDate"), getValue(data.startDate()))
            .addOverviewItem(labels.get("endDate"), getValue(data.endDate()));
        if (data.referenceLettersRequired() > 0) {
            builder.addOverviewItem(labels.get("referenceLettersRequired"), String.valueOf(data.referenceLettersRequired()));
        }
        builder.addOverviewItem(labels.get("suitableForDisabled"), getValue(data.suitableForDisabled()));
    }

    /**
     * Formats a date for PDF rendering. Appends the "Upon agreement" label when the start date is by arrangement.
     */
    private String formatStartDateForOverview(String formattedDate, Boolean byArrangement, Map<String, String> labels) {
        if (Boolean.TRUE.equals(byArrangement)) {
            return formattedDate + " (" + labels.get("uponAgreement") + ")";
        }
        return formattedDate;
    }

    /**
     * Resolves the boolean field to the localised "Yes"/"No" label.
     */
    private String formatYesNo(Boolean value, Map<String, String> labels) {
        if (value == null) {
            return "-";
        }
        return value ? labels.get("yes") : labels.get("no");
    }

    private void addJobDetailsSection(PDFBuilder builder, Map<String, String> labels, String jobDescription) {
        builder.startSectionGroup(labels.get("jobDetails"));

        builder.startInfoSection("").addSectionContent(getValue(jobDescription));
    }

    private void addResearchGroupSection(PDFBuilder builder, ResearchGroup group, Map<String, String> labels) {
        builder.startSectionGroup(labels.get("researchGroup"));

        addResearchGroupMainInfo(builder, group);
        addResearchGroupContactInfo(builder, group, labels);
    }

    private void addResearchGroupSection(PDFBuilder builder, ResearchGroupSummaryDTO group, Map<String, String> labels) {
        builder.startSectionGroup(labels.get("researchGroup"));

        builder.startInfoSection(group.name()).addSectionContent(getValue(group.description()));

        String address = formatAddress(group.street(), group.postalCode(), group.city());
        Map<String, String> items = new LinkedHashMap<>();
        if (hasValue(address)) {
            items.put(labels.get("address"), address);
        }
        if (hasValue(group.email())) {
            items.put(labels.get("email"), group.email());
        }
        if (hasValue(group.website())) {
            items.put(labels.get("website"), group.website());
        }
        if (!items.isEmpty()) {
            builder.startInfoSection(labels.get("contactDetails"));
            items.forEach(builder::addSectionData);
        }
    }

    private void addResearchGroupMainInfo(PDFBuilder builder, ResearchGroup group) {
        builder.startInfoSection(group.getName()).addSectionContent(getValue(group.getDescription()));
    }

    private void addResearchGroupContactInfo(PDFBuilder builder, ResearchGroup group, Map<String, String> labels) {
        String address = formatAddress(group.getStreet(), group.getPostalCode(), group.getCity());
        Map<String, String> items = new LinkedHashMap<>();

        if (hasValue(address)) {
            items.put(labels.get("address"), address);
        }
        if (hasValue(group.getEmail())) {
            items.put(labels.get("email"), group.getEmail());
        }
        if (hasValue(group.getWebsite())) {
            items.put(labels.get("website"), group.getWebsite());
        }

        if (items.isEmpty()) {
            return;
        }

        builder.startInfoSection(labels.get("contactDetails"));
        items.forEach(builder::addSectionData);
    }

    private boolean hasValue(String value) {
        return value != null && !value.isEmpty();
    }

    /**
     * Generates filename for application PDF
     *
     * @param jobTitle         the title of the job of the application
     * @param applicationLabel label for application used as ending of the filename
     * @return sanitized filename for the PDF
     */
    public String generateApplicationFilename(String jobTitle, String applicationLabel) {
        return sanitizeFilename(jobTitle) + "_" + applicationLabel + ".pdf";
    }

    /**
     * Builds the metadata text using labels and current user data.
     * The "generated on" timestamp is rendered in UTC.
     *
     * @param labels translation labels for metadata parts
     * @return formatted metadata string
     */
    private String buildMetadataText(Map<String, String> labels) {
        StringBuilder metadata = new StringBuilder();

        String currentDateTime = LocalDateTime.now(ZoneOffset.UTC).format(DATETIME_FORMATTER);
        metadata.append(labels.get("thisDocumentWasGeneratedOn"));
        metadata.append(currentDateTime);

        Optional<String> userName = currentUserFullNameOrEmpty();
        if (userName.isPresent()) {
            metadata.append(labels.get("byUser"));
            metadata.append(userName.get());
        }

        metadata.append(labels.get("usingTumapply"));

        return metadata.toString();
    }

    /**
     * Returns the current user's full name if a request scope is active and
     * the user is authenticated, otherwise {@link Optional#empty()}.
     *
     * <p>{@link CurrentUserService} is a request-scoped bean accessed through
     * a CGLIB proxy; every method call on it tries to resolve the real bean
     * from the current request <em>before</em> invoking the method body. On
     * a regular HTTP-bound thread that resolves fine, but when a PDF is
     * rendered from a background task (e.g. the admin bulk export running on
     * the shared {@code taskExecutor}), there is no request scope and the
     * proxy throws {@code BeanCreationException: Scope 'request' is not
     * active} — a failure raised by the proxy itself, not by the method body,
     * so it cannot be caught by a {@code try/catch} added to
     * {@link CurrentUserService}. Wrapping the call here keeps every PDF
     * renderer (application, job, interview) able to safely include or omit
     * the "generated by" footer depending on context.
     *
     * @return the current user's full name, or {@code empty} if unavailable
     */
    private Optional<String> currentUserFullNameOrEmpty() {
        try {
            return currentUserService.getCurrentUserFullNameIfAvailable();
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    /**
     * Generates filename for job PDF
     *
     * @param jobId    the job ID
     * @param jobLabel label for application used as ending of the filename
     * @return sanitized filename for the PDF
     */
    public String generateJobFilename(UUID jobId, String jobLabel) {
        JobDetailDTO job = jobService.getJobDetails(jobId);
        return sanitizeFilename(job.title()) + "_" + jobLabel + ".pdf";
    }

    /**
     * Generates filename for job PDF
     *
     * @param jobFormDTO the job form data
     * @param jobLabel   label for application used as ending of the filename
     * @return sanitized filename for the PDF
     */
    public String generateJobFilenameForPreview(JobFormDTO jobFormDTO, String jobLabel) {
        return sanitizeFilename(jobFormDTO.title()) + "_" + jobLabel + ".pdf";
    }

    // Helper methods

    private String getValue(String value) {
        return (value != null && !value.isEmpty()) ? value : "-";
    }

    String formatDate(Object date) {
        if (date == null) {
            return "-";
        }
        if (date instanceof java.time.LocalDate localDate) {
            return localDate.format(DATE_FORMATTER);
        }
        return date.toString();
    }

    private String formatWorkload(Integer workload, String unit) {
        return workload != null ? workload + (" " + unit) : "-";
    }

    private String formatContractDuration(Integer duration, String singularUnit, String pluralUnit) {
        if (duration == null) {
            return "-";
        }
        String unit = duration == 1 ? singularUnit : pluralUnit;
        return duration + " " + unit;
    }

    private String sanitizeFilename(String filename) {
        if (filename == null) {
            return "document";
        }
        return filename.replaceAll("[^a-zA-Z0-9-_]", "_").substring(0, Math.min(filename.length(), 50));
    }

    private String formatAddress(String street, String postalCode, String city) {
        List<String> parts = new ArrayList<>();

        if (hasValue(street)) {
            parts.add(street);
        }

        List<String> postalCodeParts = new ArrayList<>();
        if (hasValue(postalCode)) {
            postalCodeParts.add(postalCode);
        }
        if (hasValue(city)) {
            postalCodeParts.add(city);
        }

        if (!postalCodeParts.isEmpty()) {
            parts.add(String.join(" ", postalCodeParts));
        }

        return String.join(", ", parts);
    }

    /**
     * Selects the appropriate job description based on the requested language and availability
     *
     * @param englishDesc   English job description
     * @param germanDesc    German job description
     * @param lang          requested language ("en" or "de")
     * @return the selected job description for export or a "-" if none is available
     */
    private String selectJobDescriptionForLang(String englishDesc, String germanDesc, String lang) {
        String primary = "de".equalsIgnoreCase(lang) ? germanDesc : englishDesc;
        String secondary = "de".equalsIgnoreCase(lang) ? englishDesc : germanDesc;

        if (primary != null && !primary.trim().isEmpty()) {
            return primary;
        } else if (secondary != null && !secondary.trim().isEmpty()) {
            return secondary;
        } else {
            return "-";
        }
    }

    /**
     * Converts a country code to its display name in the specified language.
     *
     * @param countryCode   the ISO country code (e.g., "DE" for Germany)
     * @param lang          the language code for display (e.g., "en" or "de")
     * @return              the display name of the country in the specified language, or "-" if the code is not provided
     */
    private String getCountry(String countryCode, String lang) {
        if (!hasValue(countryCode)) {
            return "-";
        }
        Locale countryLocale = Locale.of("", countryCode);
        Locale displayLanguage = Locale.of(lang);
        return countryLocale.getDisplayCountry(displayLanguage);
    }

    private String formatRefereeName(ReferenceRequestDTO reference) {
        String fullName = Stream.of(reference.title(), reference.firstName(), reference.lastName())
            .filter(this::hasValue)
            .collect(Collectors.joining(" "));
        return getValue(fullName);
    }

    private String formatReferenceStatus(ReferenceRequestStatus status, Map<String, String> labels) {
        return switch (status) {
            case null -> "";
            case ADDED -> labels.getOrDefault("referenceStatusAdded", "(added)");
            case REQUESTED -> labels.getOrDefault("referenceStatusRequested", "(requested)");
            case SUBMITTED -> labels.getOrDefault("referenceStatusSubmitted", "(submitted)");
            case EXPIRED -> labels.getOrDefault("referenceStatusExpired", "(expired)");
            case DECLINED -> labels.getOrDefault("referenceStatusDeclined", "(declined)");
            case CANCELLED -> labels.getOrDefault("referenceStatusCancelled", "(cancelled)");
        };
    }
}
