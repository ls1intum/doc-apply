package de.tum.cit.aet.ai.web;

import de.tum.cit.aet.ai.constants.AiUsageTimeRange;
import de.tum.cit.aet.ai.dto.AiUsageAnalyticsDTO;
import de.tum.cit.aet.ai.service.AiUsageAnalyticsService;
import de.tum.cit.aet.core.security.annotations.Admin;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller exposing AI feature usage analytics to administrators.
 */
@Slf4j
@Admin
@RestController
@RequestMapping("/api/admin/analytics")
public class AdminAiAnalyticsResource {

    private final AiUsageAnalyticsService aiUsageAnalyticsService;

    public AdminAiAnalyticsResource(AiUsageAnalyticsService aiUsageAnalyticsService) {
        this.aiUsageAnalyticsService = aiUsageAnalyticsService;
    }

    /**
     * Returns AI feature trigger counts bucketed over time for the given range.
     *
     * @param range the time window to report on; defaults to the last month
     * @return the usage analytics payload with one series per AI feature
     */
    @GetMapping("/ai-usage")
    public ResponseEntity<AiUsageAnalyticsDTO> getAiUsage(
        @RequestParam(value = "range", defaultValue = "LAST_MONTH") AiUsageTimeRange range
    ) {
        log.info("GET /api/admin/analytics/ai-usage - range={}", range);
        return ResponseEntity.ok(aiUsageAnalyticsService.getUsage(range));
    }
}
