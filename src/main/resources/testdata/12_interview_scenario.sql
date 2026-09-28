-- ===========================================================
-- 12_interview_scenario.sql
-- Scenario: Invites 'applicant1' (Max Applicant) to an interview process and adds EXTENSIVE slots for testing.
-- Prerequisites: Run 01_users.sql, 10_interview_processes.sql, 07_applications.sql
-- ===========================================================

-- 1. Create Slots for existing Process 30001 (Linked to Job 20001)
-- Dates: A mix of virtual and in-person slots testing various densities and ranges.

INSERT INTO interview_slots (id, start_date_time, end_date_time, interview_process_id, location, created_at)
VALUES
-- Original Slots (Tomorrow)
('00000000-0000-0000-0000-000000099001', CURRENT_DATE + INTERVAL '34 hours', CURRENT_DATE + INTERVAL '35 hours', '00000000-0000-0000-0000-000000030001', 'virtual', NOW()),
('00000000-0000-0000-0000-000000099002', CURRENT_DATE + INTERVAL '38 hours', CURRENT_DATE + INTERVAL '39 hours', '00000000-0000-0000-0000-000000030001', 'in-person', NOW()),

-- EXTENSIVE TESTING SLOTS

-- A. MANY Slots for TOMORROW (Test vertical scrolling/density & Show More button)
(gen_random_uuid(), CURRENT_DATE + INTERVAL '32 hours', CURRENT_DATE + INTERVAL '33 hours', '00000000-0000-0000-0000-000000030001', 'virtual', NOW()),
(gen_random_uuid(), CURRENT_DATE + INTERVAL '33 hours', CURRENT_DATE + INTERVAL '34 hours', '00000000-0000-0000-0000-000000030001', 'Room 101', NOW()),
(gen_random_uuid(), CURRENT_DATE + INTERVAL '35 hours', CURRENT_DATE + INTERVAL '36 hours', '00000000-0000-0000-0000-000000030001', 'virtual', NOW()),
(gen_random_uuid(), CURRENT_DATE + INTERVAL '36 hours', CURRENT_DATE + INTERVAL '37 hours', '00000000-0000-0000-0000-000000030001', 'Building A', NOW()),
(gen_random_uuid(), CURRENT_DATE + INTERVAL '37 hours', CURRENT_DATE + INTERVAL '38 hours', '00000000-0000-0000-0000-000000030001', 'virtual', NOW()),
(gen_random_uuid(), CURRENT_DATE + INTERVAL '39 hours', CURRENT_DATE + INTERVAL '40 hours', '00000000-0000-0000-0000-000000030001', 'Zoom Link', NOW()),
(gen_random_uuid(), CURRENT_DATE + INTERVAL '40 hours', CURRENT_DATE + INTERVAL '41 hours', '00000000-0000-0000-0000-000000030001', 'virtual', NOW()),
(gen_random_uuid(), CURRENT_DATE + INTERVAL '41 hours', CURRENT_DATE + INTERVAL '42 hours', '00000000-0000-0000-0000-000000030001', 'in-person', NOW()),
(gen_random_uuid(), CURRENT_DATE + INTERVAL '42 hours', CURRENT_DATE + INTERVAL '43 hours', '00000000-0000-0000-0000-000000030001', 'virtual', NOW()),
(gen_random_uuid(), CURRENT_DATE + INTERVAL '43 hours', CURRENT_DATE + INTERVAL '44 hours', '00000000-0000-0000-0000-000000030001', 'in-person', NOW()),

-- B. Slots for NEXT 12 DAYS (Test horizontal scrolling / pagination)
(gen_random_uuid(), CURRENT_DATE + INTERVAL '58 hours', CURRENT_DATE + INTERVAL '59 hours', '00000000-0000-0000-0000-000000030001', 'virtual', NOW()), -- Day 2
(gen_random_uuid(), CURRENT_DATE + INTERVAL '62 hours', CURRENT_DATE + INTERVAL '63 hours', '00000000-0000-0000-0000-000000030001', 'in-person', NOW()), -- Day 2
(gen_random_uuid(), CURRENT_DATE + INTERVAL '82 hours', CURRENT_DATE + INTERVAL '83 hours', '00000000-0000-0000-0000-000000030001', 'virtual', NOW()), -- Day 3
(gen_random_uuid(), CURRENT_DATE + INTERVAL '106 hours', CURRENT_DATE + INTERVAL '107 hours', '00000000-0000-0000-0000-000000030001', 'in-person', NOW()), -- Day 4
(gen_random_uuid(), CURRENT_DATE + INTERVAL '130 hours', CURRENT_DATE + INTERVAL '131 hours', '00000000-0000-0000-0000-000000030001', 'virtual', NOW()), -- Day 5
(gen_random_uuid(), CURRENT_DATE + INTERVAL '154 hours', CURRENT_DATE + INTERVAL '155 hours', '00000000-0000-0000-0000-000000030001', 'in-person', NOW()), -- Day 6
(gen_random_uuid(), CURRENT_DATE + INTERVAL '178 hours', CURRENT_DATE + INTERVAL '179 hours', '00000000-0000-0000-0000-000000030001', 'virtual', NOW()), -- Day 7
(gen_random_uuid(), CURRENT_DATE + INTERVAL '202 hours', CURRENT_DATE + INTERVAL '203 hours', '00000000-0000-0000-0000-000000030001', 'in-person', NOW()), -- Day 8
(gen_random_uuid(), CURRENT_DATE + INTERVAL '226 hours', CURRENT_DATE + INTERVAL '227 hours', '00000000-0000-0000-0000-000000030001', 'virtual', NOW()), -- Day 9
(gen_random_uuid(), CURRENT_DATE + INTERVAL '250 hours', CURRENT_DATE + INTERVAL '251 hours', '00000000-0000-0000-0000-000000030001', 'in-person', NOW()), -- Day 10
(gen_random_uuid(), CURRENT_DATE + INTERVAL '274 hours', CURRENT_DATE + INTERVAL '275 hours', '00000000-0000-0000-0000-000000030001', 'virtual', NOW()), -- Day 11
(gen_random_uuid(), CURRENT_DATE + INTERVAL '298 hours', CURRENT_DATE + INTERVAL '299 hours', '00000000-0000-0000-0000-000000030001', 'in-person', NOW()), -- Day 12

-- C. Slots for NEXT MONTH (Test Month Navigation)
(gen_random_uuid(), CURRENT_DATE + INTERVAL '30 days', CURRENT_DATE + INTERVAL '30 days' + INTERVAL '1 hour', '00000000-0000-0000-0000-000000030001', 'virtual', NOW()),
(gen_random_uuid(), CURRENT_DATE + INTERVAL '30 days' + INTERVAL '2 hours', CURRENT_DATE + INTERVAL '30 days' + INTERVAL '3 hours', '00000000-0000-0000-0000-000000030001', 'Room 202', NOW()),
(gen_random_uuid(), CURRENT_DATE + INTERVAL '31 days', CURRENT_DATE + INTERVAL '31 days' + INTERVAL '1 hour', '00000000-0000-0000-0000-000000030001', 'virtual', NOW())
ON CONFLICT (id) DO NOTHING;


-- 2. Invite applicant1 to Process 30001
-- Uses existing Application 300000020002 (Applicant 1 -> Job 20001)
INSERT INTO interviewees (id, interview_process_id, application_id, last_invited, created_at)
VALUES
('00000000-0000-0000-0000-000000099100', '00000000-0000-0000-0000-000000030001', '00000000-0000-0000-0000-300000020002', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET last_invited = NOW();

-- 3. Add UNCONTACTED interviewees for Bulk Send Testing (last_invited = NULL)
-- Uses existing applications from 07_applications.sql
INSERT INTO interviewees (id, interview_process_id, application_id, last_invited, created_at)
VALUES
-- Amelie Bauer (Application 300000020001 -> Job 20001)
('00000000-0000-0000-0000-000000099101', '00000000-0000-0000-0000-000000030001', '00000000-0000-0000-0000-300000020001', NULL, NOW()),
-- Jay Patel (Application 300000023331 -> Job 20001, REJECTED status but still usable for testing)
('00000000-0000-0000-0000-000000099102', '00000000-0000-0000-0000-000000030001', '00000000-0000-0000-0000-300000023331', NULL, NOW())
ON CONFLICT (id) DO UPDATE SET last_invited = NULL;

-- 4. Update application states to INTERVIEW for all interviewees
-- This ensures the evaluation view shows these applications correctly.
-- last_modified_at is bumped explicitly because PostgreSQL has no ON UPDATE CURRENT_TIMESTAMP.
UPDATE applications SET application_state = 'INTERVIEW', last_modified_at = NOW()
WHERE application_id IN (
    '00000000-0000-0000-0000-300000020002',  -- Max Applicant (invited)
    '00000000-0000-0000-0000-300000020001',  -- Amelie Bauer (uncontacted)
    '00000000-0000-0000-0000-300000023331'   -- Jay Patel (uncontacted)
);
