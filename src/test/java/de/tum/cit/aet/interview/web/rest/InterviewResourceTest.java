package de.tum.cit.aet.interview.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.application.constants.ApplicationState;
import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.application.repository.ApplicationRepository;
import de.tum.cit.aet.core.dto.PageResponseDTO;
import de.tum.cit.aet.evaluation.domain.enumeration.RecommendationDecision;
import de.tum.cit.aet.interview.domain.InterviewProcess;
import de.tum.cit.aet.interview.domain.InterviewSlot;
import de.tum.cit.aet.interview.domain.Interviewee;
import de.tum.cit.aet.interview.dto.AddIntervieweesDTO;
import de.tum.cit.aet.interview.dto.AssignSlotRequestDTO;
import de.tum.cit.aet.interview.dto.CreateSlotsDTO;
import de.tum.cit.aet.interview.dto.InterviewOverviewDTO;
import de.tum.cit.aet.interview.dto.InterviewSlotDTO;
import de.tum.cit.aet.interview.dto.IntervieweeDTO;
import de.tum.cit.aet.interview.dto.IntervieweeDetailDTO;
import de.tum.cit.aet.interview.dto.IntervieweeState;
import de.tum.cit.aet.interview.dto.SendInvitationsRequestDTO;
import de.tum.cit.aet.interview.dto.SendInvitationsResultDTO;
import de.tum.cit.aet.interview.dto.UpcomingInterviewDTO;
import de.tum.cit.aet.interview.dto.UpdateAssessmentDTO;
import de.tum.cit.aet.interview.repository.InterviewProcessRepository;
import de.tum.cit.aet.interview.repository.InterviewSlotRepository;
import de.tum.cit.aet.interview.repository.IntervieweeRepository;
import de.tum.cit.aet.interview.service.InterviewService;
import de.tum.cit.aet.interview.web.InterviewResource;
import de.tum.cit.aet.job.constants.JobState;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.job.repository.JobRepository;
import de.tum.cit.aet.notification.constants.EmailType;
import de.tum.cit.aet.notification.service.AsyncEmailSender;
import de.tum.cit.aet.notification.service.mail.Email;
import de.tum.cit.aet.usermanagement.domain.Applicant;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.repository.ApplicantRepository;
import de.tum.cit.aet.usermanagement.repository.ResearchGroupRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import de.tum.cit.aet.utility.DatabaseCleaner;
import de.tum.cit.aet.utility.MvcTestClient;
import de.tum.cit.aet.utility.security.JwtPostProcessors;
import de.tum.cit.aet.utility.testdata.ApplicantTestData;
import de.tum.cit.aet.utility.testdata.ApplicationTestData;
import de.tum.cit.aet.utility.testdata.JobTestData;
import de.tum.cit.aet.utility.testdata.ResearchGroupTestData;
import de.tum.cit.aet.utility.testdata.UserTestData;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.core.type.TypeReference;

class InterviewResourceTest extends AbstractResourceTest {

    @Autowired
    private InterviewProcessRepository interviewProcessRepository;

    @Autowired
    private InterviewSlotRepository interviewSlotRepository;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ResearchGroupRepository researchGroupRepository;

    @Autowired
    private IntervieweeRepository intervieweeRepository;

    @Autowired
    private ApplicationRepository applicationRepository;

    @Autowired
    private ApplicantRepository applicantRepository;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private MvcTestClient api;

    @Autowired
    private InterviewResource interviewResource;

    @Autowired
    private InterviewService interviewService;

    private AsyncEmailSender asyncEmailSenderMock;

    private User professor;
    private User employee;
    private Job job;
    private InterviewProcess interviewProcess;
    private ResearchGroup researchGroup;
    private Applicant testApplicant;
    private Application testApplication;
    private Interviewee testInterviewee;

    @BeforeEach
    void setup() {
        asyncEmailSenderMock = Mockito.mock(AsyncEmailSender.class);
        ReflectionTestUtils.setField(interviewService, "asyncEmailSender", asyncEmailSenderMock);
        databaseCleaner.clean();

        researchGroup = ResearchGroupTestData.savedAll(
            researchGroupRepository,
            "Algorithms Group",
            "Prof. Doe",
            "alg@example.com",
            "ALG",
            "We do cool stuff",
            "alg@example.com",
            "80333",
            "CIT",
            "Arcisstr. 21",
            "https://alg.tum.de",
            "ACTIVE"
        );

        professor = UserTestData.savedProfessorAll(
            userRepository,
            researchGroup,
            null,
            "prof.doe@tum.de",
            "John",
            "Doe",
            "en",
            "+49 89 1234",
            "https://doe.tum.de",
            "https://linkedin.com/in/doe",
            "DE",
            null,
            "männlich",
            UUID.randomUUID().toString().replace("-", "").substring(0, 7)
        );

        employee = UserTestData.savedEmployee(
            userRepository,
            researchGroup,
            "emp.smith@tum.de",
            "Emily",
            "Smith",
            UUID.randomUUID().toString().replace("-", "").substring(0, 7)
        );

        job = JobTestData.saved(jobRepository, professor, researchGroup, "Software Engineer", JobState.PUBLISHED, LocalDate.now());

        interviewProcess = new InterviewProcess();
        interviewProcess.setJob(job);
        interviewProcess = interviewProcessRepository.save(interviewProcess);

        // Shared test applicant and interviewee
        testApplicant = ApplicantTestData.savedWithNewUser(applicantRepository, userRepository);
        testApplicant.getUser().setAvatar("/images/profiles/applicant-avatar.jpg");
        userRepository.save(testApplicant.getUser());
        testApplication = ApplicationTestData.savedSent(applicationRepository, job, testApplicant);
        testInterviewee = createInterviewee(testApplication);
    }

    @Test
    void getInterviewProcessDetailsReturnsCorrectDetails() {
        InterviewOverviewDTO details = api
            .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
            .getAndRead("/api/interviews/processes/" + interviewProcess.getId(), null, InterviewOverviewDTO.class, 200);

        assertThat(details.jobId()).isEqualTo(job.getJobId());
        assertThat(details.jobTitle()).isEqualTo(job.getTitle());
        // Stats reflects the testInterviewee created in setup
        // Total interviews only counts SCHEDULED or COMPLETED. Setup creates
        // UNCONTACTED, so total is 0.
        assertThat(details.totalInterviews()).isEqualTo(0);
    }

    @Test
    void getInterviewProcessDetailsForbiddenForOtherUser() {
        // Create a separate research group for the other professor
        ResearchGroup otherResearchGroup = ResearchGroupTestData.savedAll(
            researchGroupRepository,
            "Other Group",
            "Prof. Smith",
            "other@example.com",
            "OTH",
            "Other research",
            "other@example.com",
            "80333",
            "CIT",
            "Other Street",
            "https://other.tum.de",
            "ACTIVE"
        );

        // Create another professor in a DIFFERENT research group
        User otherProfessor = UserTestData.savedProfessorAll(
            userRepository,
            otherResearchGroup,
            null,
            "other.prof@tum.de",
            "Jane",
            "Doe",
            "en",
            "+49 89 5678",
            "https://jane.tum.de",
            "https://linkedin.com/in/jane",
            "DE",
            null,
            "weiblich",
            UUID.randomUUID().toString().replace("-", "").substring(0, 7)
        );

        Void result = api
            .with(JwtPostProcessors.jwtUser(otherProfessor.getUserId(), "ROLE_PROFESSOR"))
            .getAndRead("/api/interviews/processes/" + interviewProcess.getId(), null, Void.class, 403);

        assertThat(result).isNull();
    }

    @Test
    void getInterviewProcessDetailsNotFoundForNonExistentId() {
        Void result = api
            .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
            .getAndRead("/api/interviews/processes/" + UUID.randomUUID(), null, Void.class, 404);

        assertThat(result).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = { "ROLE_PROFESSOR", "ROLE_EMPLOYEE" })
    void getInterviewOverviewAsProfessorOrEmployeeReturnsOverview(String role) {
        UUID userId = role.equals("ROLE_PROFESSOR") ? professor.getUserId() : employee.getUserId();
        List<InterviewOverviewDTO> overview = api
            .with(JwtPostProcessors.jwtUser(userId, role))
            .getAndRead("/api/interviews/overview", null, new TypeReference<List<InterviewOverviewDTO>>() {}, 200);

        assertThat(overview).isNotEmpty();
        assertThat(overview.get(0).jobId()).isEqualTo(job.getJobId());
        assertThat(overview.get(0).jobTitle()).isEqualTo(job.getTitle());
    }

    @Test
    void getInterviewOverviewAsProfessorReturnsEmptyList() {
        // Delete the existing process to simulate no processes
        interviewProcessRepository.deleteAll();

        List<InterviewOverviewDTO> overview = api
            .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
            .getAndRead("/api/interviews/overview", null, new TypeReference<List<InterviewOverviewDTO>>() {}, 200);

        assertThat(overview).isEmpty();
    }

    @Test
    void getInterviewOverviewAsStudentReturnsForbidden() {
        User student = UserTestData.createUserWithoutResearchGroup(userRepository, "student@tum.de", "Student", "One", "123456");

        Void result = api
            .with(JwtPostProcessors.jwtUser(student.getUserId(), "ROLE_STUDENT"))
            .getAndRead("/api/interviews/overview", null, Void.class, 403);

        assertThat(result).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = { "ROLE_PROFESSOR", "ROLE_EMPLOYEE" })
    void getUpcomingInterviewsAsProfessorOrEmployeeReturnsSlots(String role) {
        UUID userId = role.equals("ROLE_PROFESSOR") ? professor.getUserId() : employee.getUserId();
        // Arrange
        // Create an upcoming booked slot for the job belonging to the same research group
        CreateSlotsDTO.SlotInput slotInput = new CreateSlotsDTO.SlotInput(
            LocalDate.now().plusDays(1),
            LocalTime.of(10, 0),
            LocalTime.of(11, 0),
            "Room 101",
            null
        );
        CreateSlotsDTO dto = new CreateSlotsDTO(List.of(slotInput));

        // Create slot as professor
        List<InterviewSlotDTO> createdSlots = api
            .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
            .postAndRead(
                "/api/interviews/processes/" + interviewProcess.getId() + "/slots/create",
                dto,
                new TypeReference<List<InterviewSlotDTO>>() {},
                201
            );
        UUID slotId = createdSlots.get(0).id();

        // Assign applicant to slot to make it "booked"
        AssignSlotRequestDTO assignDTO = new AssignSlotRequestDTO(testApplication.getApplicationId());
        api
            .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
            .postAndRead("/api/interviews/slots/" + slotId + "/assign", assignDTO, InterviewSlotDTO.class, 200);

        // Act - Fetch upcoming
        List<UpcomingInterviewDTO> upcoming = api
            .with(JwtPostProcessors.jwtUser(userId, role))
            .getAndRead("/api/interviews/upcoming", null, new TypeReference<List<UpcomingInterviewDTO>>() {}, 200);

        // Assert
        assertThat(upcoming).hasSize(1);
        assertThat(upcoming.get(0).intervieweeName()).contains(testApplicant.getUser().getFirstName());
        assertThat(upcoming.get(0).intervieweeName()).contains(testApplicant.getUser().getLastName());
        assertThat(upcoming.get(0).avatar()).isEqualTo("/images/profiles/applicant-avatar.jpg");
    }

    @Test
    void createSlotsAsProfessorCreatesAndReturnsSlots() {
        CreateSlotsDTO.SlotInput slotInput = new CreateSlotsDTO.SlotInput(
            LocalDate.now().plusDays(1),
            LocalTime.of(10, 0),
            LocalTime.of(11, 0),
            "Room 101",
            "http://zoom.us/j/123"
        );
        CreateSlotsDTO dto = new CreateSlotsDTO(List.of(slotInput));

        List<InterviewSlotDTO> createdSlots = api
            .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
            .postAndRead(
                "/api/interviews/processes/" + interviewProcess.getId() + "/slots/create",
                dto,
                new TypeReference<List<InterviewSlotDTO>>() {},
                201
            );

        assertThat(createdSlots).hasSize(1);

        InterviewSlotDTO createdSlot = createdSlots.get(0);
        assertThat(createdSlot.location()).isEqualTo("Room 101");
        assertThat(createdSlot.streamLink()).isEqualTo("http://zoom.us/j/123");
        assertThat(createdSlot.isBooked()).isFalse();

        // Verify exact date and time values
        assertThat(createdSlot.startDateTime()).isNotNull();
        assertThat(createdSlot.endDateTime()).isNotNull();
        // Convert to LocalDateTime and check the exact values we sent
        LocalDateTime expectedStart = LocalDateTime.of(LocalDate.now().plusDays(1), LocalTime.of(10, 0));
        LocalDateTime expectedEnd = LocalDateTime.of(LocalDate.now().plusDays(1), LocalTime.of(11, 0));
        assertThat(createdSlot.startDateTime().atZone(ZoneId.of("Europe/Berlin")).toLocalDateTime()).isEqualTo(expectedStart);
        assertThat(createdSlot.endDateTime().atZone(ZoneId.of("Europe/Berlin")).toLocalDateTime()).isEqualTo(expectedEnd);

        // Verify persistence
        List<InterviewSlot> savedSlots = interviewSlotRepository.findAll();
        assertThat(savedSlots).hasSize(1);
        assertThat(savedSlots.get(0).getLocation()).isEqualTo("Room 101");
    }

    @Test
    void createSlotsWithTimeConflictReturnsConflict() {
        // Create an existing slot
        CreateSlotsDTO.SlotInput slotInput = new CreateSlotsDTO.SlotInput(
            LocalDate.now().plusDays(1),
            LocalTime.of(10, 0),
            LocalTime.of(11, 0),
            "Room 101",
            null
        );
        CreateSlotsDTO dto = new CreateSlotsDTO(List.of(slotInput));

        // First creation succeeds
        api
            .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
            .postAndRead(
                "/api/interviews/processes/" + interviewProcess.getId() + "/slots/create",
                dto,
                new TypeReference<List<InterviewSlotDTO>>() {},
                201
            );

        // Second creation with overlapping time should fail
        Void result = api
            .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
            .postAndRead("/api/interviews/processes/" + interviewProcess.getId() + "/slots/create", dto, Void.class, 409);
        assertThat(result).isNull();
    }

    @Test
    void createSlotsWithInvalidDataReturnsBadRequest() {
        CreateSlotsDTO.SlotInput invalidInput = new CreateSlotsDTO.SlotInput(
            null, // date is required
            LocalTime.of(10, 0),
            LocalTime.of(11, 0),
            "Room 101",
            null
        );
        CreateSlotsDTO dto = new CreateSlotsDTO(List.of(invalidInput));

        Void result = api
            .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
            .postAndRead("/api/interviews/processes/" + interviewProcess.getId() + "/slots/create", dto, Void.class, 400);
        assertThat(result).isNull();
    }

    @Test
    void createSlotsForOtherProfessorJobReturnsForbidden() {
        // Create a separate research group for the other professor
        ResearchGroup otherResearchGroup = ResearchGroupTestData.savedAll(
            researchGroupRepository,
            "Other Group",
            "Prof. Smith",
            "other@example.com",
            "OTH",
            "Other research",
            "other@example.com",
            "80333",
            "CIT",
            "Other Street",
            "https://other.tum.de",
            "ACTIVE"
        );

        // Create another professor in a DIFFERENT research group
        User otherProfessor = UserTestData.savedProfessorAll(
            userRepository,
            otherResearchGroup,
            null,
            "other.prof@tum.de",
            "Jane",
            "Doe",
            "en",
            "+49 89 5678",
            "https://jane.tum.de",
            "https://linkedin.com/in/jane",
            "DE",
            null,
            "weiblich",
            UUID.randomUUID().toString().replace("-", "").substring(0, 7)
        );

        CreateSlotsDTO.SlotInput slotInput = new CreateSlotsDTO.SlotInput(
            LocalDate.now().plusDays(1),
            LocalTime.of(10, 0),
            LocalTime.of(11, 0),
            "Room 101",
            null
        );
        CreateSlotsDTO dto = new CreateSlotsDTO(List.of(slotInput));

        Void result = api
            .with(JwtPostProcessors.jwtUser(otherProfessor.getUserId(), "ROLE_PROFESSOR"))
            .postAndRead("/api/interviews/processes/" + interviewProcess.getId() + "/slots/create", dto, Void.class, 403);
        assertThat(result).isNull();
    }

    @Test
    void createSlotsForNonExistentProcessReturnsNotFound() {
        CreateSlotsDTO.SlotInput slotInput = new CreateSlotsDTO.SlotInput(
            LocalDate.now().plusDays(1),
            LocalTime.of(10, 0),
            LocalTime.of(11, 0),
            "Room 101",
            null
        );
        CreateSlotsDTO dto = new CreateSlotsDTO(List.of(slotInput));

        Void result = api
            .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
            .postAndRead("/api/interviews/processes/" + UUID.randomUUID() + "/slots/create", dto, Void.class, 404);
        assertThat(result).isNull();
    }

    @Test
    void getSlotsByProcessIdAsProfessorReturnsSlots() {
        CreateSlotsDTO.SlotInput slotInput1 = new CreateSlotsDTO.SlotInput(
            LocalDate.now().plusDays(1),
            LocalTime.of(10, 0),
            LocalTime.of(11, 0),
            "Room 101",
            null
        );
        CreateSlotsDTO.SlotInput slotInput2 = new CreateSlotsDTO.SlotInput(
            LocalDate.now().plusDays(1),
            LocalTime.of(11, 0),
            LocalTime.of(12, 0),
            "Room 102",
            null
        );
        CreateSlotsDTO dto = new CreateSlotsDTO(List.of(slotInput1, slotInput2));

        api
            .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
            .postAndRead(
                "/api/interviews/processes/" + interviewProcess.getId() + "/slots/create",
                dto,
                new TypeReference<List<InterviewSlotDTO>>() {},
                201
            );

        // Get slots with pagination (add year and month to match server-side filtering)
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        String url =
            "/api/interviews/processes/" +
            interviewProcess.getId() +
            "/slots?year=" +
            tomorrow.getYear() +
            "&month=" +
            tomorrow.getMonthValue();

        PageResponseDTO<InterviewSlotDTO> response = api
            .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
            .getAndRead(url, null, new TypeReference<PageResponseDTO<InterviewSlotDTO>>() {}, 200);

        List<InterviewSlotDTO> slots = new java.util.ArrayList<>(response.getContent());
        assertThat(slots).hasSize(2);

        // Verify first slot
        InterviewSlotDTO firstSlot = slots.get(0);
        assertThat(firstSlot.location()).isEqualTo("Room 101");
        assertThat(firstSlot.streamLink()).isNull();
        assertThat(firstSlot.isBooked()).isFalse();
        LocalDateTime expectedStart1 = LocalDateTime.of(LocalDate.now().plusDays(1), LocalTime.of(10, 0));
        LocalDateTime expectedEnd1 = LocalDateTime.of(LocalDate.now().plusDays(1), LocalTime.of(11, 0));
        assertThat(firstSlot.startDateTime().atZone(ZoneId.of("Europe/Berlin")).toLocalDateTime()).isEqualTo(expectedStart1);
        assertThat(firstSlot.endDateTime().atZone(ZoneId.of("Europe/Berlin")).toLocalDateTime()).isEqualTo(expectedEnd1);

        // Verify second slot
        InterviewSlotDTO secondSlot = slots.get(1);
        assertThat(secondSlot.location()).isEqualTo("Room 102");
        assertThat(secondSlot.streamLink()).isNull();
        assertThat(secondSlot.isBooked()).isFalse();
        LocalDateTime expectedStart2 = LocalDateTime.of(LocalDate.now().plusDays(1), LocalTime.of(11, 0));
        LocalDateTime expectedEnd2 = LocalDateTime.of(LocalDate.now().plusDays(1), LocalTime.of(12, 0));
        assertThat(secondSlot.startDateTime().atZone(ZoneId.of("Europe/Berlin")).toLocalDateTime()).isEqualTo(expectedStart2);
        assertThat(secondSlot.endDateTime().atZone(ZoneId.of("Europe/Berlin")).toLocalDateTime()).isEqualTo(expectedEnd2);

        // Verify chronological ordering
        assertThat(firstSlot.startDateTime()).isBefore(secondSlot.startDateTime());
    }

    @Test
    void getSlotsByProcessIdForOtherProfessorReturnsForbidden() {
        // Create a separate research group for the other professor
        ResearchGroup otherResearchGroup = ResearchGroupTestData.savedAll(
            researchGroupRepository,
            "Other Group",
            "Prof. Smith",
            "other@example.com",
            "OTH",
            "Other research",
            "other@example.com",
            "80333",
            "CIT",
            "Other Street",
            "https://other.tum.de",
            "ACTIVE"
        );

        // Create another professor in a DIFFERENT research group
        User otherProfessor = UserTestData.savedProfessorAll(
            userRepository,
            otherResearchGroup,
            null,
            "other.prof@tum.de",
            "Jane",
            "Doe",
            "en",
            "+49 89 5678",
            "https://jane.tum.de",
            "https://linkedin.com/in/jane",
            "DE",
            null,
            "weiblich",
            UUID.randomUUID().toString().replace("-", "").substring(0, 7)
        );

        Void result = api
            .with(JwtPostProcessors.jwtUser(otherProfessor.getUserId(), "ROLE_PROFESSOR"))
            .getAndRead("/api/interviews/processes/" + interviewProcess.getId() + "/slots", null, Void.class, 403);
        assertThat(result).isNull();
    }

    @Test
    void getSlotsByProcessIdForNonExistentProcessReturnsNotFound() {
        api
            .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
            .getAndRead("/api/interviews/processes/" + UUID.randomUUID() + "/slots", null, Void.class, 404);
    }

    @Nested
    class GetIntervieweeDetails {

        @ParameterizedTest(name = "should return full interviewee details for {0}")
        @ValueSource(strings = { "ROLE_PROFESSOR", "ROLE_EMPLOYEE" })
        void shouldReturnFullDetailsForProfessorOrEmployee(String role) {
            UUID userId = role.equals("ROLE_PROFESSOR") ? professor.getUserId() : employee.getUserId();
            IntervieweeDetailDTO result = api
                .with(JwtPostProcessors.jwtUser(userId, role))
                .getAndRead(
                    "/api/interviews/processes/" + interviewProcess.getId() + "/interviewees/" + testInterviewee.getId(),
                    null,
                    IntervieweeDetailDTO.class,
                    200
                );

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.id()).isEqualTo(testInterviewee.getId());
            assertThat(result.applicationId()).isEqualTo(testApplication.getApplicationId());
            assertThat(result.user()).isNotNull();
            assertThat(result.user().email()).isEqualTo(testApplicant.getUser().getEmail());
            assertThat(result.application()).isNotNull();
            assertThat(result.application().motivation()).isEqualTo(testApplication.getMotivation());
        }

        @Test
        void getIntervieweeDetailsWithNonExistentIdReturns404() {
            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(
                    "/api/interviews/processes/" + interviewProcess.getId() + "/interviewees/" + UUID.randomUUID(),
                    null,
                    Void.class,
                    404
                );
        }

        @Test
        void getIntervieweeDetailsForOtherProfessorReturns403() {
            User otherProfessor = UserTestData.savedOtherProfessor(userRepository, researchGroupRepository);

            api
                .with(JwtPostProcessors.jwtUser(otherProfessor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(
                    "/api/interviews/processes/" + interviewProcess.getId() + "/interviewees/" + testInterviewee.getId(),
                    null,
                    Void.class,
                    403
                );
        }
    }

    @Nested
    class UpdateAssessment {

        @Test
        void updateAssessmentWithRatingOnlyAsProfessorReturnsUpdatedDetails() {
            // Arrange - create new interviewee since we modify it
            Applicant applicant = ApplicantTestData.savedWithNewUser(applicantRepository, userRepository);
            Application application = ApplicationTestData.savedSent(applicationRepository, job, applicant);
            Interviewee interviewee = createInterviewee(application);
            UpdateAssessmentDTO dto = new UpdateAssessmentDTO(RecommendationDecision.STRONG_PASS, null, null);

            // Act
            IntervieweeDetailDTO result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(
                    "/api/interviews/processes/" + interviewProcess.getId() + "/interviewees/" + interviewee.getId() + "/assessment",
                    dto,
                    IntervieweeDetailDTO.class,
                    200
                );

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.rating()).isEqualTo(RecommendationDecision.STRONG_PASS);
            assertThat(result.assessmentNotes()).isNull();

            // Verify persistence
            Interviewee saved = intervieweeRepository.findById(interviewee.getId()).orElseThrow();
            assertThat(saved.getRating()).isEqualTo(RecommendationDecision.STRONG_PASS);
        }

        @Test
        void updateAssessmentAsEmployeeReturnsUpdatedDetails() {
            // Arrange
            Applicant applicant = ApplicantTestData.savedWithNewUser(applicantRepository, userRepository);
            Application application = ApplicationTestData.savedSent(applicationRepository, job, applicant);
            Interviewee interviewee = createInterviewee(application);
            UpdateAssessmentDTO dto = new UpdateAssessmentDTO(RecommendationDecision.SOFT_PASS, null, "Good candidate.");

            // Act - use employee role
            IntervieweeDetailDTO result = api
                .with(JwtPostProcessors.jwtUser(employee.getUserId(), "ROLE_EMPLOYEE"))
                .putAndRead(
                    "/api/interviews/processes/" + interviewProcess.getId() + "/interviewees/" + interviewee.getId() + "/assessment",
                    dto,
                    IntervieweeDetailDTO.class,
                    200
                );

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.rating()).isEqualTo(RecommendationDecision.SOFT_PASS);
            assertThat(result.assessmentNotes()).isEqualTo("Good candidate.");
        }

        @Test
        void updateAssessmentWithNotesOnlyReturnsUpdatedDetails() {
            // Arrange
            Applicant applicant = ApplicantTestData.savedWithNewUser(applicantRepository, userRepository);
            Application application = ApplicationTestData.savedSent(applicationRepository, job, applicant);
            Interviewee interviewee = createInterviewee(application);
            UpdateAssessmentDTO dto = new UpdateAssessmentDTO(null, null, "Good candidate with strong technical skills.");

            // Act
            IntervieweeDetailDTO result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(
                    "/api/interviews/processes/" + interviewProcess.getId() + "/interviewees/" + interviewee.getId() + "/assessment",
                    dto,
                    IntervieweeDetailDTO.class,
                    200
                );

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.assessmentNotes()).isEqualTo("Good candidate with strong technical skills.");

            // Verify persistence
            Interviewee saved = intervieweeRepository.findById(interviewee.getId()).orElseThrow();
            assertThat(saved.getAssessmentNotes()).isEqualTo("Good candidate with strong technical skills.");
        }

        @Test
        void shouldStripUnsafeHtmlWhenNotesContainScript() {
            Applicant applicant = ApplicantTestData.savedWithNewUser(applicantRepository, userRepository);
            Application application = ApplicationTestData.savedSent(applicationRepository, job, applicant);
            Interviewee interviewee = createInterviewee(application);
            UpdateAssessmentDTO dto = new UpdateAssessmentDTO(null, null, "<p>Strong candidate</p><script>alert('x')</script>");

            IntervieweeDetailDTO result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(
                    "/api/interviews/processes/" + interviewProcess.getId() + "/interviewees/" + interviewee.getId() + "/assessment",
                    dto,
                    IntervieweeDetailDTO.class,
                    200
                );

            assertThat(result.assessmentNotes()).isEqualTo("<p>Strong candidate</p>");
            Interviewee saved = intervieweeRepository.findById(interviewee.getId()).orElseThrow();
            assertThat(saved.getAssessmentNotes()).isEqualTo("<p>Strong candidate</p>");
        }

        @Test
        void updateAssessmentWithClearRatingRemovesRating() {
            // Arrange - create interviewee with existing rating
            Applicant applicant = ApplicantTestData.savedWithNewUser(applicantRepository, userRepository);
            Application application = ApplicationTestData.savedSent(applicationRepository, job, applicant);
            Interviewee interviewee = createInterviewee(application);
            interviewee.setRating(RecommendationDecision.SOFT_PASS);
            intervieweeRepository.save(interviewee);

            UpdateAssessmentDTO dto = new UpdateAssessmentDTO(null, true, null);

            // Act
            IntervieweeDetailDTO result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(
                    "/api/interviews/processes/" + interviewProcess.getId() + "/interviewees/" + interviewee.getId() + "/assessment",
                    dto,
                    IntervieweeDetailDTO.class,
                    200
                );

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.rating()).isNull();

            // Verify persistence
            Interviewee saved = intervieweeRepository.findById(interviewee.getId()).orElseThrow();
            assertThat(saved.getRating()).isNull();
        }

        static Stream<Object> invalidRatings() {
            return Stream.of(0, 5, "NEUTRAL");
        }

        @ParameterizedTest
        @MethodSource("invalidRatings")
        void shouldRejectAssessmentWhenRatingIsNotADecision(Object invalidRating) {
            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(
                    "/api/interviews/processes/" + interviewProcess.getId() + "/interviewees/" + testInterviewee.getId() + "/assessment",
                    Map.of("rating", invalidRating),
                    Void.class,
                    400
                );

            assertThat(intervieweeRepository.findById(testInterviewee.getId()).orElseThrow().getRating()).isNull();
        }

        @Test
        void updateAssessmentWithEmptyBodyReturns400() {
            UpdateAssessmentDTO dto = new UpdateAssessmentDTO(null, null, null);

            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(
                    "/api/interviews/processes/" + interviewProcess.getId() + "/interviewees/" + testInterviewee.getId() + "/assessment",
                    dto,
                    Void.class,
                    400
                );
        }

        @Test
        void updateAssessmentForNonExistentIntervieweeReturns404() {
            UpdateAssessmentDTO dto = new UpdateAssessmentDTO(RecommendationDecision.SOFT_PASS, null, "Test notes");

            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(
                    "/api/interviews/processes/" + interviewProcess.getId() + "/interviewees/" + UUID.randomUUID() + "/assessment",
                    dto,
                    Void.class,
                    404
                );
        }

        @Test
        void updateAssessmentForOtherProfessorReturns403() {
            User otherProfessor = UserTestData.savedOtherProfessor(userRepository, researchGroupRepository);
            UpdateAssessmentDTO dto = new UpdateAssessmentDTO(RecommendationDecision.SOFT_PASS, null, "Test notes");

            api
                .with(JwtPostProcessors.jwtUser(otherProfessor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(
                    "/api/interviews/processes/" + interviewProcess.getId() + "/interviewees/" + testInterviewee.getId() + "/assessment",
                    dto,
                    Void.class,
                    403
                );
        }
    }

    // --- Helper methods ---
    private Interviewee createInterviewee(Application application) {
        Interviewee interviewee = new Interviewee();
        interviewee.setInterviewProcess(interviewProcess);
        interviewee.setApplication(application);
        return intervieweeRepository.save(interviewee);
    }

    // ===========================================================================================
    // Tests for assigning Interviewee to slot
    // ===========================================================================================

    @Nested
    class AssignSlotToInterviewee {

        @Test
        void assignSlotSuccessfullyAssignsInterviewee() {
            // Arrange
            InterviewSlot slot = createTestSlot();
            Applicant applicant = ApplicantTestData.savedWithNewUser(applicantRepository, userRepository);
            Application application = ApplicationTestData.savedSent(applicationRepository, job, applicant);

            Interviewee interviewee = new Interviewee();
            interviewee.setInterviewProcess(interviewProcess);
            interviewee.setApplication(application);
            interviewee.setLastInvited(java.time.Instant.now());
            intervieweeRepository.save(interviewee);

            AssignSlotRequestDTO requestDTO = new AssignSlotRequestDTO(application.getApplicationId());

            // Act
            InterviewSlotDTO result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/interviews/slots/" + slot.getId() + "/assign", requestDTO, InterviewSlotDTO.class, 200);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.id()).isEqualTo(slot.getId());
            assertThat(result.isBooked()).isTrue();
            assertThat(result.interviewee()).isNotNull();
            assertThat(result.interviewee().applicationId()).isEqualTo(application.getApplicationId());

            // Verify 2 emails sent: 1 to applicant, 1 to professor
            ArgumentCaptor<Email> emailCaptor = ArgumentCaptor.forClass(Email.class);
            verify(asyncEmailSenderMock, times(2)).sendAsync(emailCaptor.capture());

            List<Email> sentEmails = emailCaptor.getAllValues();
            assertThat(sentEmails).hasSize(2);
            assertThat(sentEmails.stream().map(Email::getEmailType)).containsExactlyInAnyOrder(
                EmailType.INTERVIEW_INVITATION,
                EmailType.INTERVIEW_ASSIGNED_PROFESSOR
            );
        }

        @Test
        void assignSlotReturnsNotFoundForNonExistentSlot() {
            // Arrange
            UUID nonExistentSlotId = UUID.randomUUID();
            AssignSlotRequestDTO requestDTO = new AssignSlotRequestDTO(UUID.randomUUID());

            // Act
            Void result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/interviews/slots/" + nonExistentSlotId + "/assign", requestDTO, Void.class, 404);

            // Assert
            assertThat(result).isNull();
        }

        @Test
        void assignSlotReturnsConflictWhenSlotAlreadyBooked() {
            // Arrange
            InterviewSlot slot = createTestSlot();
            slot.setIsBooked(true);
            interviewSlotRepository.save(slot);

            AssignSlotRequestDTO requestDTO = new AssignSlotRequestDTO(UUID.randomUUID());

            // Act
            Void result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/interviews/slots/" + slot.getId() + "/assign", requestDTO, Void.class, 409);

            // Assert
            assertThat(result).isNull();
        }

        @Test
        void assignSlotReturnsNotFoundWhenApplicantNotInProcess() {
            // Arrange
            InterviewSlot slot = createTestSlot();
            UUID nonExistentApplicationId = UUID.randomUUID();
            AssignSlotRequestDTO requestDTO = new AssignSlotRequestDTO(nonExistentApplicationId);

            // Act
            Void result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/interviews/slots/" + slot.getId() + "/assign", requestDTO, Void.class, 404);

            // Assert
            assertThat(result).isNull();
        }

        @Test
        void assignSlotReturnsBadRequestWhenIntervieweeAlreadyHasSlot() {
            // Arrange - Create first slot and assign it
            InterviewSlot slot1 = createTestSlot();
            Applicant applicant = ApplicantTestData.savedWithNewUser(applicantRepository, userRepository);
            Application application = ApplicationTestData.savedSent(applicationRepository, job, applicant);

            Interviewee interviewee = new Interviewee();
            interviewee.setInterviewProcess(interviewProcess);
            interviewee.setApplication(application);
            interviewee.setLastInvited(java.time.Instant.now());
            interviewee = intervieweeRepository.save(interviewee);

            slot1.setInterviewee(interviewee);
            slot1.setIsBooked(true);
            interviewSlotRepository.save(slot1);
            interviewee.getSlots().add(slot1);
            intervieweeRepository.save(interviewee);

            // Arrange - Create second slot
            InterviewSlot slot2 = createTestSlot();
            AssignSlotRequestDTO requestDTO = new AssignSlotRequestDTO(application.getApplicationId());

            // Act
            Void result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/interviews/slots/" + slot2.getId() + "/assign", requestDTO, Void.class, 400);

            // Assert
            assertThat(result).isNull();
        }

        @Test
        void assignSlotAsEmployeeSuccessfullyAssignsInterviewee() {
            // Arrange - Create an employee in the same research group
            User employee = UserTestData.savedProfessorAll(
                userRepository,
                researchGroup,
                null,
                "employee@tum.de",
                "Max",
                "Employee",
                "en",
                "+49 89 9999",
                "https://employee.tum.de",
                null,
                "DE",
                null,
                "männlich",
                UUID.randomUUID().toString().replace("-", "").substring(0, 7)
            );

            InterviewSlot slot = createTestSlot();
            Applicant applicant = ApplicantTestData.savedWithNewUser(applicantRepository, userRepository);
            Application application = ApplicationTestData.savedSent(applicationRepository, job, applicant);

            Interviewee interviewee = new Interviewee();
            interviewee.setInterviewProcess(interviewProcess);
            interviewee.setApplication(application);
            interviewee.setLastInvited(java.time.Instant.now());
            intervieweeRepository.save(interviewee);

            AssignSlotRequestDTO requestDTO = new AssignSlotRequestDTO(application.getApplicationId());

            // Act - Employee role should be allowed by @ProfessorOrEmployee
            InterviewSlotDTO result = api
                .with(JwtPostProcessors.jwtUser(employee.getUserId(), "ROLE_EMPLOYEE"))
                .postAndRead("/api/interviews/slots/" + slot.getId() + "/assign", requestDTO, InterviewSlotDTO.class, 200);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.id()).isEqualTo(slot.getId());
            assertThat(result.isBooked()).isTrue();
            assertThat(result.interviewee()).isNotNull();
            assertThat(result.interviewee().applicationId()).isEqualTo(application.getApplicationId());
        }
    }

    // Helper method
    private InterviewSlot createTestSlot() {
        InterviewSlot slot = new InterviewSlot();
        slot.setInterviewProcess(interviewProcess);
        slot.setStartDateTime(java.time.Instant.now().plusSeconds(86400));
        slot.setEndDateTime(java.time.Instant.now().plusSeconds(90000));
        slot.setLocation("Room 101");
        slot.setIsBooked(false);
        return interviewSlotRepository.save(slot);
    }

    // ===========================================================================================
    // Tests for sending self-scheduling invitations
    // ===========================================================================================

    @Nested
    class SendInvitations {

        private Applicant applicant1;
        private Applicant applicant2;
        private Application app1;
        private Application app2;
        private Interviewee interviewee1;
        private Interviewee interviewee2;

        @BeforeEach
        void setupInterviewees() {
            applicant1 = ApplicantTestData.savedWithNewUser(applicantRepository, userRepository);
            app1 = ApplicationTestData.savedSent(applicationRepository, job, applicant1);
            interviewee1 = new Interviewee();
            interviewee1.setInterviewProcess(interviewProcess);
            interviewee1.setApplication(app1);
            interviewee1 = intervieweeRepository.save(interviewee1);

            applicant2 = ApplicantTestData.savedWithNewUser(applicantRepository, userRepository);
            app2 = ApplicationTestData.savedSent(applicationRepository, job, applicant2);
            interviewee2 = new Interviewee();
            interviewee2.setInterviewProcess(interviewProcess);
            interviewee2.setApplication(app2);
            interviewee2 = intervieweeRepository.save(interviewee2);
        }

        @Test
        void sendInvitationsSuccessfullySendsEmails() {
            // Arrange
            SendInvitationsRequestDTO requestDTO = new SendInvitationsRequestDTO(false, null);

            // Act
            SendInvitationsResultDTO result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead(
                    "/api/interviews/processes/" + interviewProcess.getId() + "/send-invitations",
                    requestDTO,
                    SendInvitationsResultDTO.class,
                    200
                );

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.sentCount()).isEqualTo(3);
            assertThat(result.failedEmails() == null || result.failedEmails().isEmpty())
                .as("Failed emails should be null or empty")
                .isTrue();

            ArgumentCaptor<Email> emailCaptor = ArgumentCaptor.forClass(Email.class);
            verify(asyncEmailSenderMock, times(3)).sendAsync(emailCaptor.capture());

            List<Email> sentEmails = emailCaptor.getAllValues();
            assertThat(sentEmails).hasSize(3);
            assertThat(sentEmails).allMatch(email -> email.getEmailType() == EmailType.INTERVIEW_SELF_SCHEDULING_INVITATION);
        }

        @Test
        void sendInvitationsWithFilterReturnsCorrectResult() {
            // Arrange: Mark interviewee1 as already invited
            interviewee1.setLastInvited(java.time.Instant.now());
            intervieweeRepository.save(interviewee1);

            SendInvitationsRequestDTO requestDTO = new SendInvitationsRequestDTO(true, null);

            // Act
            SendInvitationsResultDTO result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead(
                    "/api/interviews/processes/" + interviewProcess.getId() + "/send-invitations",
                    requestDTO,
                    SendInvitationsResultDTO.class,
                    200
                );

            // Assert
            assertThat(result.sentCount()).isEqualTo(2);

            ArgumentCaptor<Email> emailCaptor = ArgumentCaptor.forClass(Email.class);
            verify(asyncEmailSenderMock, times(2)).sendAsync(emailCaptor.capture());

            Email sentEmail = emailCaptor.getValue();
            assertThat(sentEmail.getEmailType()).isEqualTo(EmailType.INTERVIEW_SELF_SCHEDULING_INVITATION);
            assertThat(sentEmail.getTo()).hasSize(1);
            assertThat(sentEmail.getTo().iterator().next().getEmail()).isEqualTo(applicant2.getUser().getEmail());
        }

        @Test
        void sendInvitationsIndividualSelection() {
            // Arrange: Select only interviewee1
            SendInvitationsRequestDTO requestDTO = new SendInvitationsRequestDTO(false, List.of(interviewee1.getId()));

            // Act
            SendInvitationsResultDTO result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead(
                    "/api/interviews/processes/" + interviewProcess.getId() + "/send-invitations",
                    requestDTO,
                    SendInvitationsResultDTO.class,
                    200
                );

            // Assert
            assertThat(result.sentCount()).isEqualTo(1);

            ArgumentCaptor<Email> emailCaptor = ArgumentCaptor.forClass(Email.class);
            verify(asyncEmailSenderMock, times(1)).sendAsync(emailCaptor.capture());

            Email sentEmail = emailCaptor.getValue();
            assertThat(sentEmail.getTo()).hasSize(1);
            assertThat(sentEmail.getTo().iterator().next().getEmail()).isEqualTo(applicant1.getUser().getEmail());
        }

        @Test
        void sendInvitationsReturnsNotFoundForNonExistentProcess() {
            SendInvitationsRequestDTO requestDTO = new SendInvitationsRequestDTO(false, null);
            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/interviews/processes/" + UUID.randomUUID() + "/send-invitations", requestDTO, Void.class, 404);
        }

        @Test
        void sendInvitationsReturnsForbiddenForUnauthorizedUser() {
            SendInvitationsRequestDTO requestDTO = new SendInvitationsRequestDTO(false, null);

            // Create a student/random user
            User student = UserTestData.createUserWithoutResearchGroup(userRepository, "student@tum.de", "Student", "One", "123456");

            api
                .with(JwtPostProcessors.jwtUser(student.getUserId(), "ROLE_STUDENT"))
                .postAndRead("/api/interviews/processes/" + interviewProcess.getId() + "/send-invitations", requestDTO, Void.class, 403);
        }
    }

    // ===========================================================================================
    // Tests for deleting interview slots
    // ===========================================================================================

    @Nested
    class DeleteSlot {

        @ParameterizedTest
        @ValueSource(strings = { "ROLE_PROFESSOR", "ROLE_EMPLOYEE" })
        void deleteUnbookedSlotAsProfessorOrEmployeeReturnsNoContent(String role) {
            UUID userId = role.equals("ROLE_PROFESSOR") ? professor.getUserId() : employee.getUserId();
            InterviewSlot slot = createTestSlot();

            api.with(JwtPostProcessors.jwtUser(userId, role)).deleteAndRead("/api/interviews/slots/" + slot.getId(), null, Void.class, 204);

            assertThat(interviewSlotRepository.findById(slot.getId())).isEmpty();
        }

        @Test
        void deleteBookedSlotReturnsBadRequest() {
            InterviewSlot slot = createTestSlot();
            slot.setIsBooked(true);
            interviewSlotRepository.save(slot);

            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .deleteAndRead("/api/interviews/slots/" + slot.getId(), null, Void.class, 400);

            // Slot should still exist and remain booked
            InterviewSlot savedSlot = interviewSlotRepository.findById(slot.getId()).orElseThrow();
            assertThat(savedSlot.getIsBooked()).isTrue();
            assertThat(savedSlot.getLocation()).isEqualTo("Room 101");
        }

        @Test
        void deleteNonExistentSlotReturnsNotFound() {
            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .deleteAndRead("/api/interviews/slots/" + UUID.randomUUID(), null, Void.class, 404);
        }

        @Test
        void deleteSlotForOtherProfessorReturnsForbidden() {
            InterviewSlot slot = createTestSlot();
            User otherProfessor = UserTestData.savedOtherProfessor(userRepository, researchGroupRepository);

            api
                .with(JwtPostProcessors.jwtUser(otherProfessor.getUserId(), "ROLE_PROFESSOR"))
                .deleteAndRead("/api/interviews/slots/" + slot.getId(), null, Void.class, 403);

            // Slot should still exist as it was
            InterviewSlot savedSlot = interviewSlotRepository.findById(slot.getId()).orElseThrow();
            assertThat(savedSlot.getIsBooked()).isFalse();
            assertThat(savedSlot.getLocation()).isEqualTo("Room 101");
        }
    }

    // ===========================================================================================
    // Tests for adding applicants to interview process
    // ===========================================================================================

    @Nested
    class AddApplicantsToInterview {

        @ParameterizedTest
        @ValueSource(strings = { "ROLE_PROFESSOR", "ROLE_EMPLOYEE" })
        void addApplicantsAsProfessorOrEmployeeCreatesInterviewees(String role) {
            UUID userId = role.equals("ROLE_PROFESSOR") ? professor.getUserId() : employee.getUserId();
            Applicant applicant = ApplicantTestData.savedWithNewUser(applicantRepository, userRepository);
            Application application = ApplicationTestData.savedSent(applicationRepository, job, applicant);

            AddIntervieweesDTO dto = new AddIntervieweesDTO(List.of(application.getApplicationId()));

            List<IntervieweeDTO> result = api
                .with(JwtPostProcessors.jwtUser(userId, role))
                .postAndRead(
                    "/api/interviews/processes/" + interviewProcess.getId() + "/interviewees",
                    dto,
                    new TypeReference<List<IntervieweeDTO>>() {},
                    201
                );

            assertThat(result).hasSize(1);
            assertThat(result.get(0).applicationId()).isEqualTo(application.getApplicationId());
            assertThat(result.get(0).state()).isEqualTo(IntervieweeState.UNCONTACTED);

            // Verify application state was updated to INTERVIEW
            Application updated = applicationRepository.findById(application.getApplicationId()).orElseThrow();
            assertThat(updated.getState()).isEqualTo(ApplicationState.INTERVIEW);
        }

        @Test
        void addDuplicateApplicantSkipsDuplicate() {
            // testInterviewee already exists from setup with testApplication
            AddIntervieweesDTO dto = new AddIntervieweesDTO(List.of(testApplication.getApplicationId()));

            List<IntervieweeDTO> result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead(
                    "/api/interviews/processes/" + interviewProcess.getId() + "/interviewees",
                    dto,
                    new TypeReference<List<IntervieweeDTO>>() {},
                    201
                );

            // Should return empty list since the interviewee already exists
            assertThat(result).isEmpty();
        }

        @Test
        void addApplicantsForNonExistentProcessReturnsNotFound() {
            AddIntervieweesDTO dto = new AddIntervieweesDTO(List.of(UUID.randomUUID()));

            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/interviews/processes/" + UUID.randomUUID() + "/interviewees", dto, Void.class, 404);
        }

        @Test
        void addApplicantsForOtherProfessorReturnsForbidden() {
            User otherProfessor = UserTestData.savedOtherProfessor(userRepository, researchGroupRepository);
            AddIntervieweesDTO dto = new AddIntervieweesDTO(List.of(testApplication.getApplicationId()));

            api
                .with(JwtPostProcessors.jwtUser(otherProfessor.getUserId(), "ROLE_PROFESSOR"))
                .postAndRead("/api/interviews/processes/" + interviewProcess.getId() + "/interviewees", dto, Void.class, 403);
        }
    }

    // ===========================================================================================
    // Tests for getting interviewees by process ID
    // ===========================================================================================

    @Nested
    class GetIntervieweesByProcessId {

        @ParameterizedTest
        @ValueSource(strings = { "ROLE_PROFESSOR", "ROLE_EMPLOYEE" })
        void getIntervieweesAsProfessorOrEmployeeReturnsList(String role) {
            UUID userId = role.equals("ROLE_PROFESSOR") ? professor.getUserId() : employee.getUserId();
            List<IntervieweeDTO> result = api
                .with(JwtPostProcessors.jwtUser(userId, role))
                .getAndRead(
                    "/api/interviews/processes/" + interviewProcess.getId() + "/interviewees",
                    null,
                    new TypeReference<List<IntervieweeDTO>>() {},
                    200
                );

            // testInterviewee from setup should be present with correct details
            assertThat(result).hasSize(1);
            IntervieweeDTO dto = result.get(0);
            assertThat(dto.applicationId()).isEqualTo(testApplication.getApplicationId());
            assertThat(dto.user().email()).isEqualTo(testApplicant.getUser().getEmail());
            assertThat(dto.state()).isEqualTo(IntervieweeState.UNCONTACTED);
        }

        @Test
        void getIntervieweesReturnsCorrectUserDetails() {
            List<IntervieweeDTO> result = api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead(
                    "/api/interviews/processes/" + interviewProcess.getId() + "/interviewees",
                    null,
                    new TypeReference<List<IntervieweeDTO>>() {},
                    200
                );

            IntervieweeDTO intervieweeDTO = result
                .stream()
                .filter(dto -> dto.applicationId().equals(testApplication.getApplicationId()))
                .findFirst()
                .orElseThrow();

            assertThat(intervieweeDTO.user().firstName()).isEqualTo(testApplicant.getUser().getFirstName());
            assertThat(intervieweeDTO.user().lastName()).isEqualTo(testApplicant.getUser().getLastName());
            assertThat(intervieweeDTO.user().email()).isEqualTo(testApplicant.getUser().getEmail());
            assertThat(intervieweeDTO.user().avatar()).isEqualTo("/images/profiles/applicant-avatar.jpg");
            assertThat(intervieweeDTO.state()).isEqualTo(IntervieweeState.UNCONTACTED);
        }

        @Test
        void getIntervieweesForNonExistentProcessReturnsNotFound() {
            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead("/api/interviews/processes/" + UUID.randomUUID() + "/interviewees", null, Void.class, 404);
        }

        @Test
        void getIntervieweesForOtherProfessorReturnsForbidden() {
            User otherProfessor = UserTestData.savedOtherProfessor(userRepository, researchGroupRepository);

            api
                .with(JwtPostProcessors.jwtUser(otherProfessor.getUserId(), "ROLE_PROFESSOR"))
                .getAndRead("/api/interviews/processes/" + interviewProcess.getId() + "/interviewees", null, Void.class, 403);
        }

        @Test
        void getIntervieweesAsStudentReturnsForbidden() {
            User student = UserTestData.createUserWithoutResearchGroup(userRepository, "student2@tum.de", "Student", "Two", "654321");

            api
                .with(JwtPostProcessors.jwtUser(student.getUserId(), "ROLE_STUDENT"))
                .getAndRead("/api/interviews/processes/" + interviewProcess.getId() + "/interviewees", null, Void.class, 403);
        }
    }

    // ===========================================================================================
    // Tests for creating and getting slots as employee
    // ===========================================================================================

    @Nested
    class SlotsAsEmployee {

        @ParameterizedTest
        @ValueSource(strings = { "ROLE_PROFESSOR", "ROLE_EMPLOYEE" })
        void createAndGetSlotsAsProfessorOrEmployee(String role) {
            UUID userId = role.equals("ROLE_PROFESSOR") ? professor.getUserId() : employee.getUserId();
            CreateSlotsDTO.SlotInput slotInput = new CreateSlotsDTO.SlotInput(
                LocalDate.now().plusDays(2),
                LocalTime.of(14, 0),
                LocalTime.of(15, 0),
                "Room 201",
                null
            );
            CreateSlotsDTO dto = new CreateSlotsDTO(List.of(slotInput));

            // Create slot
            List<InterviewSlotDTO> createdSlots = api
                .with(JwtPostProcessors.jwtUser(userId, role))
                .postAndRead(
                    "/api/interviews/processes/" + interviewProcess.getId() + "/slots/create",
                    dto,
                    new TypeReference<List<InterviewSlotDTO>>() {},
                    201
                );

            assertThat(createdSlots).hasSize(1);
            assertThat(createdSlots.get(0).location()).isEqualTo("Room 201");
            assertThat(createdSlots.get(0).isBooked()).isFalse();

            // Get slots
            LocalDate targetDate = LocalDate.now().plusDays(2);
            String url =
                "/api/interviews/processes/" +
                interviewProcess.getId() +
                "/slots?year=" +
                targetDate.getYear() +
                "&month=" +
                targetDate.getMonthValue();

            PageResponseDTO<InterviewSlotDTO> response = api
                .with(JwtPostProcessors.jwtUser(userId, role))
                .getAndRead(url, null, new TypeReference<PageResponseDTO<InterviewSlotDTO>>() {}, 200);

            assertThat(response.getContent()).isNotEmpty();
            assertThat(response.getContent().iterator().next().location()).isEqualTo("Room 201");
        }
    }
}
