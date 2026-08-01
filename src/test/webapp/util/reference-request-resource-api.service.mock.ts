import { Provider } from '@angular/core';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { ReferenceRequestResourceApi } from 'app/generated/api/reference-request-resource-api';
import { ReferenceRequestDTO, ReferenceRequestDTOStatusEnum } from 'app/generated/model/reference-request-dto';

export type ReferenceRequestResourceApiMock = {
  getReferences: ReturnType<typeof vi.fn>;
  add: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

export const createMockReferenceRequestDTO = (overrides: Partial<ReferenceRequestDTO> = {}): ReferenceRequestDTO => {
  return Object.assign(
    {
      referenceRequestId: '00000000-0000-0000-0000-000000000001',
      title: 'Prof. Dr.',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      status: ReferenceRequestDTOStatusEnum.Requested,
    },
    overrides,
  );
};

export function createReferenceRequestResourceApiMock(initial: ReferenceRequestDTO[] = []): ReferenceRequestResourceApiMock {
  return {
    getReferences: vi.fn().mockReturnValue(of(initial)),
    add: vi.fn().mockImplementation((_id: string, body: { email: string; firstName: string; lastName: string; title?: string }) =>
      of(
        createMockReferenceRequestDTO({
          referenceRequestId: `generated-${Math.random().toString(36).slice(2, 8)}`,
          title: body.title ?? undefined,
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email,
        }),
      ),
    ),
    update: vi
      .fn()
      .mockImplementation(
        (_id: string, referenceId: string, body: { email: string; firstName: string; lastName: string; title?: string }) =>
          of(
            createMockReferenceRequestDTO({
              referenceRequestId: referenceId,
              title: body.title ?? undefined,
              firstName: body.firstName,
              lastName: body.lastName,
              email: body.email,
            }),
          ),
      ),
    remove: vi.fn().mockReturnValue(of(void 0)),
  };
}

export function provideReferenceRequestResourceApiMock(
  mock: ReferenceRequestResourceApiMock = createReferenceRequestResourceApiMock(),
): Provider {
  return { provide: ReferenceRequestResourceApi, useValue: mock };
}
