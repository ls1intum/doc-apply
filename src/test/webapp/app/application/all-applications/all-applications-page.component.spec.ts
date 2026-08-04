import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { provideRouter, Router } from '@angular/router';

import { AllApplicationsPageComponent } from 'app/application/all-applications/all-applications-page.component';
import { AdminApplicationOverviewDTOStateEnum } from 'app/generated/model/admin-application-overview-dto';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';
import {
  ApplicationResourceApiMock,
  createApplicationResourceApiMock,
  provideApplicationResourceApiMock,
} from 'util/application-resource-api.service.mock';
import { createToastServiceMock, provideToastServiceMock, ToastServiceMock } from 'util/toast-service.mock';
import {
  createResearchGroupResourceApiMock,
  provideResearchGroupResourceApiMock,
  ResearchGroupResourceApiMock,
} from 'util/research-group-resource-api.service.mock';

describe('AllApplicationsPageComponent', () => {
  let fixture: ComponentFixture<AllApplicationsPageComponent>;
  let comp: AllApplicationsPageComponent;
  let applicationApi: ApplicationResourceApiMock;
  let researchGroupApi: ResearchGroupResourceApiMock;
  let toastService: ToastServiceMock;
  let router: Router;

  beforeEach(async () => {
    applicationApi = createApplicationResourceApiMock();
    applicationApi.getAllApplications.mockReturnValue(
      of({
        content: [
          {
            applicationId: '1',
            applicantUserId: 'a1',
            applicantName: 'Alice Apple',
            jobId: 'j1',
            jobTitle: 'Job A',
            researchGroupId: 'r1',
            researchGroupName: 'RG 1',
            supervisingProfessorId: 'p1',
            supervisingProfessorName: 'Prof One',
            state: AdminApplicationOverviewDTOStateEnum.Saved,
            createdAt: '2026-04-01T10:00:00Z',
          },
        ],
        totalElements: 1,
      }),
    );

    researchGroupApi = createResearchGroupResourceApiMock();
    researchGroupApi.getResearchGroupsForAdmin.mockReturnValue(of({ content: [{ id: 'r1', researchGroup: 'RG 1' }], totalElements: 1 }));
    researchGroupApi.getAllProfessorsForAdmin.mockReturnValue(of([{ userId: 'p1', firstName: 'Prof', lastName: 'One' }]));

    toastService = createToastServiceMock();

    await TestBed.configureTestingModule({
      imports: [AllApplicationsPageComponent],
      providers: [
        provideApplicationResourceApiMock(applicationApi),
        provideResearchGroupResourceApiMock(researchGroupApi),
        provideToastServiceMock(toastService),
        provideRouter([]),
        provideTranslateMock(),
        provideFontAwesomeTesting(),
      ],
    }).compileComponents();

    router = TestBed.inject(Router);

    fixture = TestBed.createComponent(AllApplicationsPageComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should load research-group and professor options on init', async () => {
      await fixture.whenStable();
      expect(researchGroupApi.getResearchGroupsForAdmin).toHaveBeenCalledOnce();
      expect(researchGroupApi.getAllProfessorsForAdmin).toHaveBeenCalledOnce();
      expect(comp.researchGroupOptions()).toEqual([{ id: 'r1', name: 'RG 1' }]);
      expect(comp.professorOptions()).toEqual([{ id: 'p1', name: 'Prof One' }]);
    });
  });

  describe('lazy load', () => {
    it('should call getAllApplications when the table emits a lazy load', async () => {
      applicationApi.getAllApplications.mockClear();
      applicationApi.getAllApplications.mockReturnValue(of({ content: [], totalElements: 0 }));

      comp.loadOnTableEmit({ first: 0, rows: 10 });
      await fixture.whenStable();

      expect(applicationApi.getAllApplications).toHaveBeenCalledOnce();
      expect(comp.pageSize()).toBe(10);
      expect(comp.page()).toBe(0);
    });

    it('should derive the page index from first and rows', async () => {
      applicationApi.getAllApplications.mockReturnValue(of({ content: [], totalElements: 0 }));

      comp.loadOnTableEmit({ first: 20, rows: 10 });
      await fixture.whenStable();

      expect(comp.page()).toBe(2);
      expect(comp.pageSize()).toBe(10);
    });
  });

  describe('filters', () => {
    it('should map the status translation key to the admin enum value', async () => {
      applicationApi.getAllApplications.mockReturnValue(of({ content: [], totalElements: 0 }));

      comp.onFilterEmit({ filterId: 'status', selectedValues: ['applicationState.saved'] });
      await fixture.whenStable();

      expect(comp.selectedStatusFilters()).toEqual([AdminApplicationOverviewDTOStateEnum.Saved]);
    });

    it('should map research-group names to ids', async () => {
      await fixture.whenStable();
      applicationApi.getAllApplications.mockReturnValue(of({ content: [], totalElements: 0 }));

      comp.onFilterEmit({ filterId: 'researchGroup', selectedValues: ['RG 1'] });

      expect(comp.selectedResearchGroupIds()).toEqual(['r1']);
    });

    it('should map professor names to ids', async () => {
      await fixture.whenStable();
      applicationApi.getAllApplications.mockReturnValue(of({ content: [], totalElements: 0 }));

      comp.onFilterEmit({ filterId: 'professor', selectedValues: ['Prof One'] });

      expect(comp.selectedProfessorIds()).toEqual(['p1']);
    });
  });

  describe('search', () => {
    it('should reset to the first page and reload when the query changes', async () => {
      applicationApi.getAllApplications.mockClear();
      applicationApi.getAllApplications.mockReturnValue(of({ content: [], totalElements: 0 }));
      comp.page.set(3);

      comp.onSearchEmit('alice');
      await fixture.whenStable();

      expect(comp.page()).toBe(0);
      expect(comp.searchQuery()).toBe('alice');
      expect(applicationApi.getAllApplications).toHaveBeenCalledOnce();
    });

    it('should not reload when the normalized query is unchanged', () => {
      comp.searchQuery.set('alice');
      applicationApi.getAllApplications.mockClear();

      comp.onSearchEmit('  alice  ');

      expect(applicationApi.getAllApplications).not.toHaveBeenCalled();
    });
  });

  describe('sort', () => {
    it('should update sort signals and reload', async () => {
      applicationApi.getAllApplications.mockClear();
      applicationApi.getAllApplications.mockReturnValue(of({ content: [], totalElements: 0 }));

      comp.loadOnSortEmit({ field: 'createdAt', direction: 'ASC' });
      await fixture.whenStable();

      expect(comp.sortBy()).toBe('createdAt');
      expect(comp.sortDirection()).toBe('ASC');
      expect(comp.page()).toBe(0);
      expect(applicationApi.getAllApplications).toHaveBeenCalledOnce();
    });
  });

  describe('actions', () => {
    it('should navigate to the detail page on view', () => {
      const navigateSpy = vi.spyOn(router, 'navigate');
      comp.onViewApplication('1');
      expect(navigateSpy).toHaveBeenCalledExactlyOnceWith(['/application/detail/1']);
    });

    it('should navigate to the application form with a query param on edit', () => {
      const navigateSpy = vi.spyOn(router, 'navigate');
      comp.onEditApplication('1');
      expect(navigateSpy).toHaveBeenCalledExactlyOnceWith(['/application/form'], { queryParams: { application: '1' } });
    });

    it('should call deleteApplication when the delete dialog is confirmed', async () => {
      comp.currentApplicationId.set('1');
      applicationApi.deleteApplication.mockReturnValue(of({}));

      await comp.onConfirmDelete();

      expect(applicationApi.deleteApplication).toHaveBeenCalledExactlyOnceWith('1');
      expect(toastService.showSuccessKey).toHaveBeenCalledOnce();
    });

    it('should not call deleteApplication when no current application id is set', async () => {
      comp.currentApplicationId.set(undefined);

      await comp.onConfirmDelete();

      expect(applicationApi.deleteApplication).not.toHaveBeenCalled();
    });

    it('should call withdrawApplication when the withdraw dialog is confirmed', async () => {
      comp.currentApplicationId.set('1');
      applicationApi.withdrawApplication.mockReturnValue(of({}));

      await comp.onConfirmWithdraw();

      expect(applicationApi.withdrawApplication).toHaveBeenCalledExactlyOnceWith('1');
      expect(toastService.showSuccessKey).toHaveBeenCalledOnce();
    });

    it('should not call withdrawApplication when no current application id is set', async () => {
      comp.currentApplicationId.set(undefined);

      await comp.onConfirmWithdraw();

      expect(applicationApi.withdrawApplication).not.toHaveBeenCalled();
    });
  });
});
