-- =============================================
-- 00_drop_all_tables.sql
-- Resets the database by truncating all tables
-- Preconditions:
--   - All tables must already exist
--   - This script removes all data but keeps the schema and the Liquibase changelog tables
-- Notes:
--   - system_settings is intentionally NOT truncated. Its default rows (e.g. ai.enabled)
--     are seeded by Liquibase only on first run, so truncating would silently remove them.
--   - All tables are truncated in one statement, so foreign keys between them do not
--     get in the way and no constraint checks need to be disabled.
-- =============================================

TRUNCATE TABLE
    ai_usage_events,
    app_refresh_token,
    applicants,
    applicant_subject_area_subscriptions,
    application_reviews,
    applications,
    data_export_requests,
    deleted_users,
    departments,
    documents,
    email_settings,
    email_templates,
    email_verification_otp,
    images,
    internal_comments,
    interview_processes,
    interview_slots,
    interviewees,
    job_biased_issues,
    job_compliance_issues,
    jobs,
    ratings,
    reference_requests,
    research_groups,
    schools,
    user_credentials,
    user_entities,
    user_research_group_roles,
    user_settings,
    users
RESTART IDENTITY CASCADE;
