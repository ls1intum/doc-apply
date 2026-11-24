import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { convertToParamMap, Params, Router } from '@angular/router';

import { ApplicationOverviewComponent } from 'app/evaluation/application-overview/application-overview.component';
import { ApplicationEvaluationResourceApi } from 'app/generated/api/application-evaluation-resource-api';
import { ApplicationEvaluationOverviewDTO } from 'app/generated/model/application-evaluation-overview-dto';
import { ApplicationEvaluationOverviewListDTO } from 'app/generated/model/application-evaluation-overview-list-dto';
import { ApplicationDetailDTOApplicationStateEnum } from 'app/generated/model/application-detail-dto';
import { provideTranslateMock } from 'util/translate.mock';
import { availableStatusOptions, sortableFields } from 'app/evaluation/filterSortOptions';
import { provideFontAwesomeTesting } from '../../../util/fontawesome.testing';
import { provideToastServiceMock } from '../../../util/toast-service.mock';
import { provideRouterMock } from '../../../util/router.mock';
import { createActivatedRouteMock, provideActivatedRouteMock } from '../../../util/activated-route.mock';

type GetOverviewsArgs = Parameters<ApplicationEvaluationResourceApi['getApplicationsOverviews']>;

function makeOverview(id: string, partial?: Partial<ApplicationEvaluationOverviewDTO>): ApplicationEvaluationOverviewDTO {
  return Object.assign(
    {
      applicationId: id,
      name: `Name ${id}`,
      jobName: `Job ${id}`,
      state: ApplicationDetailDTOApplicationStateEnum.Sent,
      appliedAt: '2025-10-01T00:00:00Z',
      createdAt: '2025-10-01T00:00:00Z',
    },
    partial ?? {},
  ) as ApplicationEvaluationOverviewDTO;
}

describe('ApplicationOverviewComponent', () => {
  let fixture: ComponentFixture<ApplicationOverviewComponent>;
  let component: ApplicationOverviewComponent;
  let router: Router;

  let api: {
    getAllJobNames: ReturnType<typeof vi.fn>;
    getApplicationsOverviews: ReturnType<typeof vi.fn>;
  };

  let q$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const lastGetArgs = (): GetOverviewsArgs => api.getApplicationsOverviews.mock.calls.at(-1) as GetOverviewsArgs;
  const mockActivatedRoute = createActivatedRouteMock({}, {});

  beforeEach(async () => {
    vi.useFakeTimers();

    api = {
      getAllJobNames: vi.fn().mockReturnValue(of(['B', 'A'])),
      getApplicationsOverviews: vi.fn().mockReturnValue(of({ applications: [makeOverview('1')], totalRecords: 1 })),
    };

    await TestBed.configureTestingModule({
      imports: [ApplicationOverviewComponent],
      providers: [
        provideRouterMock(),
        { provide: ApplicationEvaluationResourceApi, useValue: api },
        provideActivatedRouteMock(mockActivatedRoute),
        provideFontAwesomeTesting(),
        provideTranslateMock(),
        provideToastServiceMock(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApplicationOverviewComponent);
    component = fixture.componentInstance;

    router = TestBed.inject(Router);

    fixture.detectChanges();
    await fixture.whenStable();
    vi.runOnlyPendingTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    fixture?.destroy();
  });

  it('should initialize with sorted job names and first page loaded', async () => {
    expect(api.getAllJobNames).toHaveBeenCalledOnce();
    expect(api.getApplicationsOverviews).toHaveBeenCalledOnce();

    vi.runOnlyPendingTimers();
    expect(component.allAvailableJobNames()).toEqual(['A', 'B']);
    expect(component.pageData().length).toBe(1);
    expect(component.total()).toBe(1);
  });

  it('should expose state severity mapping', () => {
    const map = component.stateSeverityMap();
    expect(map.SENT).toBe('info');
    expect(map.ACCEPTED).toBe('success');
    expect(map.REJECTED).toBe('danger');
    expect(map.IN_REVIEW).toBe('warn');
  });

  // ---------------- FILTERS ----------------
  describe('Filters', () => {
    it('should apply and clear job & status filters and map labels to keys (unknown kept as-is)', async () => {
      api.getApplicationsOverviews.mockClear();

      component.loadOnFilterEmit({ filterId: 'jobTitle', selectedValues: ['AI Group', 'HCI Lab'] });
      vi.runOnlyPendingTimers();
      await fixture.whenStable();
      expect(lastGetArgs()[5]).toEqual(['AI Group', 'HCI Lab']);

      const known = availableStatusOptions[0];
      const unknown = 'status.unknown.label';
      component.loadOnFilterEmit({ filterId: 'status', selectedValues: [known.label, unknown] });
      vi.runOnlyPendingTimers();
      await fixture.whenStable();
      const [, , , , statusFilters] = lastGetArgs();
      expect(statusFilters).toContain(known.key);
      expect(statusFilters).toContain(unknown);

      component.selectedJobFilters.set(['AI Group']);
      component.loadOnFilterEmit({ filterId: 'jobTitle', selectedValues: [] });
      vi.runOnlyPendingTimers();
      await fixture.whenStable();
      expect(component.selectedJobFilters()).toEqual([]);
      expect(lastGetArgs()[5]).toBeUndefined();
    });
  });

  // ---------------- SEARCH ----------------
  describe('Search', () => {
    it('should include search in URL only when non-empty', async () => {
      vi.mocked(router.navigate).mockClear();
      api.getApplicationsOverviews.mockClear();

      component.loadOnSearchEmit('');
      vi.runOnlyPendingTimers();
      await fixture.whenStable();
      let nav = vi.mocked(router.navigate).mock.calls.at(-1) as unknown as [unknown[], { queryParams: Params; replaceUrl: boolean }];
      expect(nav[1].queryParams.search).toBeUndefined();

      vi.mocked(router.navigate).mockClear();
      component.loadOnSearchEmit('abc');
      vi.runOnlyPendingTimers();
      await fixture.whenStable();
      nav = vi.mocked(router.navigate).mock.calls.at(-1) as unknown as [unknown[], { queryParams: Params; replaceUrl: boolean }];
      expect(nav[1].queryParams.search).toBe('abc');
    });
  });

  // ---------------- SORTING & QUERY PARAMS ----------------
  describe('Sorting & Query Params', () => {
    it('should keep user-initiated sort over query params and react to valid/invalid query params otherwise', async () => {
      api.getApplicationsOverviews.mockClear();

      component.loadOnSortEmit({ field: 'name', direction: 'ASC' });
      mockActivatedRoute.setQueryParams({ sortBy: 'createdAt', sortDir: 'DESC' });
      vi.runOnlyPendingTimers();
      await fixture.whenStable();
      expect(component.sortBy()).toBe('name');
      expect(component.sortDirection()).toBe('ASC');

      mockActivatedRoute.setQueryParams({ sortBy: 'createdAt', sortDir: 'DESC' });
      vi.runOnlyPendingTimers();
      await fixture.whenStable();
      expect(component.page()).toBe(0);
      expect(component.pageSize()).toBe(10);
      expect(component.sortDirection()).toBe('DESC');

      mockActivatedRoute.setQueryParams({
        page: '2',
        pageSize: '25',
        sortBy: sortableFields[0].fieldName,
        sortDir: 'ASC',
        search: 'ml',
      });
      vi.runOnlyPendingTimers();
      await fixture.whenStable();
      expect(component.page()).toBe(2);
      expect(component.pageSize()).toBe(25);
      expect(component.sortBy()).toBe(sortableFields[0].fieldName);
      expect(component.sortDirection()).toBe<'ASC' | 'DESC'>('ASC');
      expect(component.searchQuery()).toBe('ml');
    });
  });

  // ---------------- NAVIGATION ----------------
  describe('Navigation', () => {
    it('should navigate to detail with current sort params and applicationId', async () => {
      vi.mocked(router.navigate).mockClear();
      component.sortBy.set('name');
      component.sortDirection.set('DESC');

      const app = makeOverview('abc');
      component.navigateToDetail(app);

      const call = vi.mocked(router.navigate).mock.calls.at(-1) as unknown as [string[], { queryParams: Params }];
      expect(call[0]).toEqual(['/evaluation/application']);
      expect(call[1].queryParams.applicationId).toBe('abc');
      expect(call[1].queryParams.sortBy).toBe('name');
      expect(call[1].queryParams.sortDir).toBe('DESC');
    });
  });

  // ---------------- SERVICE CALL ARGUMENT ----------------
  describe('Service Call Arguments', () => {
    it('should pass undefined for filters when none are selected', async () => {
      mockActivatedRoute.setQueryParams({});
      vi.runOnlyPendingTimers();
      await fixture.whenStable();

      api.getApplicationsOverviews.mockClear();

      component.selectedStatusFilters.set([]);
      component.selectedJobFilters.set([]);

      await component.loadPage();
      vi.runOnlyPendingTimers();

      const args = lastGetArgs();
      expect(args[4]).toBeUndefined();
      expect(args[5]).toBeUndefined();
      expect(args[6]).toBeUndefined();
    });
  });

  // ---------------- API RESULT NORMALIZATION ----------------
  describe('API Result Normalization', () => {
    it('should normalize missing properties from API responses', async () => {
      api.getApplicationsOverviews
        .mockReturnValueOnce(of({} as unknown as ApplicationEvaluationOverviewListDTO))
        .mockReturnValueOnce(of({ applications: undefined, totalRecords: 7 } as unknown as ApplicationEvaluationOverviewListDTO));

      await component.loadPage();
      await vi.runAllTimersAsync();
      expect(component.pageData()).toEqual([]);
      expect(component.total()).toBe(0);

      await component.loadPage();
      await vi.runAllTimersAsync();
      expect(component.pageData()).toEqual([]);
      expect(component.total()).toBe(7);
    });
  });

  // ---------------- ERROR HANDLING ----------------
  describe('Error Handling', () => {
    it('should set available job names to [] when loading job names fails', async () => {
      api.getAllJobNames.mockReturnValueOnce(throwError(() => new Error('fail')));
      await component.loadAllJobNames();
      expect(component.allAvailableJobNames()).toEqual([]);
    });

    it('should log error to console when loadPage fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      api.getApplicationsOverviews.mockReturnValueOnce(throwError(() => new Error('API failure')));

      await component.loadPage();

      expect(consoleSpy).toHaveBeenCalledWith('Failed to load applications:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });
});
