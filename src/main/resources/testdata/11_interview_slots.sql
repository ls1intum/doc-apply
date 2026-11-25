-- ===========================================================
-- 11_interview_slots.sql
-- Resets all interview_slots for consistent seeding
-- ===========================================================

-- 🧹 Delete ALL interview slots (clean slate)
DELETE FROM interview_slots;

-- 🔄 Re-insert example interview slots

-- ======================================================
-- Slots for Process 00000000-0000-0000-0000-000000030001
-- ======================================================

-- 📅 PAST SLOTS (6 days ago)
INSERT INTO interview_slots (id, interview_process_id, start_date_time, end_date_time, location, stream_link, is_booked, created_by, created_at, last_modified_by, last_modified_at)
VALUES
  ('00000000-0000-0000-0000-000000050001', '00000000-0000-0000-0000-000000030001', CURRENT_DATE - INTERVAL '6 days' + TIME '08:00', CURRENT_DATE - INTERVAL '6 days' + TIME '08:45', 'Room MI 01.11.018', NULL, FALSE, 'system', CURRENT_DATE - INTERVAL '15 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '15 days' + TIME '10:00'),
  ('00000000-0000-0000-0000-000000050002', '00000000-0000-0000-0000-000000030001', CURRENT_DATE - INTERVAL '6 days' + TIME '09:00', CURRENT_DATE - INTERVAL '6 days' + TIME '09:45', 'Room MI 01.11.018', NULL, FALSE, 'system', CURRENT_DATE - INTERVAL '15 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '15 days' + TIME '10:00');

-- 📅 in 2 days - 3 slots
INSERT INTO interview_slots (id, interview_process_id, start_date_time, end_date_time, location, stream_link, is_booked, created_by, created_at, last_modified_by, last_modified_at)
VALUES
  ('00000000-0000-0000-0000-000000040001', '00000000-0000-0000-0000-000000030001', CURRENT_DATE + INTERVAL '2 days' + TIME '08:00', CURRENT_DATE + INTERVAL '2 days' + TIME '08:45', 'Room MI 01.11.018', NULL, TRUE, 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00'),
  ('00000000-0000-0000-0000-000000040002', '00000000-0000-0000-0000-000000030001', CURRENT_DATE + INTERVAL '2 days' + TIME '09:00', CURRENT_DATE + INTERVAL '2 days' + TIME '09:45', 'Room MI 01.11.018', NULL, FALSE, 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00'),
  ('00000000-0000-0000-0000-000000040003', '00000000-0000-0000-0000-000000030001', CURRENT_DATE + INTERVAL '2 days' + TIME '13:00', CURRENT_DATE + INTERVAL '2 days' + TIME '13:45', 'virtual', 'https://zoom.us/j/123456789', FALSE, 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00');

-- 📅 in 3 days - 2 slots
INSERT INTO interview_slots (id, interview_process_id, start_date_time, end_date_time, location, stream_link, is_booked, created_by, created_at, last_modified_by, last_modified_at)
VALUES
  ('00000000-0000-0000-0000-000000040004', '00000000-0000-0000-0000-000000030001', CURRENT_DATE + INTERVAL '3 days' + TIME '08:00', CURRENT_DATE + INTERVAL '3 days' + TIME '08:45', 'Room MI 01.11.018', NULL, FALSE, 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00'),
  ('00000000-0000-0000-0000-000000040005', '00000000-0000-0000-0000-000000030001', CURRENT_DATE + INTERVAL '3 days' + TIME '10:00', CURRENT_DATE + INTERVAL '3 days' + TIME '10:45', 'virtual', 'https://meet.google.com/abc-defg-hij', FALSE, 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00');

-- 📅 in 4 days - 2 slots
INSERT INTO interview_slots (id, interview_process_id, start_date_time, end_date_time, location, stream_link, is_booked, created_by, created_at, last_modified_by, last_modified_at)
VALUES
  ('00000000-0000-0000-0000-000000040006', '00000000-0000-0000-0000-000000030001', CURRENT_DATE + INTERVAL '4 days' + TIME '12:00', CURRENT_DATE + INTERVAL '4 days' + TIME '12:45', 'Room MI 02.13.010', NULL, FALSE, 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00'),
  ('00000000-0000-0000-0000-000000040007', '00000000-0000-0000-0000-000000030001', CURRENT_DATE + INTERVAL '4 days' + TIME '14:00', CURRENT_DATE + INTERVAL '4 days' + TIME '14:45', 'virtual', 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc123', FALSE, 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00');

-- 📅 in 7 days - 1 slot
INSERT INTO interview_slots (id, interview_process_id, start_date_time, end_date_time, location, stream_link, is_booked, created_by, created_at, last_modified_by, last_modified_at)
VALUES
  ('00000000-0000-0000-0000-000000040008', '00000000-0000-0000-0000-000000030001', CURRENT_DATE + INTERVAL '7 days' + TIME '09:00', CURRENT_DATE + INTERVAL '7 days' + TIME '09:45', 'Room MI 01.11.018', NULL, FALSE, 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00');

-- 📅 in 2 days - additional 2 slots
INSERT INTO interview_slots (id, interview_process_id, start_date_time, end_date_time, location, stream_link, is_booked, created_by, created_at, last_modified_by, last_modified_at)
VALUES
  ('00000000-0000-0000-0000-000000040009', '00000000-0000-0000-0000-000000030001',
   CURRENT_DATE + INTERVAL '2 days' + TIME '10:00', CURRENT_DATE + INTERVAL '2 days' + TIME '10:45', 'Room MI 01.11.018', NULL, FALSE, 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00'),
  ('00000000-0000-0000-0000-000000040010', '00000000-0000-0000-0000-000000030001',
   CURRENT_DATE + INTERVAL '2 days' + TIME '15:00', CURRENT_DATE + INTERVAL '2 days' + TIME '15:45', 'virtual', 'https://zoom.us/j/987654321', FALSE, 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00');

-- 📅 in 8 days - 3 slots
INSERT INTO interview_slots (id, interview_process_id, start_date_time, end_date_time, location, stream_link, is_booked, created_by, created_at, last_modified_by, last_modified_at)
VALUES
  ('00000000-0000-0000-0000-000000040011', '00000000-0000-0000-0000-000000030001',
   CURRENT_DATE + INTERVAL '8 days' + TIME '09:00', CURRENT_DATE + INTERVAL '8 days' + TIME '09:45', 'Room MI 01.11.018', NULL, FALSE, 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00'),
  ('00000000-0000-0000-0000-000000040012', '00000000-0000-0000-0000-000000030001',
   CURRENT_DATE + INTERVAL '8 days' + TIME '11:00', CURRENT_DATE + INTERVAL '8 days' + TIME '11:45', 'virtual', 'https://zoom.us/j/111222333', FALSE, 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00'),
  ('00000000-0000-0000-0000-000000040013', '00000000-0000-0000-0000-000000030001',
   CURRENT_DATE + INTERVAL '8 days' + TIME '14:00', CURRENT_DATE + INTERVAL '8 days' + TIME '14:45', 'Room MI 02.13.010', NULL, FALSE, 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00');

-- 📅 in 9 days - 5 slots (large day)
INSERT INTO interview_slots (id, interview_process_id, start_date_time, end_date_time, location, stream_link, is_booked, created_by, created_at, last_modified_by, last_modified_at)
VALUES
  ('00000000-0000-0000-0000-000000040014', '00000000-0000-0000-0000-000000030001',
   CURRENT_DATE + INTERVAL '9 days' + TIME '08:00', CURRENT_DATE + INTERVAL '9 days' + TIME '08:45', 'Room MI 01.11.018', NULL, FALSE, 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00'),
  ('00000000-0000-0000-0000-000000040015', '00000000-0000-0000-0000-000000030001',
   CURRENT_DATE + INTERVAL '9 days' + TIME '09:00', CURRENT_DATE + INTERVAL '9 days' + TIME '09:45', 'Room MI 01.11.018', NULL, TRUE, 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00'),
  ('00000000-0000-0000-0000-000000040016', '00000000-0000-0000-0000-000000030001',
   CURRENT_DATE + INTERVAL '9 days' + TIME '10:00', CURRENT_DATE + INTERVAL '9 days' + TIME '10:45', 'virtual', 'https://zoom.us/j/444555666', FALSE, 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00'),
  ('00000000-0000-0000-0000-000000040017', '00000000-0000-0000-0000-000000030001',
   CURRENT_DATE + INTERVAL '9 days' + TIME '13:00', CURRENT_DATE + INTERVAL '9 days' + TIME '13:45', 'Room MI 02.13.010', NULL, FALSE, 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00'),
  ('00000000-0000-0000-0000-000000040018', '00000000-0000-0000-0000-000000030001',
   CURRENT_DATE + INTERVAL '9 days' + TIME '15:00', CURRENT_DATE + INTERVAL '9 days' + TIME '15:45', 'virtual', 'https://meet.google.com/xyz-abc-123', FALSE, 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00');

-- 📅 in 10 days - 2 slots
INSERT INTO interview_slots (id, interview_process_id, start_date_time, end_date_time, location, stream_link, is_booked, created_by, created_at, last_modified_by, last_modified_at)
VALUES
  ('00000000-0000-0000-0000-000000040019', '00000000-0000-0000-0000-000000030001',
   CURRENT_DATE + INTERVAL '10 days' + TIME '09:00', CURRENT_DATE + INTERVAL '10 days' + TIME '09:45', 'Room MI 01.11.018', NULL, FALSE, 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00'),
  ('00000000-0000-0000-0000-000000040020', '00000000-0000-0000-0000-000000030001',
   CURRENT_DATE + INTERVAL '10 days' + TIME '11:00', CURRENT_DATE + INTERVAL '10 days' + TIME '11:45', 'virtual', 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_xyz987', FALSE,
   'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00', 'system', CURRENT_DATE - INTERVAL '8 days' + TIME '10:00');
