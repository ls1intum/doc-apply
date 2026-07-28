-- =============================================
-- 08a_documents.sql
-- Inserts example documents and links them to applicants and applications.
--
-- Schema (single STI table `documents`, see changeset 36):
--   - doc_owner_type = 'APPLICANT'   -> applicant_id IS NOT NULL, application_id IS NULL
--   - doc_owner_type = 'APPLICATION' -> application_id IS NOT NULL, applicant_id IS NULL
--
-- Storage:
--   DocumentService stores files at "{aet.storage.root}/{sha256}.{ext}". The bundled
--   sample-document.pdf has SHA-256
--     ab0fdaa9227be587287f3b3880eed317d795fd8727f3bc55fa6f949d8c54c2f2
--   and is copied into the configured storage root by import-testdata.sh. We store the
--   filename without a leading directory so that DocumentService.resolveStoredPath
--   resolves it against the storage root regardless of the working directory.
--
-- Preconditions:
--   - applicants and applications must exist (06_applicants.sql, 07_applications.sql)
--   - users must exist (01_users.sql)
-- =============================================

-- Clean existing test documents
DELETE FROM docapply.documents WHERE document_id LIKE '00000000-0000-0000-0000-40000000%';

-- Insert test documents
INSERT INTO docapply.documents (
    document_id,
    doc_owner_type,
    document_type,
    name,
    path,
    mime_type,
    size_bytes,
    uploaded_by,
    applicant_id,
    application_id,
    created_at,
    last_modified_at
) VALUES
    -- Applicant profile documents (used to prefill newly created applications)
    ('00000000-0000-0000-0000-400000020001',
     'APPLICANT',
     'CV',
     'sample-cv.pdf',
     'ab0fdaa9227be587287f3b3880eed317d795fd8727f3bc55fa6f949d8c54c2f2.pdf',
     'application/pdf',
     3306,
     '00000000-0000-0000-0000-000000000103',
     '00000000-0000-0000-0000-000000000103',
     NULL,
     NOW(),
     NOW()),

    ('00000000-0000-0000-0000-400000020002',
     'APPLICANT',
     'BACHELOR_TRANSCRIPT',
     'sample-bachelor-transcript.pdf',
     'ab0fdaa9227be587287f3b3880eed317d795fd8727f3bc55fa6f949d8c54c2f2.pdf',
     'application/pdf',
     3306,
     '00000000-0000-0000-0000-000000000103',
     '00000000-0000-0000-0000-000000000103',
     NULL,
     NOW(),
     NOW()),

    -- Application snapshot documents (Max Applicant - Time Series Forecasting Intern, SAVED)
    ('00000000-0000-0000-0000-400000010001',
     'APPLICATION',
     'CV',
     'sample-cv.pdf',
     'ab0fdaa9227be587287f3b3880eed317d795fd8727f3bc55fa6f949d8c54c2f2.pdf',
     'application/pdf',
     3306,
     '00000000-0000-0000-0000-000000000103',
     NULL,
     '00000000-0000-0000-0000-300000020313',
     NOW(),
     NOW()),

    ('00000000-0000-0000-0000-400000010002',
     'APPLICATION',
     'BACHELOR_TRANSCRIPT',
     'sample-bachelor-transcript.pdf',
     'ab0fdaa9227be587287f3b3880eed317d795fd8727f3bc55fa6f949d8c54c2f2.pdf',
     'application/pdf',
     3306,
     '00000000-0000-0000-0000-000000000103',
     NULL,
     '00000000-0000-0000-0000-300000020313',
     NOW(),
     NOW()),

    -- Application snapshot documents (Max Applicant - ACCEPTED)
    ('00000000-0000-0000-0000-400000010003',
     'APPLICATION',
     'CV',
     'sample-cv.pdf',
     'ab0fdaa9227be587287f3b3880eed317d795fd8727f3bc55fa6f949d8c54c2f2.pdf',
     'application/pdf',
     3306,
     '00000000-0000-0000-0000-000000000103',
     NULL,
     '00000000-0000-0000-0000-300000020003',
     NOW(),
     NOW()),

    ('00000000-0000-0000-0000-400000010004',
     'APPLICATION',
     'MASTER_TRANSCRIPT',
     'sample-master-transcript.pdf',
     'ab0fdaa9227be587287f3b3880eed317d795fd8727f3bc55fa6f949d8c54c2f2.pdf',
     'application/pdf',
     3306,
     '00000000-0000-0000-0000-000000000103',
     NULL,
     '00000000-0000-0000-0000-300000020003',
     NOW(),
     NOW()),

    -- Application snapshot documents (Max Applicant - INTERVIEW)
    ('00000000-0000-0000-0000-400000010005',
     'APPLICATION',
     'CV',
     'sample-cv.pdf',
     'ab0fdaa9227be587287f3b3880eed317d795fd8727f3bc55fa6f949d8c54c2f2.pdf',
     'application/pdf',
     3306,
     '00000000-0000-0000-0000-000000000103',
     NULL,
     '00000000-0000-0000-0000-300000020002',
     NOW(),
     NOW()),

    ('00000000-0000-0000-0000-400000010006',
     'APPLICATION',
     'REFERENCE',
     'sample-reference.pdf',
     'ab0fdaa9227be587287f3b3880eed317d795fd8727f3bc55fa6f949d8c54c2f2.pdf',
     'application/pdf',
     3306,
     '00000000-0000-0000-0000-000000000103',
     NULL,
     '00000000-0000-0000-0000-300000020002',
     NOW(),
     NOW()),

    -- Application snapshot documents (Sophie Lee - SENT)
    ('00000000-0000-0000-0000-400000010007',
     'APPLICATION',
     'CV',
     'sample-cv.pdf',
     'ab0fdaa9227be587287f3b3880eed317d795fd8727f3bc55fa6f949d8c54c2f2.pdf',
     'application/pdf',
     3306,
     '11111111-0000-0000-0000-000000000011',
     NULL,
     '00000000-0000-0000-0000-300000020010',
     NOW(),
     NOW()),

    -- Application snapshot documents (Noor Ahmed - IN_REVIEW)
    ('00000000-0000-0000-0000-400000010008',
     'APPLICATION',
     'CV',
     'sample-cv.pdf',
     'ab0fdaa9227be587287f3b3880eed317d795fd8727f3bc55fa6f949d8c54c2f2.pdf',
     'application/pdf',
     3306,
     '11111111-0000-0000-0000-000000000007',
     NULL,
     '00000000-0000-0000-0000-300000020007',
     NOW(),
     NOW());
