-- =============================================
-- 02a_schools.sql
-- Inserts example schools
-- =============================================

-- Clean up
DELETE FROM schools
WHERE
    school_id::text LIKE '00000000-0000-0000-0000-%';

-- Insert schools
INSERT INTO
    schools (school_id, name, abbreviation)
VALUES (
        '00000000-0000-0000-0000-000000000001',
        'School of Computation, Information and Technology',
        'CIT'
    ),
    (
        '00000000-0000-0000-0000-000000000002',
        'School of Management',
        'MGT'
    ),
    (
        '00000000-0000-0000-0000-000000000003',
        'School of Engineering and Design',
        'ED'
    ),
    (
        '00000000-0000-0000-0000-000000000004',
        'School of Natural Sciences',
        'NAT'
    ),
    (
        '00000000-0000-0000-0000-000000000005',
        'School of Life Sciences',
        'LS'
    ),
    (
        '00000000-0000-0000-0000-000000000006',
        'School of Medicine and Health',
        'MH'
    ),
    (
        '00000000-0000-0000-0000-000000000007',
        'School of Social Sciences and Technology',
        'SOT'
    )
ON CONFLICT (school_id) DO UPDATE SET
    name = EXCLUDED.name,
    abbreviation = EXCLUDED.abbreviation;
