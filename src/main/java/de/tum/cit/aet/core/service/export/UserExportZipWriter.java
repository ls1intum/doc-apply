package de.tum.cit.aet.core.service.export;

import de.tum.cit.aet.core.documents.domain.Document;
import de.tum.cit.aet.core.documents.repository.DocumentRepository;
import de.tum.cit.aet.core.domain.Image;
import de.tum.cit.aet.core.dto.exportdata.ApplicantDataExportDTO;
import de.tum.cit.aet.core.dto.exportdata.ApplicantInternalCommentExportDTO;
import de.tum.cit.aet.core.dto.exportdata.ApplicantRatingExportDTO;
import de.tum.cit.aet.core.dto.exportdata.ApplicantReferenceRequestExportDTO;
import de.tum.cit.aet.core.dto.exportdata.StaffDataDTO;
import de.tum.cit.aet.core.dto.exportdata.UserDataExportDTO;
import de.tum.cit.aet.core.exception.UserDataExportException;
import de.tum.cit.aet.core.repository.ImageRepository;
import de.tum.cit.aet.core.service.ZipExportService;
import de.tum.cit.aet.core.util.FileUtil;
import java.io.BufferedOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.zip.Deflater;
import java.util.zip.ZipOutputStream;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class UserExportZipWriter {

    private static final String ZIP_README_ENTRY_DE = "README_DATA_EXPORT_DE.txt";
    private static final String ZIP_README_ENTRY_EN = "README_DATA_EXPORT_EN.txt";

    private final ZipExportService zipExportService;
    private final DocumentRepository documentRepository;
    private final ImageRepository imageRepository;

    @Value("${aet.data-export.root:${aet.storage.root:/data/docs}/exports}")
    private String dataExportRoot;

    @Value("${aet.storage.image-root:/storage/images}")
    private String imageRoot;

    /**
     * Creates a ZIP archive containing the user's exported data as CSV files,
     * uploaded documents, and images. The ZIP file is stored in the configured data export root directory
     * with a filename format of "data-export-{userId}-{exportRequestId}.zip".
     *
     * @param userId the unique identifier of the user whose data is being exported
     * @param exportRequestId the unique identifier of the export request
     * @param userData the DTO containing the user's data to be included in the export summary
     * @return the {@link Path} to the created ZIP file
     * @throws IOException if an I/O error occurs during ZIP creation or file writing
     */
    public Path writeExport(@NonNull UUID userId, @NonNull UUID exportRequestId, @NonNull UserDataExportDTO userData) throws IOException {
        Path root = Paths.get(dataExportRoot).toAbsolutePath().normalize();
        Files.createDirectories(root);

        String fileName = "data-export-" + userId + "-" + exportRequestId + ".zip";
        Path zipPath = root.resolve(fileName);

        try (ZipOutputStream zipOut = new ZipOutputStream(new BufferedOutputStream(Files.newOutputStream(zipPath)))) {
            zipOut.setLevel(Deflater.BEST_COMPRESSION);

            addUserReadmeToZip(zipOut);
            writeCsvSummary(zipOut, userData);

            List<Document> documentsToExport = new ArrayList<>(documentRepository.findByUploadedByUserId(userId));
            // Reference letters have no uploader, so the uploader query above does not surface them
            documentsToExport.addAll(documentRepository.findNonConfidentialReferenceLettersForApplicant(userId));
            for (Document document : documentsToExport) {
                String entryName = "documents/uploaded/" + document.getDocumentId();
                addDocumentToZip(zipOut, document, entryName);
            }

            List<Image> images = imageRepository.findByUploaderId(userId);
            for (Image image : images) {
                addImageToZip(zipOut, image);
            }

            zipOut.finish();
        }

        return zipPath;
    }

    private void addUserReadmeToZip(ZipOutputStream zipOut) {
        try {
            zipExportService.addFileToZip(zipOut, ZIP_README_ENTRY_DE, buildGermanUserReadme().getBytes(StandardCharsets.UTF_8));
            zipExportService.addFileToZip(zipOut, ZIP_README_ENTRY_EN, buildEnglishUserReadme().getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new UserDataExportException("Failed to add README to ZIP export", e);
        }
    }

    private String buildGermanUserReadme() {
        return """
        TUMApply Datenexport - Inhalt dieser ZIP-Datei

        Diese ZIP enthält deine exportierten Daten in klaren Ordnern.

        1) Ordner "data/" (CSV-Dateien)
        - data/profile.csv: Basis-Profildaten
        - data/user_settings.csv: Deine Benutzereinstellungen
        - data/email_settings.csv: Deine E-Mail-Benachrichtigungseinstellungen

        Je nach Rolle können zusätzlich vorhanden sein:

        Applicant-Daten:
        - data/applicant_profile.csv
        - data/applicant_documents.csv
        - data/applicant_applications.csv
        - data/applicant_interviewees.csv
        - data/applicant_subject_area_subscriptions.csv
        - data/applicant_reference_requests.csv

        Staff-Daten:
        - data/staff_supervised_jobs.csv
        - data/staff_research_group_roles.csv
        - data/staff_reviews.csv
        - data/staff_comments.csv
        - data/staff_ratings.csv
        - data/staff_interview_processes.csv
        - data/staff_interview_slots.csv

        2) Ordner "documents/uploaded/"
        - Enthält hochgeladene Dokumentdateien.

        3) Ordner "images/"
        - Enthält exportierte Bilddateien.

        Hinweise:
        - Nicht jede Datei ist in jedem Export enthalten.
        - Welche CSV-Dateien vorhanden sind, haengt von deinen Rollen und Daten im System ab.
        - CSV-Dateien koennen direkt in Excel, LibreOffice Calc oder ähnlichen Programmen geöffnet werden.
        """;
    }

    private String buildEnglishUserReadme() {
        return """
        TUMApply Data Export - Contents of this ZIP File

        This ZIP contains your exported data in clearly structured folders.

        1) Folder "data/" (CSV files)
        - data/profile.csv: Basic profile data
        - data/user_settings.csv: Your user settings
        - data/email_settings.csv: Your email notification settings

        Depending on your role, additional files may be present:

        Applicant data:
        - data/applicant_profile.csv
        - data/applicant_documents.csv
        - data/applicant_applications.csv
        - data/applicant_interviewees.csv
        - data/applicant_subject_area_subscriptions.csv
        - data/applicant_reference_requests.csv

        Staff data:
        - data/staff_supervised_jobs.csv
        - data/staff_research_group_roles.csv
        - data/staff_reviews.csv
        - data/staff_comments.csv
        - data/staff_ratings.csv
        - data/staff_interview_processes.csv
        - data/staff_interview_slots.csv

        2) Folder "documents/uploaded/"
        - Contains uploaded document files.

        3) Folder "images/"
        - Contains exported image files.

        Notes:
        - Not every file is present in every export.
        - Which CSV files are included depends on your roles and available data in the system.
        - CSV files can be opened directly in Excel, LibreOffice Calc, or similar tools.
        """;
    }

    private void writeCsvSummary(ZipOutputStream zipOut, UserDataExportDTO userData) {
        addCsvFileToZip(
            zipOut,
            "data/profile.csv",
            List.of("first_name", "last_name", "email", "gender", "nationality", "birthday", "ai_features_enabled", "ai_consented_at"),
            List.of(
                List.of(
                    toCsvValue(userData.profile().firstName()),
                    toCsvValue(userData.profile().lastName()),
                    toCsvValue(userData.profile().email()),
                    toCsvValue(userData.profile().gender()),
                    toCsvValue(userData.profile().nationality()),
                    toCsvValue(userData.profile().birthday()),
                    toCsvValue(userData.profile().aiFeaturesEnabled()),
                    toCsvValue(userData.profile().aiConsentedAt())
                )
            )
        );

        List<List<String>> userSettingsRows = userData
            .settings()
            .stream()
            .map(setting -> List.of(toCsvValue(setting.key()), toCsvValue(setting.value())))
            .toList();
        addCsvFileToZip(zipOut, "data/user_settings.csv", List.of("key", "value"), userSettingsRows);

        List<List<String>> emailSettingsRows = userData
            .emailSettings()
            .stream()
            .map(setting -> List.of(toCsvValue(setting.emailType()), toCsvValue(setting.enabled())))
            .toList();
        addCsvFileToZip(zipOut, "data/email_settings.csv", List.of("email_type", "enabled"), emailSettingsRows);

        writeApplicantCsv(zipOut, userData.applicantData());
        writeStaffCsv(zipOut, userData.staffData());
    }

    private void writeApplicantCsv(ZipOutputStream zipOut, ApplicantDataExportDTO applicantData) {
        if (applicantData == null) {
            return;
        }

        writeApplicantProfileCsv(zipOut, applicantData);
        writeApplicantDocumentsCsv(zipOut, applicantData);
        writeApplicantApplicationsCsv(zipOut, applicantData);
        writeApplicantIntervieweesCsv(zipOut, applicantData);
        writeApplicantSubjectAreaSubscriptionsCsv(zipOut, applicantData);
        writeApplicantReferenceRequestsCsv(zipOut, applicantData);
    }

    private void writeApplicantReferenceRequestsCsv(ZipOutputStream zipOut, ApplicantDataExportDTO applicantData) {
        List<ApplicantReferenceRequestExportDTO> entries = applicantData.referenceRequests();
        List<List<String>> rows =
            entries == null
                ? List.of()
                : entries
                      .stream()
                      .map(entry ->
                          List.of(
                              toCsvValue(entry.jobTitle()),
                              toCsvValue(entry.title()),
                              toCsvValue(entry.firstName()),
                              toCsvValue(entry.lastName()),
                              toCsvValue(entry.email()),
                              toCsvValue(entry.status())
                          )
                      )
                      .toList();

        addCsvFileToZip(
            zipOut,
            "data/applicant_reference_requests.csv",
            List.of("job_title", "name_title", "first_name", "last_name", "email", "status"),
            rows
        );
    }

    private void writeApplicantProfileCsv(ZipOutputStream zipOut, ApplicantDataExportDTO applicantData) {
        addCsvFileToZip(
            zipOut,
            "data/applicant_profile.csv",
            List.of(
                "street",
                "postal_code",
                "city",
                "country",
                "bachelor_degree_name",
                "bachelor_grade_upper_limit",
                "bachelor_grade_lower_limit",
                "bachelor_grade",
                "bachelor_university",
                "master_degree_name",
                "master_grade_upper_limit",
                "master_grade_lower_limit",
                "master_grade",
                "master_university"
            ),
            List.of(
                List.of(
                    toCsvValue(applicantData.street()),
                    toCsvValue(applicantData.postalCode()),
                    toCsvValue(applicantData.city()),
                    toCsvValue(applicantData.country()),
                    toCsvValue(applicantData.bachelorDegreeName()),
                    toCsvValue(applicantData.bachelorGradeUpperLimit()),
                    toCsvValue(applicantData.bachelorGradeLowerLimit()),
                    toCsvValue(applicantData.bachelorGrade()),
                    toCsvValue(applicantData.bachelorUniversity()),
                    toCsvValue(applicantData.masterDegreeName()),
                    toCsvValue(applicantData.masterGradeUpperLimit()),
                    toCsvValue(applicantData.masterGradeLowerLimit()),
                    toCsvValue(applicantData.masterGrade()),
                    toCsvValue(applicantData.masterUniversity())
                )
            )
        );
    }

    private void writeApplicantDocumentsCsv(ZipOutputStream zipOut, ApplicantDataExportDTO applicantData) {
        List<List<String>> documentRows = applicantData
            .documents()
            .stream()
            .sorted(Comparator.comparing(document -> document.documentId().toString()))
            .map(document ->
                List.of(
                    toCsvValue(document.documentId()),
                    toCsvValue(document.name()),
                    toCsvValue(document.documentType()),
                    toCsvValue(document.mimeType()),
                    toCsvValue(document.size())
                )
            )
            .toList();

        addCsvFileToZip(
            zipOut,
            "data/applicant_documents.csv",
            List.of("document_id", "name", "document_type", "mime_type", "size_bytes"),
            documentRows
        );
    }

    private void writeApplicantApplicationsCsv(ZipOutputStream zipOut, ApplicantDataExportDTO applicantData) {
        List<List<String>> applicationRows = applicantData
            .applications()
            .stream()
            .map(application ->
                List.of(
                    toCsvValue(application.jobTitle()),
                    toCsvValue(application.state()),
                    toCsvValue(application.desiredStartDate()),
                    toCsvValue(application.motivation()),
                    toCsvValue(application.specialSkills()),
                    toCsvValue(application.projects()),
                    toCsvValue(application.review() != null ? application.review().reason() : null),
                    toCsvValue(application.review() != null ? application.review().reviewedAt() : null),
                    formatApplicantRatings(application.ratings()),
                    formatApplicantComments(application.internalComments())
                )
            )
            .toList();

        addCsvFileToZip(
            zipOut,
            "data/applicant_applications.csv",
            List.of(
                "job_title",
                "state",
                "desired_start_date",
                "motivation",
                "special_skills",
                "projects",
                "review_reason",
                "reviewed_at",
                "ratings",
                "internal_comments"
            ),
            applicationRows
        );
    }

    private void writeApplicantIntervieweesCsv(ZipOutputStream zipOut, ApplicantDataExportDTO applicantData) {
        List<List<String>> intervieweeRows = applicantData
            .interviewees()
            .stream()
            .map(interviewee ->
                List.of(
                    toCsvValue(interviewee.jobTitle()),
                    toCsvValue(interviewee.lastInvited()),
                    toCsvValue(interviewee.rating()),
                    toCsvValue(interviewee.assessmentNotes())
                )
            )
            .toList();

        addCsvFileToZip(
            zipOut,
            "data/applicant_interviewees.csv",
            List.of("job_title", "last_invited", "interview_rating", "interview_notes"),
            intervieweeRows
        );
    }

    private void writeApplicantSubjectAreaSubscriptionsCsv(ZipOutputStream zipOut, ApplicantDataExportDTO applicantData) {
        List<List<String>> subscriptionRows = applicantData
            .subjectAreaSubscriptions()
            .stream()
            .map(subscription -> List.of(toCsvValue(subscription)))
            .toList();

        addCsvFileToZip(zipOut, "data/applicant_subject_area_subscriptions.csv", List.of("subject_area"), subscriptionRows);
    }

    private void writeStaffCsv(ZipOutputStream zipOut, StaffDataDTO staffData) {
        if (staffData == null) {
            return;
        }

        writeStaffSupervisedJobsCsv(zipOut, staffData);
        writeStaffResearchGroupRolesCsv(zipOut, staffData);
        writeStaffReviewsCsv(zipOut, staffData);
        writeStaffCommentsCsv(zipOut, staffData);
        writeStaffRatingsCsv(zipOut, staffData);
        writeStaffInterviewProcessesCsv(zipOut, staffData);
        writeStaffInterviewSlotsCsv(zipOut, staffData);
    }

    private void writeStaffSupervisedJobsCsv(ZipOutputStream zipOut, StaffDataDTO staffData) {
        List<List<String>> supervisedJobRows = staffData
            .supervisedJobs()
            .stream()
            .map(jobTitle -> List.of(toCsvValue(jobTitle)))
            .toList();

        addCsvFileToZip(zipOut, "data/staff_supervised_jobs.csv", List.of("job_title"), supervisedJobRows);
    }

    private void writeStaffResearchGroupRolesCsv(ZipOutputStream zipOut, StaffDataDTO staffData) {
        List<List<String>> roleRows = staffData
            .researchGroupRoles()
            .stream()
            .map(role -> List.of(toCsvValue(role.researchGroupName()), toCsvValue(role.role())))
            .toList();

        addCsvFileToZip(zipOut, "data/staff_research_group_roles.csv", List.of("research_group", "role"), roleRows);
    }

    private void writeStaffReviewsCsv(ZipOutputStream zipOut, StaffDataDTO staffData) {
        List<List<String>> reviewRows = staffData
            .reviews()
            .stream()
            .map(review ->
                List.of(
                    toCsvValue(review.jobTitle()),
                    toCsvValue(review.applicantName()),
                    toCsvValue(review.reason()),
                    toCsvValue(review.reviewedAt())
                )
            )
            .toList();

        addCsvFileToZip(zipOut, "data/staff_reviews.csv", List.of("job_title", "applicant_name", "reason", "reviewed_at"), reviewRows);
    }

    private void writeStaffCommentsCsv(ZipOutputStream zipOut, StaffDataDTO staffData) {
        List<List<String>> commentRows = staffData
            .comments()
            .stream()
            .map(comment ->
                List.of(
                    toCsvValue(comment.jobTitle()),
                    toCsvValue(comment.applicantName()),
                    toCsvValue(comment.message()),
                    toCsvValue(comment.createdAt())
                )
            )
            .toList();

        addCsvFileToZip(zipOut, "data/staff_comments.csv", List.of("job_title", "applicant_name", "message", "created_at"), commentRows);
    }

    private void writeStaffRatingsCsv(ZipOutputStream zipOut, StaffDataDTO staffData) {
        List<List<String>> ratingRows = staffData
            .ratings()
            .stream()
            .map(rating ->
                List.of(
                    toCsvValue(rating.jobTitle()),
                    toCsvValue(rating.applicantName()),
                    toCsvValue(rating.rating()),
                    toCsvValue(rating.createdAt())
                )
            )
            .toList();

        addCsvFileToZip(zipOut, "data/staff_ratings.csv", List.of("job_title", "applicant_name", "rating", "created_at"), ratingRows);
    }

    private void writeStaffInterviewProcessesCsv(ZipOutputStream zipOut, StaffDataDTO staffData) {
        List<List<String>> processRows = staffData
            .interviewProcesses()
            .stream()
            .map(process -> List.of(toCsvValue(process.jobTitle())))
            .toList();

        addCsvFileToZip(zipOut, "data/staff_interview_processes.csv", List.of("job_title"), processRows);
    }

    private void writeStaffInterviewSlotsCsv(ZipOutputStream zipOut, StaffDataDTO staffData) {
        List<List<String>> slotRows = staffData
            .interviewSlots()
            .stream()
            .map(slot ->
                List.of(
                    toCsvValue(slot.jobTitle()),
                    toCsvValue(slot.start()),
                    toCsvValue(slot.end()),
                    toCsvValue(slot.location()),
                    toCsvValue(slot.streamLink()),
                    toCsvValue(slot.isBooked())
                )
            )
            .toList();

        addCsvFileToZip(
            zipOut,
            "data/staff_interview_slots.csv",
            List.of("job_title", "start", "end", "location", "stream_link", "is_booked"),
            slotRows
        );
    }

    private String formatApplicantRatings(List<ApplicantRatingExportDTO> ratings) {
        if (ratings == null || ratings.isEmpty()) {
            return "";
        }

        List<String> formatted = new ArrayList<>();
        for (ApplicantRatingExportDTO rating : ratings) {
            formatted.add(toCsvValue(rating.rating()) + "@" + toCsvValue(rating.createdAt()));
        }
        return String.join("; ", formatted);
    }

    private String formatApplicantComments(List<ApplicantInternalCommentExportDTO> comments) {
        if (comments == null || comments.isEmpty()) {
            return "";
        }

        List<String> formatted = new ArrayList<>();
        for (ApplicantInternalCommentExportDTO comment : comments) {
            formatted.add(toCsvValue(comment.message()) + "@" + toCsvValue(comment.createdAt()));
        }
        return String.join("; ", formatted);
    }

    private void addCsvFileToZip(ZipOutputStream zipOut, String entryName, List<String> header, List<List<String>> rows) {
        StringBuilder csvBuilder = new StringBuilder();
        csvBuilder.append(toCsvLine(header)).append("\n");
        for (List<String> row : rows) {
            csvBuilder.append(toCsvLine(row)).append("\n");
        }

        try {
            zipExportService.addFileToZip(zipOut, entryName, csvBuilder.toString().getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new UserDataExportException("Failed to add CSV entry to ZIP export: " + entryName, e);
        }
    }

    private String toCsvLine(List<String> columns) {
        return columns.stream().map(this::escapeCsv).collect(java.util.stream.Collectors.joining(","));
    }

    private String escapeCsv(String value) {
        String safeValue = value == null ? "" : value;
        boolean requiresQuotes =
            safeValue.contains(",") || safeValue.contains("\"") || safeValue.contains("\n") || safeValue.contains("\r");
        if (!requiresQuotes) {
            return safeValue;
        }
        return "\"" + safeValue.replace("\"", "\"\"") + "\"";
    }

    private String toCsvValue(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private void addDocumentToZip(ZipOutputStream zipOut, @NonNull Document document, String entryPath) {
        try {
            String mimeType = document.getMimeType();
            String extension = switch (mimeType) {
                case "application/pdf" -> ".pdf";
                default -> "";
            };
            String fullEntryPath = entryPath + extension;

            zipExportService.addDocumentToZip(zipOut, fullEntryPath, document);
        } catch (Exception e) {
            throw new UserDataExportException("Failed to add document to ZIP export", e);
        }
    }

    private void addImageToZip(ZipOutputStream zipOut, Image image) {
        try {
            String relativePath = extractRelativePath(image.getUrl());
            if (relativePath == null) {
                return;
            }

            Path imagePath = resolveImagePath(relativePath);
            Path relative = Paths.get(relativePath);
            String fileName = FileUtil.sanitizeFilename(imagePath.getFileName().toString());
            String entryPath = buildEntryPath(relative, fileName);

            try (InputStream inputStream = Files.newInputStream(imagePath)) {
                zipExportService.addFileToZip(zipOut, entryPath, inputStream);
            }
        } catch (Exception e) {
            throw new UserDataExportException("Failed to add image to ZIP export", e);
        }
    }

    private String extractRelativePath(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }

        String relativePath = url.startsWith("/images/") ? url.substring("/images/".length()) : url;
        Path relative = Paths.get(relativePath).normalize();
        if (relative.isAbsolute() || relative.startsWith("..")) {
            throw new UserDataExportException("Invalid image path: " + relativePath);
        }

        return relativePath;
    }

    private Path resolveImagePath(String relativePath) {
        Path root = Paths.get(imageRoot).toAbsolutePath().normalize();
        Path imagePath = root.resolve(relativePath).normalize();
        if (!imagePath.startsWith(root)) {
            throw new UserDataExportException("Image path lies outside storage root: " + imagePath);
        }

        if (!Files.exists(imagePath)) {
            throw new UserDataExportException("Image file not found: " + imagePath);
        }

        return imagePath;
    }

    private String buildEntryPath(Path relative, String fileName) {
        String parentPath = relative.getParent() != null ? relative.getParent().toString().replace("\\", "/") + "/" : "";
        return "images/" + parentPath + fileName;
    }
}
