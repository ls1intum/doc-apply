package de.tum.cit.aet.ai.web;

import static org.assertj.core.api.Assertions.assertThat;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.ai.dto.AiFeatureStatusDTO;
import de.tum.cit.aet.core.domain.SystemSetting;
import de.tum.cit.aet.core.repository.SystemSettingRepository;
import de.tum.cit.aet.utility.DatabaseCleaner;
import de.tum.cit.aet.utility.MvcTestClient;
import de.tum.cit.aet.utility.security.JwtPostProcessors;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class AiFeatureToggleResourceTest extends AbstractResourceTest {

    private static final String BASE_URL = "/api/ai/feature-toggle";

    @Autowired
    private MvcTestClient api;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private SystemSettingRepository systemSettingRepository;

    private final UUID adminUserId = UUID.randomUUID();
    private final UUID regularUserId = UUID.randomUUID();

    @BeforeEach
    void setup() {
        databaseCleaner.clean();
    }

    @Nested
    class GetAiStatus {

        @Test
        void shouldReturnStatusWhenAuthenticated() {
            AiFeatureStatusDTO result = api
                .with(JwtPostProcessors.jwtUser(regularUserId, "ROLE_APPLICANT"))
                .getAndRead(BASE_URL + "/status", null, AiFeatureStatusDTO.class, 200);

            assertThat(result).isNotNull();
            assertThat(result.aiEnabled()).isTrue();
            assertThat(result.manuallyDisabled()).isFalse();
            assertThat(result.circuitBreakerOpen()).isFalse();
        }

        @Test
        void shouldReturn401WhenUnauthenticated() {
            api.withoutPostProcessors().getAndRead(BASE_URL + "/status", null, Void.class, 401);
        }
    }

    @Nested
    class ToggleAi {

        @Test
        void shouldDisableAiWhenAdmin() {
            AiFeatureStatusDTO result = api
                .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
                .putAndRead(BASE_URL + "/toggle?enabled=false", null, AiFeatureStatusDTO.class, 200);

            assertThat(result).isNotNull();
            assertThat(result.aiEnabled()).isFalse();
            assertThat(result.manuallyDisabled()).isTrue();
        }

        @Test
        void shouldEnableAiWhenAdmin() {
            // First disable
            api
                .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
                .putAndRead(BASE_URL + "/toggle?enabled=false", null, AiFeatureStatusDTO.class, 200);

            // Then enable
            AiFeatureStatusDTO result = api
                .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
                .putAndRead(BASE_URL + "/toggle?enabled=true", null, AiFeatureStatusDTO.class, 200);

            assertThat(result).isNotNull();
            assertThat(result.aiEnabled()).isTrue();
            assertThat(result.manuallyDisabled()).isFalse();
        }

        @Test
        void shouldPersistToggleStateToDatabase() {
            api
                .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
                .putAndRead(BASE_URL + "/toggle?enabled=false", null, AiFeatureStatusDTO.class, 200);

            Optional<SystemSetting> setting = systemSettingRepository.findById("ai.enabled");
            assertThat(setting).isPresent();
            assertThat(setting.get().getValue()).isEqualTo("false");
        }

        @Test
        void shouldReturn403WhenNonAdmin() {
            api
                .with(JwtPostProcessors.jwtUser(regularUserId, "ROLE_APPLICANT"))
                .putAndRead(BASE_URL + "/toggle?enabled=false", null, Void.class, 403);
        }

        @Test
        void shouldReturn401WhenUnauthenticated() {
            api.withoutPostProcessors().putAndRead(BASE_URL + "/toggle?enabled=false", null, Void.class, 401);
        }
    }

    @Nested
    class ResetCircuitBreaker {

        @Test
        void shouldResetCircuitBreakerWhenAdmin() {
            AiFeatureStatusDTO result = api
                .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
                .postAndRead(BASE_URL + "/reset-circuit-breaker", null, AiFeatureStatusDTO.class, 200);

            assertThat(result).isNotNull();
            assertThat(result.circuitBreakerOpen()).isFalse();
        }

        @Test
        void shouldReturn403WhenNonAdmin() {
            api
                .with(JwtPostProcessors.jwtUser(regularUserId, "ROLE_APPLICANT"))
                .postAndRead(BASE_URL + "/reset-circuit-breaker", null, Void.class, 403);
        }

        @Test
        void shouldReturn401WhenUnauthenticated() {
            api.withoutPostProcessors().postAndRead(BASE_URL + "/reset-circuit-breaker", null, Void.class, 401);
        }
    }

    @Nested
    class StatusReflectsToggle {

        @Test
        void shouldReflectDisabledStateInStatus() {
            api
                .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
                .putAndRead(BASE_URL + "/toggle?enabled=false", null, AiFeatureStatusDTO.class, 200);

            AiFeatureStatusDTO status = api
                .with(JwtPostProcessors.jwtUser(regularUserId, "ROLE_APPLICANT"))
                .getAndRead(BASE_URL + "/status", null, AiFeatureStatusDTO.class, 200);

            assertThat(status.aiEnabled()).isFalse();
            assertThat(status.manuallyDisabled()).isTrue();
        }
    }
}
