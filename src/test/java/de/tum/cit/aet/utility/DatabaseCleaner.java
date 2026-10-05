package de.tum.cit.aet.utility;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DatabaseCleaner {

    private final JdbcTemplate jdbc;

    private static final int MAX_ATTEMPTS = 5;

    private static final List<String> TABLES = List.of(
        "ai_usage_events",
        "application_reviews",
        "applications",
        "applicants",
        "data_export_requests",
        "deleted_users",
        "departments",
        "documents",
        "email_settings",
        "email_templates",
        "email_verification_otp",
        "images",
        "internal_comments",
        "interview_processes",
        "interview_slots",
        "jobs",
        "applicant_subject_area_subscriptions",
        "ratings",
        "reference_requests",
        "research_groups",
        "schools",
        "user_research_group_roles",
        "user_settings",
        "users"
    );

    /**
     * Empties all application tables in one statement. CASCADE also empties tables that reference them,
     * so the order of the list does not matter. An async task left over from the previous test (e.g. an
     * email being sent) can still hold locks on these tables, and PostgreSQL may resolve the conflict by
     * aborting the TRUNCATE as a deadlock victim, so the statement is retried.
     */
    public void clean() {
        String truncate = "TRUNCATE TABLE " + String.join(", ", TABLES) + " CASCADE";
        for (int attempt = 1; ; attempt++) {
            try {
                jdbc.execute(truncate);
                return;
            } catch (PessimisticLockingFailureException e) {
                if (attempt == MAX_ATTEMPTS) {
                    throw e;
                }
            }
        }
    }
}
