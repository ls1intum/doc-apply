import { ApplicationResourceApi } from 'app/generated/api/application-resource-api';
import { Provider } from '@angular/core';
import { vi } from 'vitest';
import {
  ApplicationForApplicantDTO,
  ApplicationForApplicantDTOApplicationStateEnum,
} from 'app/generated/model/application-for-applicant-dto';
import { of } from 'rxjs';
import { ApplicationOverviewDTO, ApplicationOverviewDTOApplicationStateEnum } from 'app/generated/model/application-overview-dto';
import { JobFormDTOLocationEnum, JobFormDTOSubjectAreaEnum } from 'app/generated/model/job-form-dto';

export type ApplicationResourceApiMock = {
  createApplication: ReturnType<typeof vi.fn>;
  getApplicationById: ReturnType<typeof vi.fn>;
  getApplicationForDetailPage: ReturnType<typeof vi.fn>;
  updateApplication: ReturnType<typeof vi.fn>;
  withdrawApplication: ReturnType<typeof vi.fn>;
  getDocumentIds: ReturnType<typeof vi.fn>;
  deleteApplication: ReturnType<typeof vi.fn>;
  getAllApplications: ReturnType<typeof vi.fn>;
  getApplicationPages: ReturnType<typeof vi.fn>;
  renameDocument: ReturnType<typeof vi.fn>;
  uploadDocuments: ReturnType<typeof vi.fn>;
  deleteDocumentFromApplication: ReturnType<typeof vi.fn>;
};

export const createMockApplicationDTO = (applicationState: ApplicationForApplicantDTOApplicationStateEnum): ApplicationForApplicantDTO => ({
  applicationState: applicationState,
  applicationId: '456',
  job: {
    jobId: '123',
    location: JobFormDTOLocationEnum.Garching,
    professorName: 'Prof. Dr. Abc',
    subjectArea: JobFormDTOSubjectAreaEnum.ComputerScience,
    title: 'Sophisticated Studies',
  },
  applicant: {
    user: {
      firstName: 'Testus Maxima',
      email: 'test@gmail.com',
    },
  },
});

const createMockApplicationOverview = (overrides?: Partial<ApplicationOverviewDTO>): ApplicationOverviewDTO =>
  Object.assign(
    {
      applicationId: '123',
      jobTitle: 'Software Engineer',
      researchGroup: 'Research Group A',
      applicationState: ApplicationOverviewDTOApplicationStateEnum.Sent,
      createdAt: '2025-01-01T12:00:00Z',
    },
    overrides ?? {},
  );

export const createMockApplicationOverviewPages = () => [
  createMockApplicationOverview({ applicationId: '1' }),
  createMockApplicationOverview({ applicationId: '2' }),
];

export function createApplicationResourceApiMock(): ApplicationResourceApiMock {
  const mockApplicationOverviewPages = createMockApplicationOverviewPages();
  return {
    createApplication: vi.fn().mockReturnValue(of(createMockApplicationDTO(ApplicationForApplicantDTOApplicationStateEnum.Saved))),
    getApplicationById: vi.fn().mockReturnValue(of(createMockApplicationDTO(ApplicationForApplicantDTOApplicationStateEnum.Saved))),
    getApplicationForDetailPage: vi.fn().mockReturnValue(of({})),
    updateApplication: vi.fn().mockReturnValue(of({})),
    withdrawApplication: vi.fn().mockReturnValue(of({})),
    getDocumentIds: vi.fn().mockReturnValue(of({})),
    deleteApplication: vi.fn().mockReturnValue(of(void 0)),
    getAllApplications: vi.fn().mockReturnValue(of({ content: [], totalElements: 0 })),
    getApplicationPages: vi.fn().mockReturnValue(of({ content: mockApplicationOverviewPages, totalElements: 2 })),
    uploadDocuments: vi.fn().mockReturnValue(of([{ id: '1', name: 'Doc1', size: 1234 }])),
    deleteDocumentFromApplication: vi.fn().mockReturnValue(of(void 0)),
    renameDocument: vi.fn().mockReturnValue(of(void 0)),
  };
}

export function provideApplicationResourceApiMock(mock: ApplicationResourceApiMock = createApplicationResourceApiMock()): Provider {
  return { provide: ApplicationResourceApi, useValue: mock };
}
