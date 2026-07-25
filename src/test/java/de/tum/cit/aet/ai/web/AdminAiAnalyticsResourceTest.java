package de.tum.cit.aet.ai.web;

import static org.assertj.core.api.Assertions.assertThat;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.ai.constants.AiUsageFeature;
import de.tum.cit.aet.ai.domain.AiUsageEvent;
import de.tum.cit.aet.ai.dto.AiUsageAnalyticsDTO;
import de.tum.cit.aet.ai.repository.AiUsageEventRepository;
import de.tum.cit.aet.utility.DatabaseCleaner;
import de.tum.cit.aet.utility.MvcTestClient;
import de.tum.cit.aet.utility.security.JwtPostProcessors;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class AdminAiAnalyticsResourceTest extends AbstractResourceTest {

    private static final String BASE_URL = "/api/admin/analytics/ai-usage";

    @Autowired
    private MvcTestClient api;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private AiUsageEventRepository aiUsageEventRepository;

    private final UUID adminUserId = UUID.randomUUID();
    private final UUID regularUserId = UUID.randomUUID();

    @BeforeEach
    void setup() {
        databaseCleaner.clean();
    }

    @Test
    void shouldReturnCountsForEveryTriggerAcrossBothFeaturesWhenAdmin() {
        // Two successful and one failed generation, plus one extraction: every trigger is counted.
        saveEvent(AiUsageFeature.JOB_DESCRIPTION_GENERATION, true);
        saveEvent(AiUsageFeature.JOB_DESCRIPTION_GENERATION, true);
        saveEvent(AiUsageFeature.JOB_DESCRIPTION_GENERATION, false);
        saveEvent(AiUsageFeature.DOCUMENT_EXTRACTION, true);

        AiUsageAnalyticsDTO result = api
            .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
            .getAndRead(BASE_URL, Map.of("range", "LAST_WEEK"), AiUsageAnalyticsDTO.class, 200);

        assertThat(result).isNotNull();
        assertThat(result.labels()).isNotEmpty();
        assertThat(result.series()).hasSize(3);
        assertThat(sumCounts(result, AiUsageFeature.JOB_DESCRIPTION_GENERATION)).isEqualTo(3);
        assertThat(sumCounts(result, AiUsageFeature.DOCUMENT_EXTRACTION)).isEqualTo(1);
        assertThat(sumFailures(result, AiUsageFeature.JOB_DESCRIPTION_GENERATION)).isEqualTo(1);
        assertThat(sumFailures(result, AiUsageFeature.DOCUMENT_EXTRACTION)).isZero();
    }

    @Test
    void shouldReturnEmptySeriesWhenNoEventsRecorded() {
        AiUsageAnalyticsDTO result = api
            .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
            .getAndRead(BASE_URL, Map.of("range", "ALL_TIME"), AiUsageAnalyticsDTO.class, 200);

        assertThat(result.series()).hasSize(3);
        assertThat(sumCounts(result, AiUsageFeature.JOB_DESCRIPTION_GENERATION)).isZero();
        assertThat(sumCounts(result, AiUsageFeature.DOCUMENT_EXTRACTION)).isZero();
    }

    @Test
    void shouldSumTokensAndEstimateCostWhenAdmin() {
        saveEvent(AiUsageFeature.JOB_DESCRIPTION_GENERATION, true, 100, 200);
        saveEvent(AiUsageFeature.TRANSLATION, true, 50, 30);

        AiUsageAnalyticsDTO result = api
            .with(JwtPostProcessors.jwtUser(adminUserId, "ROLE_ADMIN"))
            .getAndRead(BASE_URL, Map.of("range", "LAST_WEEK"), AiUsageAnalyticsDTO.class, 200);

        assertThat(result.cost()).isNotNull();
        assertThat(result.cost().inputTokens()).isEqualTo(150);
        assertThat(result.cost().outputTokens()).isEqualTo(230);
        assertThat(result.cost().totalTokens()).isEqualTo(380);
        assertThat(result.cost().currency()).isEqualTo("EUR");
        assertThat(result.cost().estimatedCost()).isGreaterThan(0);
    }

    @Test
    void shouldReturn403WhenNonAdmin() {
        api.with(JwtPostProcessors.jwtUser(regularUserId, "ROLE_APPLICANT")).getAndRead(BASE_URL, null, Void.class, 403);
    }

    @Test
    void shouldReturn401WhenUnauthenticated() {
        api.withoutPostProcessors().getAndRead(BASE_URL, null, Void.class, 401);
    }

    private void saveEvent(AiUsageFeature feature, boolean success) {
        saveEvent(feature, success, null, null);
    }

    private void saveEvent(AiUsageFeature feature, boolean success, Integer inputTokens, Integer outputTokens) {
        AiUsageEvent event = new AiUsageEvent();
        event.setFeature(feature);
        event.setSuccess(success);
        event.setInputTokens(inputTokens);
        event.setOutputTokens(outputTokens);
        aiUsageEventRepository.save(event);
    }

    private long sumCounts(AiUsageAnalyticsDTO dto, AiUsageFeature feature) {
        return dto
            .series()
            .stream()
            .filter(series -> series.feature() == feature)
            .flatMap(series -> series.counts().stream())
            .mapToLong(Long::longValue)
            .sum();
    }

    private long sumFailures(AiUsageAnalyticsDTO dto, AiUsageFeature feature) {
        return dto
            .series()
            .stream()
            .filter(series -> series.feature() == feature)
            .flatMap(series -> series.failureCounts().stream())
            .mapToLong(Long::longValue)
            .sum();
    }
}
