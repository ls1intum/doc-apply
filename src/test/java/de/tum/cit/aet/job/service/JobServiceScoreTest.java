package de.tum.cit.aet.job.service;

import static org.assertj.core.api.Assertions.assertThat;

import de.tum.cit.aet.ai.constants.ComplianceAction;
import de.tum.cit.aet.ai.constants.ComplianceCategory;
import de.tum.cit.aet.ai.domain.ComplianceIssue;
import java.util.List;
import org.junit.jupiter.api.Test;

class JobServiceScoreTest {

    @Test
    void shouldCountMappedLanguageCopiesOnlyOnce() {
        ComplianceIssue english = issue("finding-1", "External cooperation", "en");
        ComplianceIssue german = issue("finding-1", "Externe Kooperation", "de");

        int score = JobService.calculateCombinedAiScore(100, List.of(english, german));

        // legal = 100 * 0.85 = 85; overall = sqrt(100 * 85) = 92
        assertThat(score).isEqualTo(92);
    }

    private static ComplianceIssue issue(String id, String text, String language) {
        return new ComplianceIssue(
            id,
            ComplianceCategory.TRANSPARENCY,
            text,
            "Art. 13/14 DSGVO",
            "External data sharing is not disclosed.",
            ComplianceAction.ADD,
            language
        );
    }
}
