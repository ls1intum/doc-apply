package de.tum.cit.aet.core.web;

import static org.assertj.core.api.Assertions.assertThat;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.core.domain.SystemSetting;
import de.tum.cit.aet.core.dto.PublicConfigDTO;
import de.tum.cit.aet.core.dto.SiteNameDTO;
import de.tum.cit.aet.core.repository.SystemSettingRepository;
import de.tum.cit.aet.core.service.SiteSettingService;
import de.tum.cit.aet.utility.DatabaseCleaner;
import de.tum.cit.aet.utility.MvcTestClient;
import de.tum.cit.aet.utility.security.JwtPostProcessors;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;

class SiteSettingResourceTest extends AbstractResourceTest {

    private static final String BASE_URL = "/api/site-settings";

    @Autowired
    private MvcTestClient api;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private SystemSettingRepository systemSettingRepository;

    @Autowired
    private SiteSettingService siteSettingService;

    private final UUID adminUserId = UUID.randomUUID();
    private final UUID regularUserId = UUID.randomUUID();

    @BeforeEach
    void setup() {
        databaseCleaner.clean();
        // The site name is cached in memory; reset it so tests don't leak state into each other
        siteSettingService.updateSiteName(SiteSettingService.DEFAULT_SITE_NAME);
    }

    static Stream<Arguments> invalidSiteNames() {
        return Stream.of(
            Arguments.of("a blank name", "   "),
            Arguments.of("a name over the length limit", "X".repeat(SiteNameDTO.MAX_SITE_NAME_LENGTH + 1))
        );
    }

    @Nested
    class UpdateSiteName {

        @Test
        void shouldReturnPersistAndPubliclyExposeTheNewSiteName() {
            SiteNameDTO result = api
                .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
                .putAndRead(BASE_URL + "/site-name", new SiteNameDTO("Doctoral Portal"), SiteNameDTO.class, 200);
            assertThat(result.siteName()).as("response body").isEqualTo("Doctoral Portal");

            assertThat(systemSettingRepository.findById("site.name"))
                .as("persisted setting")
                .get()
                .extracting(SystemSetting::getValue)
                .isEqualTo("Doctoral Portal");

            PublicConfigDTO config = api.withoutPostProcessors().getAndRead("/api/public/config", null, PublicConfigDTO.class, 200);
            assertThat(config.siteName()).as("public config").isEqualTo("Doctoral Portal");
        }

        @Test
        void shouldTrimSiteNameBeforeSaving() {
            SiteNameDTO result = api
                .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
                .putAndRead(BASE_URL + "/site-name", new SiteNameDTO("  Doctoral Portal  "), SiteNameDTO.class, 200);

            assertThat(result.siteName()).isEqualTo("Doctoral Portal");
        }

        @ParameterizedTest(name = "should reject {0} with 400")
        @MethodSource("de.tum.cit.aet.core.web.SiteSettingResourceTest#invalidSiteNames")
        void shouldRejectInvalidSiteNames(String description, String siteName) {
            api
                .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
                .putAndRead(BASE_URL + "/site-name", new SiteNameDTO(siteName), Void.class, 400);
        }

        @Test
        void shouldReturn403WhenNonAdmin() {
            api
                .with(JwtPostProcessors.jwtUser(regularUserId, "ROLE_APPLICANT"))
                .putAndRead(BASE_URL + "/site-name", new SiteNameDTO("Doctoral Portal"), Void.class, 403);
        }

        @Test
        void shouldReturn401WhenUnauthenticated() {
            api.withoutPostProcessors().putAndRead(BASE_URL + "/site-name", new SiteNameDTO("Doctoral Portal"), Void.class, 401);
        }
    }

    @Nested
    class PublicConfig {

        @Test
        void shouldExposeDefaultSiteNameWithoutAuthentication() {
            PublicConfigDTO config = api.withoutPostProcessors().getAndRead("/api/public/config", null, PublicConfigDTO.class, 200);

            assertThat(config.siteName()).isEqualTo(SiteSettingService.DEFAULT_SITE_NAME);
        }
    }
}
