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
     '00000000-0000-0000-0000-300000020007', CURRENT_DATE - INTERVAL '84 days' + TIME '10:00', CURRENT_DATE - INTERVAL '84 days' + TIME '10:00',
     'Candidate shows strong alignment with the project goals.'),

    ('c4a4c4a4-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000102',
     '00000000-0000-0000-0000-300000020007', CURRENT_DATE - INTERVAL '84 days' + TIME '15:45', CURRENT_DATE - INTERVAL '84 days' + TIME '15:45',
     'Consider inviting to interview despite lack of publications.'),

    -- Application 2
    ('c2a2c2a2-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000102',
     '00000000-0000-0000-0000-300000020002', CURRENT_DATE - INTERVAL '22 days' + TIME '14:30', CURRENT_DATE - INTERVAL '22 days' + TIME '14:30',
     'Strong statistics background and a master thesis that fits our dropout prediction work. Let''s invite him.'),

    ('c5a5c5a5-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000107',
     '00000000-0000-0000-0000-300000020002', CURRENT_DATE - INTERVAL '21 days' + TIME '16:00', CURRENT_DATE - INTERVAL '21 days' + TIME '16:00',
     'Agreed. His reference letter from Prof. Meier is excellent; I would ask about his game design experience in the interview.'),

    -- Application 3
    ('c3a3c3a3-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000105',
     '00000000-0000-0000-0000-300000020006', CURRENT_DATE - INTERVAL '82 days' + TIME '09:15', CURRENT_DATE - INTERVAL '82 days' + TIME '09:15',
     'Seems like a promising student; still in early stages of review.'),

    ('c6a6c6a6-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000101',
     '00000000-0000-0000-0000-300000020006', CURRENT_DATE - INTERVAL '82 days' + TIME '11:30', CURRENT_DATE - INTERVAL '82 days' + TIME '11:30',
     'Needs to submit transcript before final decision.'),

    -- Application 4
    ('c7a7c7a7-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000101',
     '00000000-0000-0000-0000-300000020003', CURRENT_DATE - INTERVAL '81 days' + TIME '13:20', CURRENT_DATE - INTERVAL '81 days' + TIME '13:20',
     'Top candidate. Highly recommended for interview.'),

    ('c8a8c8a8-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000102',
     '00000000-0000-0000-0000-300000020003', CURRENT_DATE - INTERVAL '81 days' + TIME '14:10', CURRENT_DATE - INTERVAL '81 days' + TIME '14:10',
     'Excellent motivation and prior experience in AI research.')
ON CONFLICT (internal_comment_id) DO UPDATE SET
    created_by = EXCLUDED.created_by,
    application_id = EXCLUDED.application_id,
    created_at = EXCLUDED.created_at,
    last_modified_at = EXCLUDED.last_modified_at,
    message = EXCLUDED.message;