package de.tum.cit.aet.utility.testdata;

import de.tum.cit.aet.application.constants.ApplicationState;
import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.application.repository.ApplicationRepository;
import de.tum.cit.aet.core.constants.DocumentType;
import de.tum.cit.aet.core.documents.domain.Document;
import de.tum.cit.aet.core.documents.repository.DocumentRepository;
import de.tum.cit.aet.job.constants.JobState;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.job.repository.JobRepository;
import de.tum.cit.aet.usermanagement.domain.Applicant;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.repository.ApplicantRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Test data helpers for Application.
 */
public final class ApplicationTestData {

    private ApplicationTestData() {}

    /** Creates an unsaved Application with sensible defaults. */
    public static Application newApplication(Job job, Applicant applicant, ApplicationState state) {
        Application app = new Application();
        app.setJob(job);
        app.setApplicant(applicant);
        app.setState(state != null ? state : ApplicationState.SENT);
        app.setDesiredStartDate(LocalDate.now().plusMonths(1));
        app.setProjects("Robotics Project; ML Pipeline");
        app.setSpecialSkills("Python, TensorFlow, ROS");
        app.setMotivation("Highly motivated to contribute to research.");

        // Initialize snapshot fields from applicant's current profile data
        if (applicant != null) {
            User user = applicant.getUser();
            if (user != null) {
                app.setApplicantFirstName(user.getFirstName());
                app.setApplicantLastName(user.getLastName());
                app.setApplicantEmail(user.getEmail());
                app.setApplicantGender(user.getGender());
                app.setApplicantNationality(user.getNationality());
                app.setApplicantBirthday(user.getBirthday());
                app.setApplicantPhoneNumber(user.getPhoneNumber());
                app.setApplicantWebsite(user.getWebsite());
                app.setApplicantLinkedinUrl(user.getLinkedinUrl());
            }

            app.setApplicantStreet(applicant.getStreet());
            app.setApplicantPostalCode(applicant.getPostalCode());
            app.setApplicantCity(applicant.getCity());
            app.setApplicantCountry(applicant.getCountry());

            app.setApplicantBachelorDegreeName(applicant.getBachelorDegreeName());
            app.setApplicantBachelorGradeUpperLimit(applicant.getBachelorGradeUpperLimit());
            app.setApplicantBachelorGradeLowerLimit(applicant.getBachelorGradeLowerLimit());
            app.setApplicantBachelorGrade(applicant.getBachelorGrade());
            app.setApplicantBachelorUniversity(applicant.getBachelorUniversity());

            app.setApplicantMasterDegreeName(applicant.getMasterDegreeName());
            app.setApplicantMasterGradeUpperLimit(applicant.getMasterGradeUpperLimit());
            app.setApplicantMasterGradeLowerLimit(applicant.getMasterGradeLowerLimit());
            app.setApplicantMasterGrade(applicant.getMasterGrade());
            app.setApplicantMasterUniversity(applicant.getMasterUniversity());

            app.setApplicantNoBachelorDegree(applicant.isNoBachelorDegree());
            app.setApplicantNoMasterDegree(applicant.isNoMasterDegree());
            app.setApplicantDegreeStatusExplanation(applicant.getDegreeStatusExplanation());
        }

        return app;
    }

    /** Unsaved Application with override options (null = keep default). */
    public static Application newApplicationAll(
        Job job,
        Applicant applicant,
        ApplicationState state,
        LocalDate desiredStartDate,
        String projects,
        String specialSkills,
        String motivation
    ) {
        Application app = newApplication(job, applicant, state);
        if (desiredStartDate != null) app.setDesiredStartDate(desiredStartDate);
        if (projects != null) app.setProjects(projects);
        if (specialSkills != null) app.setSpecialSkills(specialSkills);
        if (motivation != null) app.setMotivation(motivation);
        return app;
    }

    // --- Convenience creators for common states (unsaved) ---------------------------------------
    public static Application sent(Job job, Applicant applicant) {
        return newApplication(job, applicant, ApplicationState.SENT);
    }

    public static Application inReview(Job job, Applicant applicant) {
        return newApplication(job, applicant, ApplicationState.IN_REVIEW);
    }

    public static Application accepted(Job job, Applicant applicant) {
        return newApplication(job, applicant, ApplicationState.ACCEPTED);
    }

    public static Application rejected(Job job, Applicant applicant) {
        return newApplication(job, applicant, ApplicationState.REJECTED);
    }

    // --- Saved variants -------------------------------------------------------------------------
    public static Application saved(ApplicationRepository repo, Job job, Applicant applicant, ApplicationState state) {
        return repo.save(newApplication(job, applicant, state));
    }

    public static Application savedSent(ApplicationRepository repo, Job job, Applicant applicant) {
        return repo.save(sent(job, applicant));
    }

    public static Application savedInReview(ApplicationRepository repo, Job job, Applicant applicant) {
        return repo.save(inReview(job, applicant));
    }

    public static Application savedAccepted(ApplicationRepository repo, Job job, Applicant applicant) {
        return repo.save(accepted(job, applicant));
    }

    public static Application savedRejected(ApplicationRepository repo, Job job, Applicant applicant) {
        return repo.save(rejected(job, applicant));
    }

    public static Application savedAll(
        ApplicationRepository repo,
        Job job,
        Applicant applicant,
        ApplicationState state,
        LocalDate desiredStartDate,
        String projects,
        String specialSkills,
        String motivation
    ) {
        return repo.save(newApplicationAll(job, applicant, state, desiredStartDate, projects, specialSkills, motivation));
    }

    /**
     * Creates a rejected application with all related test data and overrides its lastModifiedAt timestamp.
     */
    public static ApplicationWithDocs savedRejectedWithLastModified(
        RetentionTestContext ctx,
        LocalDateTime lastModifiedAt,
        String fileName
    ) {
        Applicant applicant = ApplicantTestData.savedWithRandomEmail(ctx.applicantRepository(), ctx.userRepository());
        Job job = JobTestData.saved(
            ctx.jobRepository(),
            ctx.professor(),
            ctx.researchGroup(),
            "Retention test job",
            JobState.PUBLISHED,
            null
        );
        Application application = savedRejected(ctx.applicationRepository(), job, applicant);
        Document dictionary = DocumentTestData.savedMockDocument(
            ctx.documentRepository(),
            ctx.professor(),
            application,
            null,
            DocumentType.CV,
            fileName
        );

        ctx
            .entityManager()
            .createNativeQuery("UPDATE applications SET last_modified_at = :date WHERE application_id = :id")
            .setParameter("date", lastModifiedAt)
            .setParameter("id", application.getApplicationId())
            .executeUpdate();
        ctx.entityManager().flush();
        ctx.entityManager().clear();

        return new ApplicationWithDocs(application, dictionary);
    }

    public record RetentionTestContext(
        ApplicationRepository applicationRepository,
        ApplicantRepository applicantRepository,
        UserRepository userRepository,
        JobRepository jobRepository,
        DocumentRepository documentRepository,
        EntityManager entityManager,
        User professor,
        ResearchGroup researchGroup
    ) {}

    public record ApplicationWithDocs(Application application, Document dictionary) {}
}
