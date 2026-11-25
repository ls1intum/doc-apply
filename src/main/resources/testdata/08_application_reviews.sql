-- =============================================
-- 08_application_reviews.sql
-- Inserts example application_reviews
-- Preconditions:
--   - applications must exist
--   - users (reviewer) must exist
-- =============================================

-- clean existing data
DELETE
FROM application_reviews
WHERE application_review_id::text LIKE '820ea750-2c97-4e6b-9e2a-%';
-- insert test data
INSERT INTO application_reviews (
    application_review_id,
    application_id,
    user_id,
    reason,
    reviewed_at
)
VALUES
  ('820ea750-2c97-4e6b-9e2a-000000000001', '00000000-0000-0000-0000-300000020003', '00000000-0000-0000-0000-000000000102', 'Strong match with project needs and experience.', CURRENT_DATE - INTERVAL '2 days' + TIME '11:50'),
  ('820ea750-2c97-4e6b-9e2a-000000000003', '00000000-0000-0000-0000-300000023331', '00000000-0000-0000-0000-000000000102', 'Lacks relevant experience or academic alignment.', CURRENT_DATE - INTERVAL '3 days' + TIME '10:00'),
  ('820ea750-2c97-4e6b-9e2a-000000000004', '00000000-0000-0000-0000-300000020837', '00000000-0000-0000-0000-000000000105', 'Lacks relevant experience or academic alignment.', CURRENT_DATE - INTERVAL '164 days' + TIME '11:02')
ON CONFLICT (application_review_id) DO UPDATE SET
    application_id = EXCLUDED.application_id,
    user_id = EXCLUDED.user_id,
    reason = EXCLUDED.reason,
    reviewed_at = EXCLUDED.reviewed_at;
