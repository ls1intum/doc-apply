package de.tum.cit.aet.evaluation.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.application.repository.ApplicationRepository;
import de.tum.cit.aet.evaluation.dto.RatingDTO;
import de.tum.cit.aet.evaluation.dto.RatingOverviewDTO;
import de.tum.cit.aet.evaluation.repository.RatingRepository;
import de.tum.cit.aet.job.constants.JobState;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.job.repository.JobRepository;
import de.tum.cit.aet.usermanagement.domain.Applicant;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.repository.ApplicantRepository;
import de.tum.cit.aet.usermanagement.repository.ResearchGroupRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import de.tum.cit.aet.utility.DatabaseCleaner;
import de.tum.cit.aet.utility.MvcTestClient;
import de.tum.cit.aet.utility.security.JwtPostProcessors;
import de.tum.cit.aet.utility.testdata.*;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RatingResourceTest extends AbstractResourceTest {

    @Autowired
    UserRepository userRepository;

    @Autowired
    ResearchGroupRepository researchGroupRepository;

    @Autowired
    ApplicantRepository applicantRepository;

    @Autowired
    JobRepository jobRepository;

    @Autowired
    ApplicationRepository applicationRepository;

    @Autowired
    RatingRepository ratingRepository;

    @Autowired
    DatabaseCleaner databaseCleaner;

    @Autowired
    MvcTestClient api;

    User professor;
    User otherProfessor;
    ResearchGroup researchGroup;
    Applicant applicant;
    Job publishedJob;
    Application application;

    @BeforeEach
    void setup() {
        databaseCleaner.clean();

        researchGroup = ResearchGroupTestData.saved(researchGroupRepository);
        professor = UserTestData.savedProfessor(userRepository, researchGroup);
        otherProfessor = UserTestData.savedProfessor(userRepository, researchGroup);

        applicant = ApplicantTestData.savedWithNewUser(applicantRepository, userRepository);

        publishedJob = JobTestData.saved(
            jobRepository,
            professor,
            researchGroup,
            "Role X",
            JobState.PUBLISHED,
            LocalDate.now().plusDays(14)
        );

        application = ApplicationTestData.savedInReview(applicationRepository, publishedJob, applicant);
    }

    private String ratingsUrl() {
        return "/api/applications/" + application.getApplicationId() + "/ratings";
    }

    private String ratingsUrl(UUID applicationId) {
        return "/api/applications/" + applicationId + "/ratings";
    }

    private User savedProfessorNamed(String email, String firstName, String lastName) {
        return UserTestData.savedProfessorAll(
            userRepository,
            researchGroup,
            null,
            email,
            firstName,
            lastName,
            "en",
            null,
            null,
            null,
            "DE",
            null,
            null,
            UUID.randomUUID().toString().replace("-", "").substring(0, 7)
        );
    }

    @Nested
    class GetRatings {

        @Test
        void returnsEmptyOverviewInitially() {
            RatingOverviewDTO overview = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(ratingsUrl(), Map.of(), RatingOverviewDTO.class, 200);

            assertThat(overview.currentUserRating()).isNull();
            assertThat(overview.otherRatings()).isEmpty();
        }

        @Test
        void includesOtherProfessorRatings() {
            RatingTestData.saved(ratingRepository, application, otherProfessor, -1);

            RatingOverviewDTO overview = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(ratingsUrl(), Map.of(), RatingOverviewDTO.class, 200);

            assertThat(overview.currentUserRating()).isNull();
            assertThat(overview.otherRatings()).anyMatch(
                r -> r.rating() == -1 && r.from().equals(otherProfessor.getFirstName() + " " + otherProfessor.getLastName())
            );
        }

        @Test
        void shouldIdentifyTheRaterByIdWhenReturningOtherRatings() {
            RatingTestData.saved(ratingRepository, application, otherProfessor, -1);

            RatingOverviewDTO overview = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(ratingsUrl(), Map.of(), RatingOverviewDTO.class, 200);

            assertThat(overview.otherRatings())
                .singleElement()
                .satisfies(r -> {
                    assertThat(r.fromUserId()).isEqualTo(otherProfessor.getUserId());
                    assertThat(r.rating()).isEqualTo(-1);
                });
        }

        @Test
        void shouldKeepRatingsApartWhenTwoRatersShareADisplayName() {
            User firstNamesake = savedProfessorNamed("namesake.one@tum.de", "Max", "Mustermann");
            User secondNamesake = savedProfessorNamed("namesake.two@tum.de", "Max", "Mustermann");
            RatingTestData.saved(ratingRepository, application, firstNamesake, -2);
            RatingTestData.saved(ratingRepository, application, secondNamesake, 2);

            RatingOverviewDTO overview = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(ratingsUrl(), Map.of(), RatingOverviewDTO.class, 200);

            assertThat(overview.otherRatings()).hasSize(2);
            assertThat(overview.otherRatings())
                .extracting(RatingDTO::fromUserId, RatingDTO::rating)
                .containsExactlyInAnyOrder(tuple(firstNamesake.getUserId(), -2), tuple(secondNamesake.getUserId(), 2));
        }

        @Test
        void nonexistentApplicationReturns404() {
            UUID fakeAppId = UUID.randomUUID();

            Void result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(ratingsUrl(fakeAppId), Map.of(), Void.class, 404);

            assertThat(result).isNull();
        }
    }

    @Nested
    class UpdateRating {

        @Test
        void createUpdateAndDeleteRating() {
            // Create
            RatingOverviewDTO created = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(ratingsUrl() + "?rating=1", null, RatingOverviewDTO.class, 200);

            assertThat(created.currentUserRating()).isEqualTo(1);

            // Update
            RatingOverviewDTO updated = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(ratingsUrl() + "?rating=2", null, RatingOverviewDTO.class, 200);

            assertThat(updated.currentUserRating()).isEqualTo(2);

            // Delete
            RatingOverviewDTO deleted = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(ratingsUrl(), null, RatingOverviewDTO.class, 200);

            assertThat(deleted.currentUserRating()).isNull();
        }

        @Test
        void nonexistentApplicationReturns404() {
            UUID fakeAppId = UUID.randomUUID();

            Void result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(ratingsUrl(fakeAppId) + "?rating=1", null, Void.class, 404);

            assertThat(result).isNull();
        }
    }

    @Nested
    class Authorization {

        @Test
        void getRatingsUnauthenticatedReturns401() {
            Void result = api.withoutPostProcessors().getAndRead(ratingsUrl(), Map.of(), Void.class, 401);
            assertThat(result).isNull();
        }

        @Test
        void updateRatingUnauthenticatedReturns401() {
            Void result = api.withoutPostProcessors().putAndRead(ratingsUrl() + "?rating=1", null, Void.class, 401);
            assertThat(result).isNull();
        }

        @Test
        void allEndpointsWithoutProfessorRoleReturn403() {
            Void getResult = api.getAndRead(ratingsUrl(), Map.of(), Void.class, 403);
            assertThat(getResult).isNull();

            Void putResult = api.putAndRead(ratingsUrl() + "?rating=1", null, Void.class, 403);
            assertThat(putResult).isNull();
        }
    }
}
