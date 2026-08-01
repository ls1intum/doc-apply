import { ResearchGroupResourceApi } from 'app/generated/api/research-group-resource-api';
import { Provider } from '@angular/core';
import { vi, Mock } from 'vitest';

export interface ResearchGroupResourceApiMock {
  activateResearchGroup: Mock;
  createEmployeeResearchGroupRequest: Mock;
  createProfessorResearchGroupRequest: Mock;
  createResearchGroupAsAdmin: Mock;
  denyResearchGroup: Mock;
  getAllProfessorsForAdmin: Mock;
  getAllResearchGroups: Mock;
  getDraftResearchGroups: Mock;
  getResearchGroup: Mock;
  getResearchGroupMembers: Mock;
  getResearchGroupMembersById: Mock;
  getResearchGroupProfessors: Mock;
  getResearchGroupsForAdmin: Mock;
  getResourceGroupDetails: Mock;
  removeMemberFromResearchGroup: Mock;
  updateResearchGroup: Mock;
  withdrawResearchGroup: Mock;
}

export function createResearchGroupResourceApiMock(): ResearchGroupResourceApiMock {
  return {
    activateResearchGroup: vi.fn(),
    createEmployeeResearchGroupRequest: vi.fn(),
    createProfessorResearchGroupRequest: vi.fn(),
    createResearchGroupAsAdmin: vi.fn(),
    denyResearchGroup: vi.fn(),
    getAllProfessorsForAdmin: vi.fn(),
    getAllResearchGroups: vi.fn(),
    getDraftResearchGroups: vi.fn(),
    getResearchGroup: vi.fn(),
    getResearchGroupMembers: vi.fn(),
    getResearchGroupMembersById: vi.fn(),
    getResearchGroupProfessors: vi.fn(),
    getResearchGroupsForAdmin: vi.fn(),
    getResourceGroupDetails: vi.fn(),
    removeMemberFromResearchGroup: vi.fn(),
    updateResearchGroup: vi.fn(),
    withdrawResearchGroup: vi.fn(),
  };
}

export function provideResearchGroupResourceApiMock(mock: ResearchGroupResourceApiMock = createResearchGroupResourceApiMock()): Provider {
  return { provide: ResearchGroupResourceApi, useValue: mock };
}
