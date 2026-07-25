-- =============================================
-- 01_users.sql
-- Inserts example users
-- Preconditions:
--   - Memberships are written separately into user_research_group_roles (see 03_user_roles.sql)
--   - avatar_file_id, cv_file_id, bachelor_certificate_id, master_certificate_id may be NULL
-- =============================================
-- Clean up existing users
DELETE FROM users
WHERE user_id LIKE '00000000-0000-0000-0000-0000000001%'
  OR user_id LIKE '11111111-0000-0000-0000-%';

-- Insert users (standard + edge cases)
REPLACE INTO users (
        user_id,
        email,
        avatar,
        first_name,
        last_name,
        gender,
        nationality,
        birthday,
        phone_number,
        website,
        linkedin_url,
        selected_language,
        university_id
)
VALUES
        ('00000000-0000-0000-0000-000000000101', 'admin1@tumapply.local', NULL, 'System', 'Admin', NULL, 'de', NULL, NULL, NULL, NULL, 'en','abcd000'),
        ('00000000-0000-0000-0000-000000000102', 'professor1@tumapply.local', NULL, 'Anna', 'Professorin', 'female', 'de', '1990-01-01', '+49123456789', 'https://ai.tum.de', NULL, 'de','abcd001'),
        ('00000000-0000-0000-0000-000000000103', 'applicant1@tumapply.local', NULL, 'Max', 'Applicant', 'male', 'de', '1999-05-26', '+49123456789', NULL, 'https://linkedin.com/in/max', 'de','abcd002'),
        ('00000000-0000-0000-0000-000000000104', 'applicant2@tumapply.local', NULL, 'Sara', 'Extern', 'female', 'de', '1995-12-31', NULL, NULL, NULL, 'en','abcd003'),
        ('00000000-0000-0000-0000-000000000105', 'professor2@tumapply.local', NULL, 'Professor2', 'TUM', NULL, NULL, NULL, NULL, NULL, NULL, 'en','abcd004'),
        ('00000000-0000-0000-0000-000000000106', 'applicant3@tumapply.local', NULL, 'Jean-Pierre-Étienne', 'Van Der Straaten-Sánchez', 'male', 'be', '1975-07-20', '+3225551234', 'https://intl.edu/users/jps', NULL, 'en','abcd005'),
        ('00000000-0000-0000-0000-000000000107', 'employee1@tumapply.local', NULL, 'Emil', 'Employee', 'male', 'de', '1990-04-15', NULL, NULL, NULL, 'en','abcd107'),
        ('00000000-0000-0000-0000-000000000108', 'employee2@tumapply.local', NULL, 'Eva', 'Employee', 'female', 'de', '1992-08-22', NULL, NULL, NULL, 'en','abcd108'),
        ('00000000-0000-0000-0000-000000000109', 'professor3@tumapply.local', NULL, 'Professor3', 'TUM', NULL, NULL, NULL, NULL, NULL, NULL, 'en','abcd109'),
        ('00000000-0000-0000-0000-000000000110', 'professor4@tumapply.local', NULL, 'Professor4', 'TUM', NULL, NULL, NULL, NULL, NULL, NULL, 'en','abcd110'),
        ('00000000-0000-0000-0000-000000000111', 'professor5@tumapply.local', NULL, 'Professor5', 'TUM', NULL, NULL, NULL, NULL, NULL, NULL, 'en','abcd111'),
        ('00000000-0000-0000-0000-000000000112', 'professor6@tumapply.local', NULL, 'Professor6', 'TUM', NULL, NULL, NULL, NULL, NULL, NULL, 'en','abcd112'),
        ('00000000-0000-0000-0000-000000000113', 'professor7@tumapply.local', NULL, 'Professor7', 'TUM', NULL, NULL, NULL, NULL, NULL, NULL, 'en','abcd113'),
        ('00000000-0000-0000-0000-000000000114', 'professor8@tumapply.local', NULL, 'Professor8', 'TUM', NULL, NULL, NULL, NULL, NULL, NULL, 'en','abcd114'),
        ('00000000-0000-0000-0000-000000000115', 'professor9@tumapply.local', NULL, 'Professor9', 'TUM', NULL, NULL, NULL, NULL, NULL, NULL, 'en','abcd115'),
        ('00000000-0000-0000-0000-000000000116', 'professor10@tumapply.local', NULL, 'Professor10', 'TUM', NULL, NULL, NULL, NULL, NULL, NULL, 'en','abcd116'),
        ('00000000-0000-0000-0000-000000000117', 'professor11@tumapply.local', NULL, 'Professor11', 'TUM', NULL, NULL, NULL, NULL, NULL, NULL, 'en','abcd117'),
        ('00000000-0000-0000-0000-000000000118', 'professor12@tumapply.local', NULL, 'Professor12', 'TUM', NULL, NULL, NULL, NULL, NULL, NULL, 'en','abcd118'),
        ('00000000-0000-0000-0000-000000000119', 'professor13@tumapply.local', NULL, 'Professor13', 'TUM', NULL, NULL, NULL, NULL, NULL, NULL, 'en','abcd119'),
        ('00000000-0000-0000-0000-000000000120', 'professor14@tumapply.local', NULL, 'Professor14', 'TUM', NULL, NULL, NULL, NULL, NULL, NULL, 'en','abcd120'),
        ('00000000-0000-0000-0000-000000000121', 'professor15@tumapply.local', NULL, 'Professor15', 'TUM', NULL, NULL, NULL, NULL, NULL, NULL, 'en','abcd121'),
        ('00000000-0000-0000-0000-000000000122', 'professor16@tumapply.local', NULL, 'Professor16', 'TUM', NULL, NULL, NULL, NULL, NULL, NULL, 'en','abcd122'),
        ('00000000-0000-0000-0000-000000000123', 'professor17@tumapply.local', NULL, 'Professor17', 'TUM', NULL, NULL, NULL, NULL, NULL, NULL, 'en','abcd123'),
        ('00000000-0000-0000-0000-000000000124', 'professor18@tumapply.local', NULL, 'Professor18', 'TUM', NULL, NULL, NULL, NULL, NULL, NULL, 'en','abcd124'),
        ('00000000-0000-0000-0000-000000000125', 'professor19@tumapply.local', NULL, 'Professor19', 'TUM', NULL, NULL, NULL, NULL, NULL, NULL, 'en','abcd125'),
        ('00000000-0000-0000-0000-000000000126', 'professor20@tumapply.local', NULL, 'Professor20', 'TUM', NULL, NULL, NULL, NULL, NULL, NULL, 'en','abcd126'),
        ('11111111-0000-0000-0000-000000000001', 'amelie.bauer@tumapply.local', NULL, 'Amelie', 'Bauer', 'female', 'de', '1993-03-14', '+49 89 99887766', 'https://ameliebauer.dev', 'https://linkedin.com/in/ameliebauer123', 'de','abcd006'),
        ('11111111-0000-0000-0000-000000000002', 'daniel.kim@tumapply.local', NULL, 'Daniel', 'Kim', 'male', 'nl', '1987-08-10', '+82 2 777 8888', 'https://danielkim.kr', 'https://linkedin.com/in/danielkim123', 'en','abcd007'),
        ('11111111-0000-0000-0000-000000000003', 'lina.zhang@tumapply.local', NULL, 'Lina', 'Zhang', 'female', 'fr', '1992-11-22', '+86 10 1234 5678', 'https://linazhang.cn', 'https://linkedin.com/in/linazhang123', 'en','abcd008'),
        ('11111111-0000-0000-0000-000000000004', 'thomas.miller@tumapply.local', NULL, 'Thomas', 'Miller', 'male', 'de', '1985-05-18', '+1 212 555 7890', 'https://thomasmiller.com', 'https://linkedin.com/in/thomasmiller123', 'en','abcd009'),
        ('11111111-0000-0000-0000-000000000005', 'sofia.ricci@tumapply.local', NULL, 'Sofia', 'Ricci', 'female', 'nl', '1990-06-25', '+39 06 555 7890', 'https://sofiaricci.it', 'https://linkedin.com/in/sofiaricci123', 'en','abcd010'),
        ('11111111-0000-0000-0000-000000000006', 'khalid.hassan@tumapply.local', NULL, 'Khalid', 'Hassan', 'male', 'es', '1988-02-17', '+20 2 12345678', 'https://khalidhassan.com', 'https://linkedin.com/in/khalidhassan123', 'en','abcd011'),
        ('11111111-0000-0000-0000-000000000007', 'ines.fernandez@tumapply.local', NULL, 'Ines', 'Fernández', 'female', 'es', '1991-09-11', '+34 91 456 7890', 'https://inesfernandez.es', 'https://linkedin.com/in/inesfernandez123', 'en','abcd012'),
        ('11111111-0000-0000-0000-000000000008', 'adam.nowak@tumapply.local', NULL, 'Adam', 'Nowak', 'male', 'pl', '1986-07-04', '+48 22 888 9999', 'https://adamnowak.pl', 'https://linkedin.com/in/adamnowak123', 'en','abcd013'),
        ('11111111-0000-0000-0000-000000000009', 'elena.kovalenko@tumapply.local', NULL, 'Elena', 'Kovalenko', 'female', 'de', '1994-10-29', '+380 44 1234567', 'https://elenakovalenko.ua', 'https://linkedin.com/in/elenakovalenko123', 'en','abcd014'),
        ('11111111-0000-0000-0000-000000000010', 'jamal.abdi@tumapply.local', NULL, 'Jamal', 'Abdi', 'male', 'tr', '1990-01-09', '+254 20 1112223', 'https://jamalabdi.ke', 'https://linkedin.com/in/jamalabdi123', 'en','abcd015'),
        ('11111111-0000-0000-0000-000000000011', 'sophie.lee@tumapply.local', NULL, 'Sophie', 'Lee', 'female', 'md', '1993-05-01', '+65 6123 4567', 'https://sophielee.sg', 'https://linkedin.com/in/sophielee123', 'en','abcd016'),
        ('11111111-0000-0000-0000-000000000012', 'hassan.mohammed@tumapply.local', NULL, 'Hassan', 'Mohammed', 'male', 'tr', '1987-03-03', '+966 11 1234567', 'https://hassanmohammed.sa', 'https://linkedin.com/in/hassanmohammed123', 'en','abcd017'),
        ('11111111-0000-0000-0000-000000000013', 'tatiana.ivanova@tumapply.local', NULL, 'Tatiana', 'Ivanova', 'female', 'ua', '1989-04-04', '+7 495 1234567', 'https://tatianaivanova.ru', 'https://linkedin.com/in/tatianaivanova123', 'en','abcd018'),
        ('11111111-0000-0000-0000-000000000014', 'jacob.green@tumapply.local', NULL, 'Jacob', 'Green', 'male', 'tr', '1991-12-12', '+1 416 1234567', 'https://jacobgreen.ca', 'https://linkedin.com/in/jacobgreen123', 'en','abcd019'),
        ('11111111-0000-0000-0000-000000000015', 'li.hua@tumapply.local', NULL, 'Li', 'Hua', 'female', 'fr', '1995-06-06', '+86 21 12345678', 'https://lihua.cn', 'https://linkedin.com/in/lihua123', 'en','abcd020'),
        ('11111111-0000-0000-0000-000000000016', 'julia.martin@tumapply.local', NULL, 'Julia', 'Martin', 'female', 'fr', '1992-02-02', '+33 1 23456789', 'https://juliamartin.fr', 'https://linkedin.com/in/juliamartin123', 'en','abcd021'),
        ('11111111-0000-0000-0000-000000000017', 'ahmad.rahman@tumapply.local', NULL, 'Ahmad', 'Rahman', 'male', 'de', '1990-07-21', '+880 2 123456', 'https://ahmadrahman.bd', 'https://linkedin.com/in/ahmadrahman123', 'en','abcd022'),
        ('11111111-0000-0000-0000-000000000018', 'lucy.taylor@tumapply.local', NULL, 'Lucy', 'Taylor', 'female', 'de', '1988-10-10', '+44 161 1234567', 'https://lucytaylor.uk', 'https://linkedin.com/in/lucytaylor123', 'en','abcd023'),
        ('11111111-0000-0000-0000-000000000019', 'leon.schmidt@tumapply.local', NULL, 'Leon', 'Schmidt', 'male', 'de', '1985-11-11', '+49 30 9876543', 'https://leonschmidt.de', 'https://linkedin.com/in/leonschmidt123', 'de','abcd024'),
        ('11111111-0000-0000-0000-000000000020', 'nina.petrova@tumapply.local', NULL, 'Nina', 'Petrova', 'female', 'ua', '1993-08-08', '+7 812 1234567', 'https://ninapetrova.ru', 'https://linkedin.com/in/ninapetrova123', 'en','abcd025'),
        ('11111111-0000-0000-0000-000000000021', 'george.mensah@tumapply.local', NULL, 'George', 'Mensah', 'male', 'pl', '1987-04-14', '+233 302 123456', 'https://georgemensah.gh', 'https://linkedin.com/in/georgemensah123', 'en','abcd026'),
        ('11111111-0000-0000-0000-000000000022', 'eva.fischer@tumapply.local', NULL, 'Eva', 'Fischer', 'female', 'de', '1990-12-03', '+49 89 4445556', 'https://evafischer.de', 'https://linkedin.com/in/evafischer123', 'de','abcd027'),
        ('11111111-0000-0000-0000-000000000023', 'jay.patel@tumapply.local', NULL, 'Jay', 'Patel', 'male', 'no', '1994-05-17', '+91 22 87654321', 'https://jaypatel.in', 'https://linkedin.com/in/jaypatel123', 'en','abcd028'),
        ('11111111-0000-0000-0000-000000000024', 'olga.smirnova@tumapply.local', NULL, 'Olga', 'Smirnova', 'female', 'ua', '1992-01-15', '+7 343 123456', 'https://olgasmirnova.ru', 'https://linkedin.com/in/olgasmirnova123', 'en','abcd029'),
        ('11111111-0000-0000-0000-000000000025', 'karim.saad@tumapply.local', NULL, 'Karim', 'Saad', 'male', 'es', '1989-09-09', '+20 2 11223344', 'https://karimsaad.eg', 'https://linkedin.com/in/karimsaad123', 'en','abcd030'),
        ('11111111-0000-0000-0000-000000000026', 'meera.iyer@tumapply.local', NULL, 'Meera', 'Iyer', 'female', 'no', '1996-03-03', '+91 80 33445566', 'https://meera.in', 'https://linkedin.com/in/meera123', 'en','abcd031'),
        ('11111111-0000-0000-0000-000000000027', 'erik.olsen@tumapply.local', NULL, 'Erik', 'Olsen', 'male', 'no', '1986-06-06', '+46 8 123456', 'https://erikolsen.se', 'https://linkedin.com/in/erikolsen123', 'en','abcd032'),
        ('11111111-0000-0000-0000-000000000028', 'claire.lambert@tumapply.local', NULL, 'Claire', 'Lambert', 'female', 'fr', '1988-08-08', '+33 1 456789', 'https://clairelambert.fr', 'https://linkedin.com/in/clairelambert123', 'en', NULL),
        ('11111111-0000-0000-0000-000000000029', 'matteo.rinaldi@tumapply.local', NULL, 'Matteo', 'Rinaldi', 'male', 'nl', '1991-07-07', '+39 02 123456', 'https://matteorinaldi.it', 'https://linkedin.com/in/matteorinaldi123', 'en', NULL),
        ('11111111-0000-0000-0000-000000000030', 'noor.ahmed@tumapply.local', NULL, 'Noor', 'Ahmed', 'female', 'fr', '1995-02-02', '+92 42 1234567', 'https://noorahmed.pk', 'https://linkedin.com/in/noorahmed123', 'en', NULL);

-- Applicant credentials for internal (non-Keycloak) authentication.
-- Applicant sign-in moved out of Keycloak's external-login realm into TUM Apply's own user
-- management, so applicant accounts need a local BCrypt password hash and a verified email.
-- The hash corresponds to the password 'applicant' (matches the Lighthouse TEST_PASSWORD).
-- TUM staff (admins/professors/employees) keep authenticating via Keycloak and need no password.
UPDATE users
SET password_hash = '$2y$10$yJrPdMaUKIMki3OWuBPCR.JrXo7yzLwVOPP53wKNB9VGHnojvOsIO',
    email_verified = TRUE
WHERE user_id IN (
        '00000000-0000-0000-0000-000000000103',
        '00000000-0000-0000-0000-000000000104',
        '00000000-0000-0000-0000-000000000106'
    )
   OR user_id LIKE '11111111-0000-0000-0000-%';
