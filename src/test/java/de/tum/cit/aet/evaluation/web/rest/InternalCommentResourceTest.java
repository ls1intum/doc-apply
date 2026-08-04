package de.tum.cit.aet.evaluation.web.rest;

import static org.assertj.core.api.Assertions.assertThat;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.application.repository.ApplicationRepository;
import de.tum.cit.aet.evaluation.domain.InternalComment;
import de.tum.cit.aet.evaluation.dto.InternalCommentDTO;
import de.tum.cit.aet.evaluation.dto.InternalCommentUpdateDTO;
import de.tum.cit.aet.evaluation.repository.InternalCommentRepository;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.core.type.TypeReference;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class InternalCommentResourceTest extends AbstractResourceTest {

    private static final String APPLICATION_COMMENTS_URL = "/api/applications/%s/comments";
    private static final String COMMENT_URL = "/api/comments/%s";

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
    InternalCommentRepository internalCommentRepository;

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
    InternalComment existingComment;

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

        existingComment = InternalCommentTestData.saved(internalCommentRepository, application, professor);
    }

    @Nested
    class Listing {

        @Test
        void listCommentsReturnsOrderedList() {
            internalCommentRepository.save(InternalCommentTestData.newCommentAll(application, professor, "first"));
            internalCommentRepository.save(InternalCommentTestData.newCommentAll(application, professor, "second"));

            List<InternalCommentDTO> list = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(applicationCommentsUrl(), Map.of(), new TypeReference<>() {}, 200);

            assertThat(list).hasSize(3);
            assertThat(list.get(1).message()).isEqualTo("first");
            assertThat(list.get(2).message()).isEqualTo("second");
        }

        @Test
        void shouldIdentifyTheAuthorByIdWhenListingComments() {
            internalCommentRepository.save(InternalCommentTestData.newCommentAll(application, otherProfessor, "from the other professor"));

            List<InternalCommentDTO> list = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(applicationCommentsUrl(), Map.of(), new TypeReference<>() {}, 200);

            assertThat(list)
                .filteredOn(c -> "from the other professor".equals(c.message()))
                .singleElement()
                .satisfies(c -> {
                    assertThat(c.authorUserId()).isEqualTo(otherProfessor.getUserId());
                    assertThat(c.canEdit()).isFalse();
                });
        }

        @Test
        void nonExistentApplicationReturns404() {
            UUID fakeAppId = UUID.randomUUID();
            long commentCountBefore = internalCommentRepository.count();
            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(applicationCommentsUrl(fakeAppId), Map.of(), Void.class, 404);
            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead(applicationCommentsUrl(fakeAppId), new InternalCommentUpdateDTO("ghost"), Void.class, 404);
            assertThat(internalCommentRepository.count()).isEqualTo(commentCountBefore);
        }
    }

    @Nested
    class Creation {

        @Test
        void createCommentReturns201() {
            InternalCommentUpdateDTO payload = new InternalCommentUpdateDTO("hello world");

            InternalCommentDTO created = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead(applicationCommentsUrl(), payload, InternalCommentDTO.class, 201);

            assertThat(created.message()).isEqualTo("hello world");
        }
    }

    @Nested
    class Update {

        @Test
        void updateCommentOwnCommentReturns200() {
            InternalCommentUpdateDTO payload = new InternalCommentUpdateDTO("updated");

            InternalCommentDTO updated = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(commentUrl(), payload, InternalCommentDTO.class, 200);

            assertThat(updated.message()).isEqualTo("updated");
        }

        @Test
        void updateCommentAsDifferentProfessorReturns403() {
            api
                .with(JwtPostProcessors.jwtUser(otherProfessor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(commentUrl(), new InternalCommentUpdateDTO("illegal"), Void.class, 403);
        }

        @Test
        void nonexistentCommentReturns404() {
            UUID fakeId = UUID.randomUUID();

            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(commentUrl(fakeId), new InternalCommentUpdateDTO("does not exist"), Void.class, 404);
        }
    }

    @Nested
    class Deletion {

        @Test
        void deleteCommentOwnCommentReturns204() {
            api.with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR")).deleteAndRead(commentUrl(), null, Void.class, 204);

            assertThat(internalCommentRepository.findById(existingComment.getInternalCommentId())).isEmpty();
        }

        @Test
        void nonexistentCommentReturns404() {
            UUID fakeId = UUID.randomUUID();

            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .deleteAndRead(commentUrl(fakeId), null, Void.class, 404);
        }
    }

    @Nested
    class Authorization {

        @Test
        void allEndpointsUnauthenticatedReturn401() {
            api.withoutPostProcessors().getAndRead(applicationCommentsUrl(), Map.of(), Void.class, 401);
            api.withoutPostProcessors().postAndRead(applicationCommentsUrl(), new InternalCommentUpdateDTO("x"), Void.class, 401);
            api.withoutPostProcessors().putAndRead(commentUrl(), new InternalCommentUpdateDTO("x"), Void.class, 401);
            api.withoutPostProcessors().deleteAndRead(commentUrl(), null, Void.class, 401);
        }

        @Test
        void allEndpointsWithoutProfessorRoleReturn403() {
            api.getAndRead(applicationCommentsUrl(), Map.of(), Void.class, 403);
            api.postAndRead(applicationCommentsUrl(), new InternalCommentUpdateDTO("x"), Void.class, 403);
            api.putAndRead(commentUrl(), new InternalCommentUpdateDTO("x"), Void.class, 403);
            api.deleteAndRead(commentUrl(), null, Void.class, 403);
        }
    }

    private String applicationCommentsUrl() {
        return applicationCommentsUrl(application.getApplicationId());
    }

    private String applicationCommentsUrl(UUID applicationId) {
        return String.format(APPLICATION_COMMENTS_URL, applicationId);
    }

    private String commentUrl() {
        return commentUrl(existingComment.getInternalCommentId());
    }

    private String commentUrl(UUID commentId) {
        return String.format(COMMENT_URL, commentId);
    }
}
