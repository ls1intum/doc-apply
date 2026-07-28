package de.tum.cit.aet.ai.service;

import de.tum.cit.aet.ai.dto.AiFeatureStatusDTO;
import de.tum.cit.aet.core.domain.SystemSetting;
import de.tum.cit.aet.core.repository.SystemSettingRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

/**
 * Manages the system-wide AI feature toggle (Fehlerstrategie).
 *
 * Provides two independent mechanisms for disabling AI:
 *
 * Manual toggle — an admin can explicitly enable/disable AI features. The state is persisted
 * in the {@code system_settings} table so it survives restarts.
 *
 * Circuit breaker — after {@value #FAILURE_THRESHOLD} consecutive LLM failures the circuit
 * transitions to {@link CircuitState#OPEN}. After {@value #COOLDOWN_SECONDS} seconds it
 * transitions to {@link CircuitState#HALF_OPEN}, letting exactly one probe request through.
 * A successful probe closes the circuit; a failed probe re-opens it and restarts the cooldown.
 *
 * AI is available only when both conditions are met: manually enabled AND circuit closed.
 */
@Service
public class AiFeatureToggleService {

    private static final String SETTING_KEY = "ai.enabled";
    private static final int FAILURE_THRESHOLD = 5;
    private static final long COOLDOWN_SECONDS = 7200;

    private enum CircuitState {
        CLOSED,
        OPEN,
        HALF_OPEN,
    }

    private final SystemSettingRepository systemSettingRepository;

    private volatile boolean manuallyEnabled = true;

    private final Object circuitLock = new Object();
    private CircuitState circuitState = CircuitState.CLOSED;
    private int consecutiveFailures = 0;
    private long openedAt = 0;

    public AiFeatureToggleService(SystemSettingRepository systemSettingRepository) {
        this.systemSettingRepository = systemSettingRepository;
    }

    @PostConstruct
    void init() {
        try {
            systemSettingRepository.findById(SETTING_KEY).ifPresent(setting -> manuallyEnabled = Boolean.parseBoolean(setting.getValue()));
        } catch (Exception e) {
            // Table may not exist during API docs generation (no-liquibase profile); default to enabled
        }
    }

    /**
     * Returns {@code true} when AI features are available system-wide.
     * This requires both the manual toggle to be ON and the circuit breaker to permit the request.
     *
     * If the circuit breaker is {@link CircuitState#OPEN} and the cooldown has elapsed, the
     * first caller transitions it to {@link CircuitState#HALF_OPEN} and is allowed through as
     * the probe; concurrent callers see the breaker as closed for that single probe only.
     *
     * @return {@code true} if AI features are currently available
     */
    public boolean isAiAvailable() {
        return manuallyEnabled && !isCircuitBreakerOpen();
    }

    /**
     * Returns {@code true} when the circuit breaker is currently rejecting requests.
     * After the cooldown elapses, the first call transitions {@link CircuitState#OPEN} to
     * {@link CircuitState#HALF_OPEN} and returns {@code false} so that caller can probe.
     * Subsequent callers see {@code true} until the probe resolves via {@link #recordSuccess()}
     * or {@link #recordFailure()}.
     *
     * @return {@code true} if the circuit breaker is currently open
     */
    public boolean isCircuitBreakerOpen() {
        synchronized (circuitLock) {
            if (circuitState == CircuitState.CLOSED) {
                return false;
            }
            if (circuitState == CircuitState.OPEN && System.currentTimeMillis() - openedAt > COOLDOWN_SECONDS * 1000) {
                circuitState = CircuitState.HALF_OPEN;
                return false;
            }
            return true;
        }
    }

    /**
     * Manually enable or disable AI features system-wide. Persisted to the database.
     *
     * @param enabled whether AI features should be enabled
     */
    public void setEnabled(boolean enabled) {
        manuallyEnabled = enabled;
        systemSettingRepository.save(new SystemSetting(SETTING_KEY, String.valueOf(enabled)));
    }

    /**
     * Record a successful LLM call. Closes the circuit breaker and resets failure count.
     */
    public void recordSuccess() {
        resetCircuitBreaker();
    }

    /**
     * Record a failed LLM call. Opens the circuit breaker after {@value #FAILURE_THRESHOLD}
     * consecutive failures, or immediately if a half-open probe fails.
     */
    public void recordFailure() {
        synchronized (circuitLock) {
            if (
                circuitState == CircuitState.HALF_OPEN ||
                (circuitState == CircuitState.CLOSED && ++consecutiveFailures >= FAILURE_THRESHOLD)
            ) {
                circuitState = CircuitState.OPEN;
                openedAt = System.currentTimeMillis();
            }
        }
    }

    /**
     * Resets the circuit breaker to closed state. Used both after a successful LLM probe
     * and as a manual admin action.
     */
    public void resetCircuitBreaker() {
        synchronized (circuitLock) {
            consecutiveFailures = 0;
            circuitState = CircuitState.CLOSED;
            openedAt = 0;
        }
    }

    /**
     * Returns a snapshot of the current AI feature status.
     *
     * The cooldown is honored read-only here: once it has elapsed the breaker is reported
     * as closed without mutating state, so the next actual AI call performs the OPEN → HALF_OPEN
     * transition and serves as the probe. Reading state directly would let the breaker stay
     * reported as open indefinitely, since the client blocks AI requests based on this status
     * and would never trigger the transition.
     *
     * {@link CircuitState#HALF_OPEN} is also reported as closed: a probe is in flight, so
     * from the user's perspective AI is "trying" rather than rejecting requests. Reporting it
     * as open would cause the UI to flicker to "open" for the duration of every recovery probe.
     *
     * @return the current AI feature status including manual toggle and circuit breaker state
     */
    public AiFeatureStatusDTO getStatus() {
        boolean breakerOpen;
        long openedAtSnapshot;
        synchronized (circuitLock) {
            openedAtSnapshot = openedAt;
            boolean cooldownElapsed = circuitState == CircuitState.OPEN && System.currentTimeMillis() - openedAt > COOLDOWN_SECONDS * 1000;
            breakerOpen = circuitState == CircuitState.OPEN && !cooldownElapsed;
        }
        return new AiFeatureStatusDTO(manuallyEnabled && !breakerOpen, !manuallyEnabled, breakerOpen, COOLDOWN_SECONDS, openedAtSnapshot);
    }
}
