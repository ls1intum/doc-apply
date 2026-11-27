package de.tum.cit.aet.core.service.export;

import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.application.service.ApplicantService;
import de.tum.cit.aet.application.service.ApplicationService;
import de.tum.cit.aet.core.documents.service.DocumentService;
import de.tum.cit.aet.core.dto.exportdata.ApplicantDataExportDTO;
import de.tum.cit.aet.core.dto.exportdata.ApplicantInternalCommentExportDTO;
import de.tum.cit.aet.core.dto.exportdata.ApplicantRatingExportDTO;
import de.tum.cit.aet.core.dto.exportdata.ApplicantReferenceRequestExportDTO;
import de.tum.cit.aet.core.dto.exportdata.ApplicantReviewExportDTO;
import de.tum.cit.aet.core.dto.exportdata.ApplicationExportDTO;
import de.tum.cit.aet.core.dto.exportdata.DocumentExportDTO;
import de.tum.cit.aet.core.dto.exportdata.IntervieweeExportDTO;
import de.tum.cit.aet.evaluation.service.ApplicationEvaluationService;
import de.tum.cit.aet.evaluation.service.InternalCommentService;
import de.tum.cit.aet.evaluation.service.RatingService;
import de.tum.cit.aet.interview.service.InterviewService;
import de.tum.cit.aet.reference.domain.ReferenceRequest;
import de.tum.cit.aet.reference.service.ReferenceRequestService;
import de.tum.cit.aet.usermanagement.domain.Applicant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ApplicantDataExportProvider implements UserDataSectionProvider {

    private final ApplicantService applicantService;
    private final ApplicationService applicationService;
    private final DocumentService documentService;
    private final InterviewService interviewService;
    private final ApplicationEvaluationService applicationEvaluationService;
    private final RatingService ratingService;
    private final InternalCommentService internalCommentService;
    private final ReferenceRequestService referenceRequestService;

    @Override
    public void contribute(ExportContext context, UserDataExportBuilder builder) {
        if (!context.hasApplicantRole() || !applicantService.existsByUserId(context.user().getUserId())) {
            return;
        }
        builder.withApplicantData(buildApplicantData(context.user().getUserId()));
    }

    private ApplicantDataExportDTO buildApplicantData(UUID userId) {
        Applicant applicant = applicantService.findByUserId(userId).orElseThrow();

        Set<DocumentExportDTO> documents = documentService
            .listForApplicant(applicant)
            .stream()
            .map(doc ->
                new DocumentExportDTO(doc.getDocumentId(), doc.getName(), doc.getDocumentType(), doc.getMimeType(), doc.getSizeBytes())
            )
            .collect(Collectors.toSet());

        List<ApplicationExportDTO> applications = applicationService
            .findAllByApplicantUserId(userId)
            .stream()
            .map(application ->
                new ApplicationExportDTO(
                    application.getJob().getTitle(),
                    application.getState(),
                    application.getDesiredStartDate(),
                    application.getMotivation(),
                    application.getSpecialSkills(),
                    application.getProjects(),
                    getReview(application.getApplicationId()),
                    getRatings(application.getApplicationId()),
                    getInternalComments(application.getApplicationId())
                )
            )
            .toList();

        List<IntervieweeExportDTO> interviewees = getInterviewees(userId);
        List<String> subjectAreaSubscriptions = getSubjectAreaSubscriptions(applicant);
        List<ApplicantReferenceRequestExportDTO> referenceRequests = getReferenceRequests(userId);

        return new ApplicantDataExportDTO(
            applicant.getStreet(),
            applicant.getPostalCode(),
            applicant.getCity(),
            applicant.getCountry(),
            applicant.getBachelorDegreeName(),
            applicant.getBachelorGradeUpperLimit(),
            applicant.getBachelorGradeLowerLimit(),
            applicant.getBachelorGrade(),
            applicant.getBachelorUniversity(),
            applicant.getMasterDegreeName(),
            applicant.getMasterGradeUpperLimit(),
            applicant.getMasterGradeLowerLimit(),
            applicant.getMasterGrade(),
            applicant.getMasterUniversity(),
            applicant.isNoBachelorDegree(),
            applicant.isNoMasterDegree(),
            applicant.getDegreeStatusExplanation(),
            documents,
            applications,
            interviewees,
            subjectAreaSubscriptions,
            referenceRequests
        );
    }

    private List<ApplicantReferenceRequestExportDTO> getReferenceRequests(UUID applicantUserId) {
        return applicationService
            .findAllByApplicantUserId(applicantUserId)
            .stream()
            .flatMap(application ->
                referenceRequestService
                    .findAllByApplicationIdOrdered(application.getApplicationId())
                    .stream()
                    .map(entry -> toReferenceRequestExportDto(application, entry))
            )
            .toList();
    }

    private ApplicantReferenceRequestExportDTO toReferenceRequestExportDto(Application application, ReferenceRequest entry) {
        return new ApplicantReferenceRequestExportDTO(
            application.getJob() != null ? application.getJob().getTitle() : null,
            entry.getTitle(),
            entry.getFirstName(),
            entry.getLastName(),
            entry.getEmail(),
            entry.getStatus()
        );
    }

    private ApplicantReviewExportDTO getReview(UUID applicationId) {
        return applicationEvaluationService
            .findReviewByApplicationId(applicationId)
            .map(review -> new ApplicantReviewExportDTO(review.getReason(), review.getReviewedAt()))
            .orElse(null);
    }

    private List<ApplicantRatingExportDTO> getRatings(UUID applicationId) {
        return ratingService
            .findAllByApplicationId(applicationId)
            .stream()
            .map(rating ->
                new ApplicantRatingExportDTO(
                    rating.getRating(),
                    rating.getCreatedAt() != null ? rating.getCreatedAt().toInstant(ZoneOffset.UTC) : null
                )
            )
            .toList();
    }

    private List<ApplicantInternalCommentExportDTO> getInternalComments(UUID applicationId) {
        return internalCommentService
            .findAllByApplicationIdOrdered(applicationId)
            .stream()
            .map(comment ->
                new ApplicantInternalCommentExportDTO(
                    comment.getMessage(),
                    comment.getCreatedAt() != null ? comment.getCreatedAt().toInstant(ZoneOffset.UTC) : null
                )
            )
            .toList();
    }

    private List<IntervieweeExportDTO> getInterviewees(UUID userId) {
        return interviewService
            .findIntervieweesByApplicantUserId(userId)
            .stream()
            .map(interviewee ->
                new IntervieweeExportDTO(
                    interviewee.getInterviewProcess().getJob().getTitle(),
                    interviewee.getLastInvited(),
                    interviewee.getRating() != null ? interviewee.getRating().name() : null,
                    interviewee.getAssessmentNotes()
                )
            )
            .toList();
    }

    private List<String> getSubjectAreaSubscriptions(Applicant applicant) {
        return applicant.getSubjectAreaSubscriptions().stream().sorted().map(Enum::name).toList();
    }
}
