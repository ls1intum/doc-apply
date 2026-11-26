package de.tum.cit.aet.notification.web.rest;

import static org.assertj.core.api.Assertions.assertThat;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.notification.constants.EmailType;
import de.tum.cit.aet.notification.domain.EmailSetting;
import de.tum.cit.aet.notification.dto.EmailSettingDTO;
import de.tum.cit.aet.notification.repository.EmailSettingRepository;
import de.tum.cit.aet.usermanagement.constants.UserRole;
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
import de.tum.cit.aet.utility.testdata.ResearchGroupTestData;
import de.tum.cit.aet.utility.testdata.UserTestData;
import java.util.Arrays;
import java.util.Collections;
import java.util.Set;
import java.util.stream.Collectors;
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
class EmailSettingResourceTest extends AbstractResourceTest {

    private static final String BASE_URL = "/api/settings/emails";

    @Autowired
    DatabaseCleaner databaseCleaner;

    @Autowired
    UserRepository userRepository;

    @Autowired
    ResearchGroupRepository researchGroupRepository;

    @Autowired
    ApplicantRepository applicantRepository;

    @Autowired
    EmailSettingRepository emailSettingRepository;

    @Autowired
    MvcTestClient api;

    User professor;
    ResearchGroup group;
    Applicant applicant;

    @BeforeEach
    void setup() {
        databaseCleaner.clean();
        group = ResearchGroupTestData.saved(researchGroupRepository);
        professor = UserTestData.savedProfessor(userRepository, group);
        applicant = ApplicantTestData.savedWithNewUser(applicantRepository, userRepository);
    }

    private MvcTestClient asProfessor(User user) {
        return api.with(JwtPostProcessors.jwtUser(user.getUserId(), "ROLE_PROFESSOR"));
    }

    private MvcTestClient asApplicant(Applicant applicant) {
        return api.with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"));
    }

    private Set<EmailType> getAvailableEmailTypesForUserRole(UserRole userRole) {
        return Arrays.stream(EmailType.values())
            .filter(emailType -> !Collections.disjoint(Set.of(userRole), emailType.getRoles()))
            .collect(Collectors.toSet());
    }

    @Nested
    class GetSettings {

        @Test
        void getEmailSettingsCreatesDefaultsIfMissingForProfessor() {
            assertThat(emailSettingRepository.findAllByUser(professor)).isEmpty();

            Set<EmailSettingDTO> result = asProfessor(professor).getAndRead(BASE_URL, null, new TypeReference<>() {}, 200);

            assertThat(result).hasSize(getAvailableEmailTypesForUserRole(UserRole.PROFESSOR).size());
            assertThat(result).allMatch(EmailSettingDTO::enabled); // all are true as default
        }

        @Test
        void getEmailSettingsCreatesDefaultsIfMissingForApplicant() {
            assertThat(emailSettingRepository.findAllByUser(applicant.getUser())).isEmpty();

            Set<EmailSettingDTO> result = asApplicant(applicant).getAndRead(BASE_URL, null, new TypeReference<>() {}, 200);

            assertThat(result).hasSize(getAvailableEmailTypesForUserRole(UserRole.APPLICANT).size());
            assertThat(result).allMatch(EmailSettingDTO::enabled); // all are true as default
        }

        @Test
        void shouldNotOfferProfessorApplicationNotificationsWhenUserIsEmployee() {
            User employee = UserTestData.savedEmployee(userRepository, group);

            Set<EmailSettingDTO> result = api
                .with(JwtPostProcessors.jwtUser(employee.getUserId(), "ROLE_EMPLOYEE"))
                .getAndRead(BASE_URL, null, new TypeReference<>() {}, 200);

            assertThat(result)
                .extracting(EmailSettingDTO::emailType)
                .doesNotContain(
                    EmailType.APPLICATION_RECEIVED,
                    EmailType.APPLICATION_ACCEPTED,
                    EmailType.INTERVIEW_BOOKED_PROFESSOR,
                    EmailType.INTERVIEW_ASSIGNED_PROFESSOR
                );
        }

        @Test
        void getEmailSettingsIsIdempotent() {
            Set<EmailSettingDTO> firstCall = asProfessor(professor).getAndRead(BASE_URL, null, new TypeReference<>() {}, 200);

            Set<EmailSettingDTO> secondCall = asProfessor(professor).getAndRead(BASE_URL, null, new TypeReference<>() {}, 200);

            assertThat(firstCall).hasSize(getAvailableEmailTypesForUserRole(UserRole.PROFESSOR).size());
            assertThat(secondCall).hasSize(getAvailableEmailTypesForUserRole(UserRole.PROFESSOR).size());

            Set<EmailSetting> persisted = emailSettingRepository.findAllByUser(professor);
            assertThat(persisted).hasSize(getAvailableEmailTypesForUserRole(UserRole.PROFESSOR).size());
        }
    }

    @Nested
    class UpdateSettings {

        @Test
        void updateEmailSettingsUpdatesExistingSettings() {
            asProfessor(professor).getAndRead(BASE_URL, null, new TypeReference<Set<EmailSettingDTO>>() {}, 200);

            EmailSetting setting = emailSettingRepository.findAllByUser(professor).iterator().next();
            EmailSettingDTO update = new EmailSettingDTO(setting.getEmailType(), false);

            Set<EmailSettingDTO> updated = asProfessor(professor).putAndRead(BASE_URL, Set.of(update), new TypeReference<>() {}, 200);

            assertThat(updated).anyMatch(dto -> dto.emailType().equals(setting.getEmailType()) && !dto.enabled());
            assertThat(
                updated
                    .stream()
                    .filter(dto -> !dto.emailType().equals(setting.getEmailType()))
                    .noneMatch(EmailSettingDTO::enabled)
            );

            EmailSetting reloaded = emailSettingRepository.findByUserAndEmailType(professor, setting.getEmailType()).orElseThrow();
            assertThat(reloaded.isEnabled()).isFalse();

            Set<EmailSetting> otherSettings = emailSettingRepository.findAllByUser(professor);
            assertThat(
                otherSettings
                    .stream()
                    .filter(otherSetting -> !otherSetting.getEmailType().equals(setting.getEmailType()))
                    .noneMatch(EmailSetting::isEnabled)
            );
        }

        @Test
        void updateEmailSettingsWithInvalidTypeThrowsIllegalState() {
            asProfessor(professor).getAndRead(BASE_URL, null, new TypeReference<Set<EmailSettingDTO>>() {}, 200);

            EmailType invalid = EmailType.APPLICATION_WITHDRAWN;

            EmailSettingDTO update = new EmailSettingDTO(invalid, false);

            api
                .with(JwtPostProcessors.jwtUser(professor.getUserId(), "ROLE_PROFESSOR"))
                .putAndRead(BASE_URL, Set.of(update), Void.class, 400);
        }

        @Test
        void updateEmailSettingsCanReEnableDisabledSetting() {
            Set<EmailSettingDTO> defaults = asProfessor(professor).getAndRead(BASE_URL, null, new TypeReference<>() {}, 200);

            EmailSettingDTO oneSetting = defaults.iterator().next();

            EmailSettingDTO disabled = new EmailSettingDTO(oneSetting.emailType(), false);
            Set<EmailSettingDTO> afterDisable = asProfessor(professor).putAndRead(
                BASE_URL,
                Set.of(disabled),
                new TypeReference<>() {},
                200
            );
            assertThat(afterDisable).anyMatch(dto -> dto.emailType().equals(oneSetting.emailType()) && !dto.enabled());

            EmailSettingDTO reEnabled = new EmailSettingDTO(oneSetting.emailType(), true);
            Set<EmailSettingDTO> afterReEnable = asProfessor(professor).putAndRead(
                BASE_URL,
                Set.of(reEnabled),
                new TypeReference<>() {},
                200
            );
            assertThat(afterReEnable).anyMatch(dto -> dto.emailType().equals(oneSetting.emailType()) && dto.enabled());

            EmailSetting persisted = emailSettingRepository.findByUserAndEmailType(professor, oneSetting.emailType()).orElseThrow();
            assertThat(persisted.isEnabled()).isTrue();
        }
    }

    @Nested
    class Authorization {

        @Test
        void unauthenticatedReturns401() {
            api.withoutPostProcessors().getAndRead(BASE_URL, null, Void.class, 401);
            api.withoutPostProcessors().putAndRead(BASE_URL, Set.of(), Void.class, 401);
        }
    }
}
