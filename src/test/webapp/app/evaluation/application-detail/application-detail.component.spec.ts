import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { convertToParamMap, Router } from '@angular/router';
import { ApplicationDetailComponent } from 'app/evaluation/application-detail/application-detail.component';
import { ApplicationEvaluationResourceApi } from 'app/generated/api/application-evaluation-resource-api';
import { ApplicationResourceApi } from 'app/generated/api/application-resource-api';
import { ApplicationEvaluationDetailDTO } from 'app/generated/model/application-evaluation-detail-dto';
import { ApplicationDetailDTOApplicationStateEnum } from 'app/generated/model/application-detail-dto';
import { ApplicationDocumentIdsDTO } from 'app/generated/model/application-document-ids-dto';
import { RejectDTOReasonEnum } from 'app/generated/model/reject-dto';
import { provideTranslateMock } from 'util/translate.mock';
import { availableStatusOptions } from 'app/evaluation/filterSortOptions';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideToastServiceMock, ToastServiceMock } from '../../../util/toast-service.mock';
import { provideRouterMock } from '../../../util/router.mock';
import { ToastService } from 'app/service/toast-service';
import { createActivatedRouteMock, provideActivatedRouteMock } from '../../../util/activated-route.mock';
import { AccountServiceMock, createAccountServiceMock, provideAccountServiceMock } from '../../../util/account.service.mock';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';

function makeDetailApp(id: string, state: string = ApplicationDetailDTOApplicationStateEnum.Sent): ApplicationEvaluationDetailDTO {
  return {
    jobId: 'job-1',
    applicationDetailDTO: {
      applicationId: id,
      jobId: 'job-1',
      supervisingProfessorName: 'Prof. Test',
      researchGroup: 'AI Lab',
      applicationState: state as ApplicationDetailDTOApplicationStateEnum,
    },
  } as ApplicationEvaluationDetailDTO;
}

function makeDocumentIds(): ApplicationDocumentIdsDTO {
  return {
    cvDocumentId: { id: 'cv-1', size: 123456, name: 'CV.pdf' },
  };
}

describe('ApplicationDetailComponent', () => {
  let fixture: ComponentFixture<ApplicationDetailComponent>;
  let component: ApplicationDetailComponent;

  let evaluationApi: Record<string, ReturnType<typeof vi.fn>>;
  let applicationApi: Record<string, ReturnType<typeof vi.fn>>;
  let router: Router;
  let toastService: ToastServiceMock;
  let q$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let accountService: AccountServiceMock;

  beforeEach(async () => {
    vi.useFakeTimers();

    evaluationApi = {
      getAllJobNames: vi.fn().mockReturnValue(of(['Job B', 'Job A'])),
      getApplicationsDetails: vi.fn().mockReturnValue(of({ applications: [makeDetailApp('1')], totalRecords: 10 })),
      getApplicationsDetailsWindow: vi.fn().mockReturnValue(of({ applications: [makeDetailApp('1')], totalRecords: 10 })),
      acceptApplication: vi.fn().mockReturnValue(of({})),
      rejectApplication: vi.fn().mockReturnValue(of({})),
      markApplicationAsInReview: vi.fn().mockReturnValue(of({})),
    };

    applicationApi = {
      getDocumentIds: vi.fn().mockReturnValue(of(makeDocumentIds())),
    };

    accountService = createAccountServiceMock();
    accountService.setAuthorities([UserShortDTORolesEnum.Professor]);

    const mockActivatedRoute = createActivatedRouteMock({}, {});
    q$ = mockActivatedRoute.queryParamMapSubject;

    await TestBed.configureTestingModule({
      imports: [ApplicationDetailComponent],
      providers: [
        provideRouterMock(),
        { provide: ApplicationEvaluationResourceApi, useValue: evaluationApi },
        { provide: ApplicationResourceApi, useValue: applicationApi },
        provideActivatedRouteMock(mockActivatedRoute),
        provideFontAwesomeTesting(),
        provideTranslateMock(),
        provideToastServiceMock(),
        provideAccountServiceMock(accountService),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApplicationDetailComponent);
    component = fixture.componentInstance;
    toastService = TestBed.inject(ToastService) as ToastServiceMock;
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

  describe('Filter / Search / Sort', () => {
    it.each([
      {
        name: 'search change',
        call: () => component.onSearchEmit('test'),
        assert: () => expect(component.searchQuery()).toBe('test'),
      },
      {
        name: 'job filter change',
        call: () => component.onFilterEmit({ filterId: 'jobTitle', selectedValues: ['Job A'] }),
        assert: () => expect(component.selectedJobFilters()).toEqual(['Job A']),
      },
      {
        name: 'status filter change',
        call: () => component.onFilterEmit({ filterId: 'status', selectedValues: [availableStatusOptions[0].label] }),
        assert: () => expect(component.selectedStatusFilters()).toContain(availableStatusOptions[0].key),
      },
    ])('should trigger loadInitialPage on $name', async ({ call, assert }) => {
      const spy = vi
        .spyOn(component as unknown as { loadInitialPage: () => Promise<void> }, 'loadInitialPage')
        .mockResolvedValue(undefined);
      call();
      assert();
      expect(spy).toHaveBeenCalledOnce();
    });

    it('should handle sort change correctly', async () => {
      const spy = vi
        .spyOn(component as unknown as { loadInitialPage: () => Promise<void> }, 'loadInitialPage')
        .mockResolvedValue(undefined);
      component.loadOnSortEmit({ field: 'name', direction: 'ASC' });
      expect(component.sortBy()).toBe('name');
      expect(component.sortDirection()).toBe('ASC');
      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe('Accept / Reject', () => {
    it.each([
      {
        name: 'accept application and close dialog',
        seed: () => component.currentApplication.set(makeDetailApp('1')),
        act: () => component.acceptApplication({ closeJob: false }),
        expectState: ApplicationDetailDTOApplicationStateEnum.Accepted,
        apiSpy: () => evaluationApi.acceptApplication,
      },
      {
        name: 'reject application and close dialog',
        seed: () => component.currentApplication.set(makeDetailApp('2')),
        act: () => component.rejectApplication({ reason: RejectDTOReasonEnum.FailedRequirements }),
        expectState: ApplicationDetailDTOApplicationStateEnum.Rejected,
        apiSpy: () => evaluationApi.rejectApplication,
      },
    ])('should $name', async ({ seed, act, expectState, apiSpy }: any) => {
      seed();
      await act();
      expect(component.currentApplication()?.applicationDetailDTO.applicationState).toBe(expectState);
      expect(component.reviewDialogVisible()).toBe(false);
      expect(apiSpy()).toHaveBeenCalledOnce();
    });

    it('should open accept and reject dialogs', () => {
      component.openAcceptDialog();
      expect(component.reviewDialogMode()).toBe('ACCEPT');
      component.openRejectDialog();
      expect(component.reviewDialogMode()).toBe('REJECT');
      expect(component.reviewDialogVisible()).toBe(true);
    });

    it('should disable accept and reject and keep the dialog closed when the user is an employee', () => {
      accountService.setAuthorities([UserShortDTORolesEnum.Employee]);
      component.currentApplication.set(makeDetailApp('1'));
      fixture.detectChanges();

      const decisionButtons = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('jhi-button button')).filter(button =>
        ['evaluation.accept', 'evaluation.reject'].some(key => button.textContent?.includes(key)),
      );
      expect(decisionButtons).toHaveLength(2);
      expect(decisionButtons.every(button => button.getAttribute('aria-disabled') === 'true')).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('evaluation.onlyProfessorsDecide');

      component.openAcceptDialog();
      component.openRejectDialog();
      expect(component.reviewDialogVisible()).toBe(false);
    });

    it('should reject other applications when closing job', async () => {
      component.applications.set([
        makeDetailApp('1', ApplicationDetailDTOApplicationStateEnum.Sent),
        makeDetailApp('2', ApplicationDetailDTOApplicationStateEnum.InReview),
        makeDetailApp('3', ApplicationDetailDTOApplicationStateEnum.Accepted),
        makeDetailApp('4', ApplicationDetailDTOApplicationStateEnum.Rejected),
      ]);
      component.currentApplication.set(component.applications()[0]);
      await component.acceptApplication({ closeJob: true });
      const apps = component.applications();
      expect(apps[1].applicationDetailDTO.applicationState).toBe(ApplicationDetailDTOApplicationStateEnum.Rejected);
      expect(apps[3].applicationDetailDTO.applicationState).toBe(ApplicationDetailDTOApplicationStateEnum.Rejected);
    });
  });

  describe('canReview', () => {
    it.each([
      [ApplicationDetailDTOApplicationStateEnum.Accepted, false],
      [ApplicationDetailDTOApplicationStateEnum.Rejected, false],
      [ApplicationDetailDTOApplicationStateEnum.Sent, true],
      [ApplicationDetailDTOApplicationStateEnum.InReview, true],
    ])('canReview for %s -> %s', (state, expected) => {
      component.currentApplication.set(makeDetailApp('x', state));
      expect(component.canReview()).toBe(expected);
    });
  });

  describe('State Management', () => {
    it('should update currentApplicationState properly', () => {
      const app = makeDetailApp('1', ApplicationDetailDTOApplicationStateEnum.Sent);
      component.applications.set([app]);
      component.currentApplication.set(app);
      component.updateCurrentApplicationState(ApplicationDetailDTOApplicationStateEnum.Accepted);
      expect(component.currentApplication()?.applicationDetailDTO.applicationState).toBe(ApplicationDetailDTOApplicationStateEnum.Accepted);
    });

    it('should log error when currentApplication is undefined', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      component.currentApplication.set(undefined);
      component.updateCurrentApplicationState(ApplicationDetailDTOApplicationStateEnum.Rejected);
      expect(consoleSpy).toHaveBeenCalledWith('Current application is undefined');
      consoleSpy.mockRestore();
    });
  });

  describe('Navigation', () => {
    it('should navigate next and prev correctly', () => {
      component.applications.set([makeDetailApp('1'), makeDetailApp('2'), makeDetailApp('3')]);
      component.totalRecords.set(3);
      component.currentApplication.set(component.applications()[0]);
      component.onNext();
      expect(component.currentIndex()).toBe(1);
      component.onPrev();
      expect(component.currentIndex()).toBe(0);
    });

    it('should not navigate beyond boundaries', () => {
      component.totalRecords.set(1);
      component.currentIndex.set(0);
      component.onPrev();
      component.onNext();
      expect(component.currentIndex()).toBe(0);
    });

    it('should call loadNext when currentIndex + half < totalRecords', () => {
      const spy = vi.spyOn(component as unknown as { loadNext: (i: number) => Promise<void> }, 'loadNext').mockResolvedValue(undefined);

      component.applications.set([makeDetailApp('1'), makeDetailApp('2'), makeDetailApp('3')]);
      component.totalRecords.set(10);
      component.currentIndex.set(0);
      component.carouselIndex.set(0);
      component.currentApplication.set(component.applications()[0]);
      component.onNext();
      expect(spy).toHaveBeenCalledWith(component.currentIndex() + component.half);
    });

    it('should call loadPrev when currentIndex - half >= 0', () => {
      const spy = vi.spyOn(component as unknown as { loadPrev: (i: number) => Promise<void> }, 'loadPrev').mockResolvedValue(undefined);

      component.applications.set(Array.from({ length: 7 }, (_, i) => makeDetailApp(`${i}`)));
      component.totalRecords.set(7);
      component.currentIndex.set(4);
      component.carouselIndex.set(4);
      component.currentApplication.set(component.applications()[4]);
      component.onPrev();
      expect(spy).toHaveBeenCalledWith(component.currentIndex() - component.half);
    });
  });

  describe('Error Handling', () => {
    it('should toast on loadAllJobNames failure', async () => {
      evaluationApi.getAllJobNames.mockReturnValueOnce(throwError(() => new Error('fail')));
      await component.loadAllJobNames();
      expect(toastService.showErrorKey).toHaveBeenCalledWith('evaluation.errors.loadJobNames');
    });

    it('should toast error when loadPage throws', async () => {
      evaluationApi.getApplicationsDetails.mockReturnValueOnce(throwError(() => new Error('fail')));
      const result = await (component as unknown as { loadPage: (p: number, s: number) => Promise<unknown> }).loadPage(0, 1);
      expect(result).toBeUndefined();
      expect(toastService.showErrorKey).toHaveBeenCalledWith('evaluation.errors.loadApplications');
    });
  });

  describe('Window and Page Loading', () => {
    it('should loadCarousel and set state', async () => {
      const mockRes = {
        applications: [makeDetailApp('1'), makeDetailApp('2')],
        totalRecords: 10,
        currentIndex: 1,
        windowIndex: 1,
      };
      evaluationApi.getApplicationsDetailsWindow.mockReturnValue(of(mockRes));

      const testComp = component as unknown as {
        updateDocumentInformation: (appId: string) => void;
        markCurrentApplicationAsInReview: () => Promise<void>;
        loadCarousel: (appId: string) => Promise<void>;
      };

      const updateDocSpy = vi.spyOn(testComp, 'updateDocumentInformation').mockImplementation(() => {});
      const markSpy = vi.spyOn(testComp, 'markCurrentApplicationAsInReview').mockResolvedValue();

      await testComp.loadCarousel('app-1');

      expect(component.totalRecords()).toBe(10);
      expect(component.applications().length).toBe(2);
      expect(component.currentApplication()?.applicationDetailDTO.applicationId).toBe('2');
      expect(updateDocSpy).toHaveBeenCalledWith('2');
      expect(markSpy).toHaveBeenCalledOnce();
    });

    it('should toast error in loadCarousel on failure', async () => {
      evaluationApi.getApplicationsDetailsWindow.mockReturnValueOnce(throwError(() => new Error('fail')));
      await (component as unknown as { loadCarousel: (id: string) => Promise<void> }).loadCarousel('app-1');
      expect(toastService.showErrorKey).toHaveBeenCalledWith('evaluation.errors.loadApplications');
    });

    it('should updateApplications trim front when windowIndex > half', () => {
      component.applications.set(Array.from({ length: 7 }, (_, i) => makeDetailApp(`${i}`)));
      component.carouselIndex.set(5);

      const testComp = component as unknown as {
        updateApplications: () => void;
        updateDocumentInformation: (id: string) => void;
      };

      const updateDocSpy = vi.spyOn(testComp, 'updateDocumentInformation').mockImplementation(() => {});
      testComp.updateApplications();

      expect(component.applications().length).toBeLessThanOrEqual(7);
      expect(component.carouselIndex()).toBeLessThan(5);
      expect(updateDocSpy).toHaveBeenCalledOnce();
    });

    it('should build query params and updateUrl', async () => {
      component.sortBy.set('name');
      component.sortDirection.set('ASC');
      component.currentApplication.set(makeDetailApp('1'));
      component.searchQuery.set('test');

      const testComp = component as unknown as {
        buildQueryParams: () => { sortBy: string; sortDir: string; applicationId?: string; search?: string };
        updateUrlQueryParams: () => Promise<void>;
      };

      const qp = testComp.buildQueryParams();
      expect(qp.sortBy).toBe('name');
      expect(qp.applicationId).toBe('1');
      expect(qp.search).toBe('test');

      const navSpy = vi.spyOn(router, 'navigate');
      await testComp.updateUrlQueryParams();
      expect(navSpy).toHaveBeenCalledWith([], expect.objectContaining({ replaceUrl: true, queryParams: expect.any(Object) }));
    });

    it('should updateDocumentInformation set currentDocumentIds', async () => {
      const ids = makeDocumentIds();
      applicationApi.getDocumentIds.mockReturnValueOnce(of(ids));
      await (component as unknown as { updateDocumentInformation: (id: string) => Promise<void> }).updateDocumentInformation('app-1');
      expect(component.currentDocumentIds()).toEqual(ids);
    });
  });

  describe('Initialization from Query Params', () => {
    it.each([
      {
        qp: { sortDir: 'INVALID' },
        pre: {},
        expect: (c: ApplicationDetailComponent, s: any, w: any) => {
          expect(c.sortDirection()).toBe('DESC');
          expect(s).toHaveBeenCalledOnce();
          expect(w).not.toHaveBeenCalled();
        },
      },
      {
        qp: { sortBy: 'otherField', sortDir: 'ASC' },
        pre: { sortBy: 'manualField', isSortInitiatedByUser: true },
        expect: (c: ApplicationDetailComponent, s: any) => {
          expect(c.sortBy()).toBe('manualField');
          expect(s).toHaveBeenCalledOnce();
        },
      },
      {
        qp: { applicationId: 'app-123' },
        pre: {},
        expect: (_: ApplicationDetailComponent, s: any, w: any) => {
          expect(w).toHaveBeenCalledWith('app-123');
          expect(s).not.toHaveBeenCalled();
        },
      },
    ])('should initialize from query params', async ({ qp, pre, expect: assertFn }) => {
      const testComp = component as unknown as {
        loadInitialPage: () => Promise<void>;
        loadCarousel: (id: string) => Promise<void>;
        isSortInitiatedByUser: boolean;
        isSearchInitiatedByUser: boolean;
      };

      const spyInit = vi.spyOn(testComp, 'loadInitialPage').mockResolvedValue(undefined);
      const spyWindow = vi.spyOn(testComp, 'loadCarousel').mockResolvedValue(undefined);

      if (pre.sortBy) component.sortBy.set(pre.sortBy);
      testComp.isSortInitiatedByUser = !!pre.isSortInitiatedByUser;
      testComp.isSearchInitiatedByUser = false;

      q$.next(convertToParamMap(qp));
      await component.init();
      assertFn(component, spyInit, spyWindow);
    });
  });

  describe('Load Page', () => {
    it('should load applications with filters and search', async () => {
      const mockRes = { applications: [makeDetailApp('1')], totalRecords: 5 };
      evaluationApi.getApplicationsDetails.mockReturnValueOnce(of(mockRes));
      component.selectedStatusFilters.set([ApplicationDetailDTOApplicationStateEnum.Sent]);
      component.selectedJobFilters.set(['AI Lab']);
      component.searchQuery.set('test-search');

      const result = await (component as unknown as { loadPage: (p: number, s: number) => Promise<any[]> }).loadPage(0, 10);

      expect(result).toEqual(mockRes.applications);
      expect(component.totalRecords()).toBe(5);
      expect(evaluationApi.getApplicationsDetails).toHaveBeenLastCalledWith(
        0,
        10,
        component.sortBy(),
        component.sortDirection(),
        [ApplicationDetailDTOApplicationStateEnum.Sent],
        ['AI Lab'],
        'test-search',
      );
    });

    it('should handle undefined applications/totalRecords gracefully', async () => {
      evaluationApi.getApplicationsDetails.mockReturnValueOnce(of({ applications: undefined, totalRecords: undefined }));
      const result = await (component as unknown as { loadPage: (p: number, s: number) => Promise<any> }).loadPage(5, 5);
      expect(result).toBeUndefined();
      expect(component.totalRecords()).toBe(0);
    });
  });

  describe('Misc', () => {
    it('should map translation keys with fallback for unknown keys', () => {
      const knownLabel = availableStatusOptions[0].label;
      const knownKey = availableStatusOptions[0].key;
      const testComp = component as unknown as { mapTranslationKeysToEnumValues: (labels: string[]) => string[] };
      expect(testComp.mapTranslationKeysToEnumValues([knownLabel])).toEqual([knownKey]);
      expect(testComp.mapTranslationKeysToEnumValues(['UNKNOWN_LABEL'])).toEqual(['UNKNOWN_LABEL']);
    });

    it('should call rejectOtherApplicationsOfJob with empty string when jobId is undefined', async () => {
      const testComp = component as unknown as { rejectOtherApplicationsOfJob: (id: string) => Promise<void> };
      const spy = vi.spyOn(testComp, 'rejectOtherApplicationsOfJob');
      const base = makeDetailApp('1', ApplicationDetailDTOApplicationStateEnum.Sent);
      const app = Object.assign({}, base, {
        jobId: undefined,
        applicationDetailDTO: Object.assign({}, base.applicationDetailDTO, { jobId: undefined }),
      }) as unknown as ApplicationEvaluationDetailDTO;
      component.currentApplication.set(app);
      component.applications.set([app, makeDetailApp('2')]);
      await component.acceptApplication({ closeJob: true });
      expect(spy).toHaveBeenCalledWith('');
    });
  });
});
