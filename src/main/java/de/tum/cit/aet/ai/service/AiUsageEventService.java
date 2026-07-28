package de.tum.cit.aet.ai.service;

import de.tum.cit.aet.ai.constants.AiUsageFeature;
import de.tum.cit.aet.ai.domain.AiUsageEvent;
import de.tum.cit.aet.ai.repository.AiUsageEventRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Persists AI feature usage events for the admin analytics dashboard.
 */
@Service
public class AiUsageEventService {

    private final AiUsageEventRepository aiUsageEventRepository;
    private final UserRepository userRepository;

    public AiUsageEventService(AiUsageEventRepository aiUsageEventRepository, UserRepository userRepository) {
        this.aiUsageEventRepository = aiUsageEventRepository;
        this.userRepository = userRepository;
    }

    /**
     * Persists a single AI usage event for the analytics dashboard.
     *
     * @param feature      the AI feature that was triggered
     * @param success      whether the underlying AI call completed successfully
     * @param userId       the triggering user, or {@code null} if it could not be resolved
     * @param inputTokens  prompt tokens consumed, or {@code null} if the provider did not report usage
     * @param outputTokens completion tokens produced, or {@code null} if the provider did not report usage
     */
    public void record(AiUsageFeature feature, boolean success, UUID userId, Integer inputTokens, Integer outputTokens) {
        AiUsageEvent event = new AiUsageEvent();
        event.setFeature(feature);
        event.setSuccess(success);
        event.setInputTokens(inputTokens);
        event.setOutputTokens(outputTokens);
        if (userId != null) {
            event.setUser(userRepository.getReferenceById(userId));
        }
        aiUsageEventRepository.save(event);
    }
}
