package de.tum.cit.aet.ai.service;

import de.tum.cit.aet.ai.config.AiPricingProperties;
import de.tum.cit.aet.ai.constants.AiUsageFeature;
import de.tum.cit.aet.ai.constants.AiUsageGranularity;
import de.tum.cit.aet.ai.constants.AiUsageTimeRange;
import de.tum.cit.aet.ai.dto.AiUsageAnalyticsDTO;
import de.tum.cit.aet.ai.dto.AiUsageCostSummaryDTO;
import de.tum.cit.aet.ai.dto.AiUsageEventPoint;
import de.tum.cit.aet.ai.dto.AiUsageSeriesDTO;
import de.tum.cit.aet.ai.repository.AiUsageEventRepository;
import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Aggregates recorded {@link de.tum.cit.aet.ai.domain.AiUsageEvent}s into time-bucketed trigger
 * counts for the admin analytics dashboard.
 *
 * <p>Bucketing is done in Java (rather than via database-specific date truncation) to stay
 * portable; AI trigger volume is low enough that fetching the events in the window is cheap.</p>
 */
@Service
public class AiUsageAnalyticsService {

    private static final DateTimeFormatter HOUR_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:00");
    private static final DateTimeFormatter DAY_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter MONTH_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM");

    private final AiUsageEventRepository aiUsageEventRepository;
    private final AiPricingProperties aiPricingProperties;

    public AiUsageAnalyticsService(AiUsageEventRepository aiUsageEventRepository, AiPricingProperties aiPricingProperties) {
        this.aiUsageEventRepository = aiUsageEventRepository;
        this.aiPricingProperties = aiPricingProperties;
    }

    /**
     * Builds the usage analytics payload for the given time range.
     *
     * @param range the time window to report on
     * @return one trigger-count series per AI feature over a shared time-bucket axis
     */
    @Transactional(readOnly = true)
    public AiUsageAnalyticsDTO getUsage(AiUsageTimeRange range) {
        LocalDateTime now = LocalDateTime.now();
        AiUsageGranularity granularity = granularityFor(range);
        LocalDateTime from = resolveWindowStart(range, now, granularity);

        // 1) Build the ordered list of bucket start instants covering [from, now] and index them.
        List<LocalDateTime> bucketStarts = buildBuckets(from, now, granularity);
        Map<LocalDateTime, Integer> indexByBucket = new HashMap<>();
        for (int i = 0; i < bucketStarts.size(); i++) {
            indexByBucket.put(bucketStarts.get(i), i);
        }

        // 2) Initialize a zeroed trigger and failure array per feature.
        Map<AiUsageFeature, long[]> countsByFeature = new EnumMap<>(AiUsageFeature.class);
        Map<AiUsageFeature, long[]> failuresByFeature = new EnumMap<>(AiUsageFeature.class);
        for (AiUsageFeature feature : AiUsageFeature.values()) {
            countsByFeature.put(feature, new long[bucketStarts.size()]);
            failuresByFeature.put(feature, new long[bucketStarts.size()]);
        }

        // 3) Drop each event into its bucket, tracking failures, token totals and estimated cost.
        long totalInputTokens = 0;
        long totalOutputTokens = 0;
        double totalCost = 0;
        for (AiUsageEventPoint point : aiUsageEventRepository.findPointsSince(from)) {
            Integer index = indexByBucket.get(truncate(point.createdAt(), granularity));
            if (index != null) {
                countsByFeature.get(point.feature())[index]++;
                if (!point.success()) {
                    failuresByFeature.get(point.feature())[index]++;
                }
                if (point.inputTokens() != null) {
                    totalInputTokens += point.inputTokens();
                }
                if (point.outputTokens() != null) {
                    totalOutputTokens += point.outputTokens();
                }
                totalCost += aiPricingProperties.estimateCost(point.inputTokens(), point.outputTokens());
            }
        }

        // 4) Assemble labels and per-feature series in a stable feature order.
        List<String> labels = bucketStarts
            .stream()
            .map(bucket -> formatLabel(bucket, granularity))
            .toList();
        List<AiUsageSeriesDTO> series = new ArrayList<>();
        for (AiUsageFeature feature : AiUsageFeature.values()) {
            series.add(
                new AiUsageSeriesDTO(feature, toBoxedList(countsByFeature.get(feature)), toBoxedList(failuresByFeature.get(feature)))
            );
        }

        AiUsageCostSummaryDTO cost = new AiUsageCostSummaryDTO(
            totalInputTokens,
            totalOutputTokens,
            totalInputTokens + totalOutputTokens,
            totalCost,
            aiPricingProperties.getCurrency()
        );

        return new AiUsageAnalyticsDTO(range, granularity, labels, series, cost);
    }

    private AiUsageGranularity granularityFor(AiUsageTimeRange range) {
        return switch (range) {
            case LAST_DAY -> AiUsageGranularity.HOUR;
            case LAST_WEEK, LAST_MONTH -> AiUsageGranularity.DAY;
            case LAST_THREE_MONTHS -> AiUsageGranularity.WEEK;
            case ALL_TIME -> AiUsageGranularity.MONTH;
        };
    }

    private LocalDateTime resolveWindowStart(AiUsageTimeRange range, LocalDateTime now, AiUsageGranularity granularity) {
        LocalDateTime rawStart = switch (range) {
            case LAST_DAY -> now.minusDays(1);
            case LAST_WEEK -> now.minusWeeks(1);
            case LAST_MONTH -> now.minusMonths(1);
            case LAST_THREE_MONTHS -> now.minusMonths(3);
            // "All time" starts at the earliest recorded event, or the current bucket if none exist yet.
            case ALL_TIME -> aiUsageEventRepository.findEarliestCreatedAt().orElse(now);
        };
        return truncate(rawStart, granularity);
    }

    private List<LocalDateTime> buildBuckets(LocalDateTime from, LocalDateTime now, AiUsageGranularity granularity) {
        List<LocalDateTime> buckets = new ArrayList<>();
        LocalDateTime end = truncate(now, granularity);
        for (LocalDateTime cursor = from; !cursor.isAfter(end); cursor = step(cursor, granularity)) {
            buckets.add(cursor);
        }
        return buckets;
    }

    private LocalDateTime truncate(LocalDateTime dateTime, AiUsageGranularity granularity) {
        return switch (granularity) {
            case HOUR -> dateTime.truncatedTo(ChronoUnit.HOURS);
            case DAY -> dateTime.truncatedTo(ChronoUnit.DAYS);
            case WEEK -> dateTime.truncatedTo(ChronoUnit.DAYS).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case MONTH -> dateTime.truncatedTo(ChronoUnit.DAYS).withDayOfMonth(1);
        };
    }

    private LocalDateTime step(LocalDateTime dateTime, AiUsageGranularity granularity) {
        return switch (granularity) {
            case HOUR -> dateTime.plusHours(1);
            case DAY -> dateTime.plusDays(1);
            case WEEK -> dateTime.plusWeeks(1);
            case MONTH -> dateTime.plusMonths(1);
        };
    }

    private List<Long> toBoxedList(long[] values) {
        List<Long> boxed = new ArrayList<>(values.length);
        for (long value : values) {
            boxed.add(value);
        }
        return boxed;
    }

    private String formatLabel(LocalDateTime bucketStart, AiUsageGranularity granularity) {
        return switch (granularity) {
            case HOUR -> bucketStart.format(HOUR_FORMAT);
            case DAY, WEEK -> bucketStart.format(DAY_FORMAT);
            case MONTH -> bucketStart.format(MONTH_FORMAT);
        };
    }
}
