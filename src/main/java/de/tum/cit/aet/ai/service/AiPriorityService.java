package de.tum.cit.aet.ai.service;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

/** Coordinates foreground generation and cancellable background AI work per job. */
@Service
public class AiPriorityService {

    private final Map<UUID, Set<Sinks.Empty<Void>>> backgroundCancellations = new ConcurrentHashMap<>();

    /**
     * Cancels existing background work for the job before generation starts.
     *
     * @param jobId the job owning the AI workflow
     * @param source the generation stream
     * @return the generation stream
     * @param <T> the streamed response type
     */
    public <T> Flux<T> foreground(UUID jobId, Flux<T> source) {
        if (jobId == null) {
            return source;
        }
        return Flux.defer(() -> {
            cancelBackground(jobId);
            return source;
        });
    }

    /**
     * Registers background work so foreground generation for the same job can cancel it.
     *
     * @param jobId the job owning the AI workflow
     * @param source the background stream
     * @return the cancellable background stream
     * @param <T> the streamed response type
     */
    public <T> Flux<T> background(UUID jobId, Flux<T> source) {
        if (jobId == null) {
            return source;
        }
        return Flux.defer(() -> {
            Sinks.Empty<Void> cancellation = Sinks.empty();
            backgroundCancellations.compute(jobId, (_, existing) -> {
                Set<Sinks.Empty<Void>> set = existing != null ? existing : ConcurrentHashMap.newKeySet();
                set.add(cancellation);
                return set;
            });
            Mono<T> cancellationError = cancellation
                .asMono()
                .then(Mono.error(new CancellationException("AI request superseded by generation")));
            return source.takeUntilOther(cancellationError).doFinally(_ -> unregister(jobId, cancellation));
        });
    }

    private void cancelBackground(UUID jobId) {
        Set<Sinks.Empty<Void>> cancellations = backgroundCancellations.remove(jobId);
        if (cancellations != null) {
            cancellations.forEach(Sinks.Empty::tryEmitEmpty);
        }
    }

    private void unregister(UUID jobId, Sinks.Empty<Void> cancellation) {
        backgroundCancellations.computeIfPresent(jobId, (_, cancellations) -> {
            cancellations.remove(cancellation);
            return cancellations.isEmpty() ? null : cancellations;
        });
    }
}
