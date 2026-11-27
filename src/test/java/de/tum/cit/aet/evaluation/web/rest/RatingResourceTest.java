package de.tum.cit.aet.evaluation.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.application.repository.ApplicationRepository;
import de.tum.cit.aet.evaluation.domain.enumeration.RecommendationDecision;
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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
            assertThat(overview.otherRatings()).isNullOrEmpty();
        }

        @Test
        void includesOtherProfessorRatings() {
            RatingTestData.saved(ratingRepository, application, otherProfessor, RecommendationDecision.SOFT_FAIL);

            RatingOverviewDTO overview = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(ratingsUrl(), Map.of(), RatingOverviewDTO.class, 200);

            assertThat(overview.currentUserRating()).isNull();
            assertThat(overview.otherRatings()).anyMatch(
                r ->
                    r.rating() == RecommendationDecision.SOFT_FAIL &&
                    r.from().equals(otherProfessor.getFirstName() + " " + otherProfessor.getLastName())
            );
        }

        @Test
        void shouldIdentifyTheRaterByIdWhenReturningOtherRatings() {
            RatingTestData.saved(ratingRepository, application, otherProfessor, RecommendationDecision.SOFT_FAIL);

            RatingOverviewDTO overview = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(ratingsUrl(), Map.of(), RatingOverviewDTO.class, 200);

            assertThat(overview.otherRatings())
                .singleElement()
                .satisfies(r -> {
                    assertThat(r.fromUserId()).isEqualTo(otherProfessor.getUserId());
                    assertThat(r.rating()).isEqualTo(RecommendationDecision.SOFT_FAIL);
                });
        }

        @Test
        void shouldKeepRatingsApartWhenTwoRatersShareADisplayName() {
            User firstNamesake = savedProfessorNamed("namesake.one@tum.de", "Max", "Mustermann");
            User secondNamesake = savedProfessorNamed("namesake.two@tum.de", "Max", "Mustermann");
            RatingTestData.saved(ratingRepository, application, firstNamesake, RecommendationDecision.STRONG_FAIL);
            RatingTestData.saved(ratingRepository, application, secondNamesake, RecommendationDecision.STRONG_PASS);

            RatingOverviewDTO overview = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(ratingsUrl(), Map.of(), RatingOverviewDTO.class, 200);

            assertThat(overview.otherRatings()).hasSize(2);
            assertThat(overview.otherRatings())
                .extracting(RatingDTO::fromUserId, RatingDTO::rating)
                .containsExactlyInAnyOrder(
                    tuple(firstNamesake.getUserId(), RecommendationDecision.STRONG_FAIL),
                    tuple(secondNamesake.getUserId(), RecommendationDecision.STRONG_PASS)
                );
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
                .putAndRead(ratingsUrl() + "?rating=SOFT_PASS", null, RatingOverviewDTO.class, 200);

            assertThat(created.currentUserRating()).isEqualTo(RecommendationDecision.SOFT_PASS);

            // Update
            RatingOverviewDTO updated = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(ratingsUrl() + "?rating=STRONG_PASS", null, RatingOverviewDTO.class, 200);

            assertThat(updated.currentUserRating()).isEqualTo(RecommendationDecision.STRONG_PASS);

            // Delete
            RatingOverviewDTO deleted = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(ratingsUrl(), null, RatingOverviewDTO.class, 200);

            assertThat(deleted.currentUserRating()).isNull();
        }

        @ParameterizedTest
        @ValueSource(strings = { "0", "1", "NEUTRAL" })
        void shouldRejectRatingWhenValueIsNotADecision(String rating) {
            Void result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(ratingsUrl() + "?rating=" + rating, null, Void.class, 400);

            assertThat(result).isNull();
            assertThat(ratingRepository.findByApplicationApplicationId(application.getApplicationId())).isEmpty();
        }

        @Test
        void nonexistentApplicationReturns404() {
            UUID fakeAppId = UUID.randomUUID();

            Void result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(ratingsUrl(fakeAppId) + "?rating=SOFT_PASS", null, Void.class, 404);

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
            Void result = api.withoutPostProcessors().putAndRead(ratingsUrl() + "?rating=SOFT_PASS", null, Void.class, 401);
            assertThat(result).isNull();
        }

        @Test
        void allEndpointsWithoutProfessorRoleReturn403() {
            // Authenticate explicitly: MvcTestClient is a shared bean whose post processors persist,
            // so relying on whatever the previous test left behind makes this order-dependent.
            Void getResult = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_APPLICANT"))
                .getAndRead(ratingsUrl(), Map.of(), Void.class, 403);
            assertThat(getResult).isNull();

            Void putResult = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_APPLICANT"))
                .putAndRead(ratingsUrl() + "?rating=SOFT_PASS", null, Void.class, 403);
            assertThat(putResult).isNull();
        }
    }
}
