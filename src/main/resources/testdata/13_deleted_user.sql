-- =============================================
-- 13_deleted_user.sql
-- Inserts a dummy "deleted user" placeholder for anonymization.
-- This row provides only the required fields.
-- =============================================

INSERT INTO users (
	user_id,
	email,
	first_name,
	last_name,
	selected_language
)
VALUES (
	'00000000-0000-0000-0000-000000000100',
	'deleted@user',
	'Deleted',
	'User',
	'en'
)
ON CONFLICT (user_id) DO UPDATE SET
	email = EXCLUDED.email,
	first_name = EXCLUDED.first_name,
	last_name = EXCLUDED.last_name,
	selected_language = EXCLUDED.selected_language;
