import { Provider } from '@angular/core';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { ReferenceLetterUploadResourceApi } from 'app/generated/api/reference-letter-upload-resource-api';
import { ReferenceLetterUploadContextDTO } from 'app/generated/model/reference-letter-upload-context-dto';
import { ReferenceRequestDTO, ReferenceRequestDTOStatusEnum } from 'app/generated/model/reference-request-dto';

export type ReferenceLetterUploadResourceApiMock = {
  getContext: ReturnType<typeof vi.fn>;
  upload: ReturnType<typeof vi.fn>;
  decline: ReturnType<typeof vi.fn>;
};

export const createMockContext = (overrides: Partial<ReferenceLetterUploadContextDTO> = {}): ReferenceLetterUploadContextDTO =>
  Object.assign(
    {
      applicantFirstName: 'Sample',
      applicantLastName: 'Applicant',
      jobTitle: 'PhD Position',
      researchGroupName: 'Research Group A',
      status: ReferenceRequestDTOStatusEnum.Requested,
    },
    overrides,
  );

export function createReferenceLetterUploadResourceApiMock(
  initialContext: ReferenceLetterUploadContextDTO = createMockContext(),
): ReferenceLetterUploadResourceApiMock {
  const submitted: ReferenceRequestDTO = {
    referenceRequestId: 'submitted-id',
    title: 'Prof. Dr.',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    status: ReferenceRequestDTOStatusEnum.Submitted,
    documentId: 'document-id',
  };
  const declined: ReferenceRequestDTO = {
    referenceRequestId: 'declined-id',
    title: 'Prof. Dr.',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    status: ReferenceRequestDTOStatusEnum.Declined,
    documentId: undefined,
  };
  return {
    getContext: vi.fn().mockReturnValue(of(initialContext)),
    upload: vi.fn().mockReturnValue(of(submitted)),
    decline: vi.fn().mockReturnValue(of(declined)),
  };
}

export function provideReferenceLetterUploadResourceApiMock(
  mock: ReferenceLetterUploadResourceApiMock = createReferenceLetterUploadResourceApiMock(),
): Provider {
  return { provide: ReferenceLetterUploadResourceApi, useValue: mock };
}
