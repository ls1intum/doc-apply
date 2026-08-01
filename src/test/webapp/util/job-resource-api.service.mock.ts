import { JobResourceApi } from 'app/generated/api/job-resource-api';
import { Provider } from '@angular/core';
import { vi } from 'vitest';

export type JobResourceApiMock = {
  getJobDetails: ReturnType<typeof vi.fn>;
  getAvailableJobs: ReturnType<typeof vi.fn>;
  getJobsForCurrentResearchGroup: ReturnType<typeof vi.fn>;
  getAllJobs: ReturnType<typeof vi.fn>;
  getJobById: ReturnType<typeof vi.fn>;
  createJob: ReturnType<typeof vi.fn>;
  updateJob: ReturnType<typeof vi.fn>;
  deleteJob: ReturnType<typeof vi.fn>;
  changeJobState: ReturnType<typeof vi.fn>;
};

export function createJobResourceApiMock(): JobResourceApiMock {
  return {
    getJobDetails: vi.fn(),
    getAvailableJobs: vi.fn(),
    getJobsForCurrentResearchGroup: vi.fn(),
    getAllJobs: vi.fn(),
    getJobById: vi.fn(),
    createJob: vi.fn(),
    updateJob: vi.fn(),
    deleteJob: vi.fn(),
    changeJobState: vi.fn(),
  };
}

export function provideJobResourceApiMock(mock: JobResourceApiMock = createJobResourceApiMock()): Provider {
  return { provide: JobResourceApi, useValue: mock };
}
