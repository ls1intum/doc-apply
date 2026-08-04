package de.tum.cit.aet.utility;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DatabaseCleaner {

    private final JdbcTemplate jdbc;

    private static final List<String> TABLES = List.of(
        "ai_usage_events",
        "application_reviews",
        "applications",
        "applicants",
        "data_export_requests",
        "departments",
        "documents",
        "email_settings",
        "email_template_translations",
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

    public void clean() {
        jdbc.execute("SET REFERENTIAL_INTEGRITY FALSE");

        for (String table : TABLES) {
            try {
                jdbc.execute("TRUNCATE TABLE " + table);
            } catch (Exception e) {
                // Optional: log or ignore missing tables
                System.err.println("Could not truncate table " + table + ": " + e.getMessage());
            }
        }

        jdbc.execute("SET REFERENTIAL_INTEGRITY TRUE");
    }
}
