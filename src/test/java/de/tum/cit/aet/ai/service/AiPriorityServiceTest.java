package de.tum.cit.aet.ai.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CancellationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import reactor.core.publisher.Flux;
import reactor.test.StepVerifier;

class AiPriorityServiceTest {

    private AiPriorityService service;

    @BeforeEach
    void setUp() {
        service = new AiPriorityService();
    }

    @Test
    void shouldPassThroughBackgroundWhenNoForegroundArrives() {
        UUID jobId = UUID.randomUUID();

        StepVerifier.create(service.background(jobId, Flux.just("first", "second"))).expectNext("first", "second").verifyComplete();
    }

    @Test
    void shouldCancelLiveBackgroundWhenForegroundStarts() {
        UUID jobId = UUID.randomUUID();

        StepVerifier.create(service.background(jobId, Flux.never()))
            .then(() -> service.foreground(jobId, Flux.just("foreground")).blockLast())
            .expectError(CancellationException.class)
            .verify();
    }

    @Test
    void shouldUnregisterCancellationWhenBackgroundCompletes() {
        UUID jobId = UUID.randomUUID();

        StepVerifier.create(service.background(jobId, Flux.just("completed"))).expectNext("completed").verifyComplete();

        Map<?, ?> backgroundCancellations = (Map<?, ?>) ReflectionTestUtils.getField(service, "backgroundCancellations");
        assertThat(backgroundCancellations).isEmpty();
    }

    @Test
    void shouldBypassPriorityHandlingWhenJobIdIsNull() {
        Flux<String> source = Flux.just("unchanged");

        assertThat(service.background(null, source)).isSameAs(source);
        assertThat(service.foreground(null, source)).isSameAs(source);
    }
}
