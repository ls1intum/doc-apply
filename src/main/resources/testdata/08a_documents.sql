-- =============================================
-- 08a_documents.sql
-- Inserts example documents and links them to applicants and applications.
--
-- Schema (single STI table `documents`, see changeset 36):
--   - doc_owner_type = 'APPLICANT'   -> applicant_id IS NOT NULL, application_id IS NULL
--   - doc_owner_type = 'APPLICATION' -> application_id IS NOT NULL, applicant_id IS NULL
--
-- Storage:
--   import-testdata.sh copies the PDFs in documents/ into the configured storage root.
--   Uploaded files are stored as "{aet.storage.root}/{sha256}.{ext}", but any single
--   filename works: DocumentService.resolveStoredPath resolves a path without a leading
--   directory against the storage root, so the rows reference the PDFs by their own names.
--
-- Preconditions:
--   - applicants and applications must exist (06_applicants.sql, 07_applications.sql)
--   - users must exist (01_users.sql)
-- =============================================

-- Clean existing test documents
DELETE FROM documents WHERE document_id::text LIKE '00000000-0000-0000-0000-40000000%';

-- Insert test documents
INSERT INTO documents (
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
     'CV_Max_Hartmann.pdf',
     'cv-max-hartmann.pdf',
     'application/pdf',
     59659,
     '00000000-0000-0000-0000-000000000103',
     '00000000-0000-0000-0000-000000000103',
     NULL,
     NOW(),
     NOW()),

    ('00000000-0000-0000-0000-400000020002',
     'APPLICANT',
     'BACHELOR_TRANSCRIPT',
     'Transcript_BSc_Psychology_LMU.pdf',
     'bachelor-transcript-max-hartmann.pdf',
     'application/pdf',
     63034,
     '00000000-0000-0000-0000-000000000103',
     '00000000-0000-0000-0000-000000000103',
     NULL,
     NOW(),
     NOW()),

    ('00000000-0000-0000-0000-400000020003',
     'APPLICANT',
     'MASTER_TRANSCRIPT',
     'Transcript_MSc_Data_Science_TUM.pdf',
     'master-transcript-max-hartmann.pdf',
     'application/pdf',
     59213,
     '00000000-0000-0000-0000-000000000103',
     '00000000-0000-0000-0000-000000000103',
     NULL,
     NOW(),
     NOW()),

    -- Application snapshot documents (Max Hartmann - Doctoral Researcher in Time Series Forecasting, SAVED)
    ('00000000-0000-0000-0000-400000010001',
     'APPLICATION',
     'CV',
     'CV_Max_Hartmann.pdf',
     'cv-max-hartmann.pdf',
     'application/pdf',
     59659,
     '00000000-0000-0000-0000-000000000103',
     NULL,
     '00000000-0000-0000-0000-300000020313',
     NOW(),
     NOW()),

    ('00000000-0000-0000-0000-400000010002',
     'APPLICATION',
     'BACHELOR_TRANSCRIPT',
     'Transcript_BSc_Psychology_LMU.pdf',
     'bachelor-transcript-max-hartmann.pdf',
     'application/pdf',
     63034,
     '00000000-0000-0000-0000-000000000103',
     NULL,
     '00000000-0000-0000-0000-300000020313',
     NOW(),
     NOW()),

    -- Application snapshot documents (Max Hartmann - ACCEPTED)
    ('00000000-0000-0000-0000-400000010003',
     'APPLICATION',
     'CV',
     'CV_Max_Hartmann.pdf',
     'cv-max-hartmann.pdf',
     'application/pdf',
     59659,
     '00000000-0000-0000-0000-000000000103',
     NULL,
     '00000000-0000-0000-0000-300000020003',
     NOW(),
     NOW()),

    ('00000000-0000-0000-0000-400000010004',
     'APPLICATION',
     'MASTER_TRANSCRIPT',
     'Transcript_MSc_Data_Science_TUM.pdf',
     'master-transcript-max-hartmann.pdf',
     'application/pdf',
     59213,
     '00000000-0000-0000-0000-000000000103',
     NULL,
     '00000000-0000-0000-0000-300000020003',
     NOW(),
     NOW()),

    -- Application snapshot documents (Max Hartmann - INTERVIEW)
    ('00000000-0000-0000-0000-400000010005',
     'APPLICATION',
     'CV',
     'CV_Max_Hartmann.pdf',
     'cv-max-hartmann.pdf',
     'application/pdf',
     59659,
     '00000000-0000-0000-0000-000000000103',
     NULL,
     '00000000-0000-0000-0000-300000020002',
     NOW(),
     NOW()),

    ('00000000-0000-0000-0000-400000010006',
     'APPLICATION',
     'REFERENCE',
     'Recommendation_Prof_Meier.pdf',
     'reference-max-hartmann.pdf',
     'application/pdf',
     32412,
     '00000000-0000-0000-0000-000000000103',
     NULL,
     '00000000-0000-0000-0000-300000020002',
     NOW(),
     NOW()),

    -- Application snapshot documents (Sophie Lee - SENT)
    ('00000000-0000-0000-0000-400000010007',
     'APPLICATION',
     'CV',
     'Sophie_Lee_CV.pdf',
     'cv-sophie-lee.pdf',
     'application/pdf',
     54453,
     '11111111-0000-0000-0000-000000000011',
     NULL,
     '00000000-0000-0000-0000-300000020010',
     NOW(),
     NOW()),

    -- Application snapshot documents (Noor Ahmed - IN_REVIEW)
    ('00000000-0000-0000-0000-400000010008',
     'APPLICATION',
     'CV',
     'CV_Noor_Ahmed.pdf',
     'cv-noor-ahmed.pdf',
     'application/pdf',
     56657,
     '11111111-0000-0000-0000-000000000007',
     NULL,
     '00000000-0000-0000-0000-300000020007',
     NOW(),
     NOW());
