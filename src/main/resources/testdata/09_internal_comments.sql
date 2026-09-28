-- =============================================
-- 09_internal_comments.sql
-- Inserts example internal_comments
-- Preconditions:
--   - applications must exist
--   - users (reviewer) must exist
-- =============================================

-- Clean specific test data
DELETE
FROM internal_comments
WHERE internal_comment_id IN ('c1a1c1a1-1111-1111-1111-111111111111',
                              'c2a2c2a2-2222-2222-2222-222222222222',
                              'c3a3c3a3-3333-3333-3333-333333333333',
                              'c4a4c4a4-4444-4444-4444-444444444444',
                              'c5a5c5a5-5555-5555-5555-555555555555',
                              'c6a6c6a6-6666-6666-6666-666666666666',
                              'c7a7c7a7-7777-7777-7777-777777777777',
                              'c8a8c8a8-8888-8888-8888-888888888888');

-- Insert example internal comments
INSERT INTO internal_comments (internal_comment_id,
                                created_by,
                                application_id,
                                created_at,
                                last_modified_at,
                                message)
VALUES
    -- Application 1
    ('c1a1c1a1-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000101',
     '00000000-0000-0000-0000-300000020007', '2025-04-22 10:00:00', '2025-04-22 10:00:00',
     'Candidate shows strong alignment with the project goals.'),

    ('c4a4c4a4-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000102',
     '00000000-0000-0000-0000-300000020007', '2025-04-22 15:45:00', '2025-04-22 15:45:00',
     'Consider inviting to interview despite lack of publications.'),

    -- Application 2
    ('c2a2c2a2-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000102',
     '00000000-0000-0000-0000-300000020002', '2025-04-23 14:30:00', '2025-04-23 14:30:00',
     'Application seems rushed. No personalized motivation.'),

    ('c5a5c5a5-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000105',
     '00000000-0000-0000-0000-300000020002', '2025-04-23 16:00:00', '2025-04-23 16:00:00',
     'Candidate has good grades, but lacks relevant internships.'),

    -- Application 3
    ('c3a3c3a3-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000105',
     '00000000-0000-0000-0000-300000020006', '2025-04-24 09:15:00', '2025-04-24 09:15:00',
     'Seems like a promising student; still in early stages of review.'),

    ('c6a6c6a6-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000101',
     '00000000-0000-0000-0000-300000020006', '2025-04-24 11:30:00', '2025-04-24 11:30:00',
     'Needs to submit transcript before final decision.'),

    -- Application 4
    ('c7a7c7a7-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000101',
     '00000000-0000-0000-0000-300000020003', '2025-04-25 13:20:00', '2025-04-25 13:20:00',
     'Top candidate. Highly recommended for interview.'),

    ('c8a8c8a8-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000102',
     '00000000-0000-0000-0000-300000020003', '2025-04-25 14:10:00', '2025-04-25 14:10:00',
     'Excellent motivation and prior experience in AI research.')
ON CONFLICT (internal_comment_id) DO UPDATE SET
    created_by = EXCLUDED.created_by,
    application_id = EXCLUDED.application_id,
    created_at = EXCLUDED.created_at,
    last_modified_at = EXCLUDED.last_modified_at,
    message = EXCLUDED.message;