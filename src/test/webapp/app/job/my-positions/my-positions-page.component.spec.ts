import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, it, expect, vi, Mocked } from 'vitest';
import { of, throwError, EMPTY } from 'rxjs';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { signal } from '@angular/core';

import { MyPositionsPageComponent } from 'app/job/my-positions/my-positions-page.component';
import { AccountService } from 'app/core/auth/account.service';
import { CreatedJobDTO, CreatedJobDTOStateEnum } from 'app/generated/model/created-job-dto';
import { PageCreatedJobDTO } from 'app/generated/model/page-created-job-dto';
import { provideFontAwesomeTesting } from 'src/test/webapp/util/fontawesome.testing';
import { provideTranslateMock } from 'src/test/webapp/util/translate.mock';
import {
  createJobResourceApiMock,
  JobResourceApiMock,
  provideJobResourceApiMock,
} from 'src/test/webapp/util/job-resource-api.service.mock';
import { createToastServiceMock, provideToastServiceMock } from '../../../util/toast-service.mock';

type MyPositionsPageComponentInternals = {
  loadJobs(): Promise<void>;
  mapTranslationKeysToEnumValues(translationKeys: string[]): string[];
};

describe('MyPositionsPageComponent', () => {
  let fixture: ComponentFixture<MyPositionsPageComponent>;
  let component: MyPositionsPageComponent;
  let accountService: Mocked<AccountService>;
  let router: Mocked<Router>;
  let mockJobApi: JobResourceApiMock;
  let mockToastService: ReturnType<typeof createToastServiceMock>;

  beforeEach(async () => {
    mockJobApi = createJobResourceApiMock();
    mockJobApi.getJobsForCurrentResearchGroup.mockReturnValue(
      of<PageCreatedJobDTO>({
        content: [{ jobId: '1', title: 'Job A', state: CreatedJobDTOStateEnum.Draft } as CreatedJobDTO],
        totalElements: 1,
      }),
    );
    mockJobApi.deleteJob.mockReturnValue(of({}));
    mockJobApi.changeJobState.mockReturnValue(of({}));

    mockToastService = createToastServiceMock();

    accountService = {
      loadedUser: vi.fn().mockReturnValue({ id: 'u1', name: 'User' }),
      activeResearchGroupId: signal<string | undefined>(undefined),
    } as unknown as Mocked<AccountService>;

    router = { navigate: vi.fn(), events: EMPTY } as unknown as Mocked<Router>;

    await TestBed.configureTestingModule({
      imports: [MyPositionsPageComponent, TranslateModule.forRoot()],
      providers: [
        provideJobResourceApiMock(mockJobApi),
        { provide: AccountService, useValue: accountService },
        { provide: Router, useValue: router },
        provideToastServiceMock(mockToastService),
        provideFontAwesomeTesting(),
        provideTranslateMock(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MyPositionsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Navigation', () => {
    it.each([
      ['onCreateJob', () => component.onCreateJob(), ['/job/create']],
      ['onEditJob', () => component.onEditJob('123'), ['/job/edit/123']],
      ['onViewJob', () => component.onViewJob('321'), ['/job/detail/321']],
    ])('%s -> navigate to %j', (_name, call, expected) => {
      call();
      expect(router.navigate).toHaveBeenCalledWith(expected);
    });

    it.each([
      ['onEditJob', () => component.onEditJob('')],
      ['onViewJob', () => component.onViewJob('')],
    ])('%s should log error when id is empty', (_name, call) => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      call();
      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe('Search and Filters', () => {
    it('should reload on new search query and reset page', () => {
      const loadSpy = vi.spyOn(component as unknown as MyPositionsPageComponentInternals, 'loadJobs').mockResolvedValue(undefined);
      component.searchQuery.set('old');
      component.page.set(2);
      component.onSearchEmit('new');
      expect(component.page()).toBe(0);
      expect(component.searchQuery()).toBe('new');
      expect(loadSpy).toHaveBeenCalledOnce();
    });

    it('should not reload when query is same after trim/normalize', () => {
      const loadSpy = vi.spyOn(component as unknown as MyPositionsPageComponentInternals, 'loadJobs').mockResolvedValue(undefined);
      component.searchQuery.set('same query');
      component.onSearchEmit('  same   query ');
      expect(loadSpy).not.toHaveBeenCalled();
    });

    it('should trim and normalize whitespace in search query', () => {
      vi.spyOn(component as unknown as MyPositionsPageComponentInternals, 'loadJobs').mockResolvedValue(undefined);
      component.onSearchEmit(' test multiple spaces here ');
      expect(component.searchQuery()).toBe('test multiple spaces here');
    });

    it('should handle status filter and ignore non-status filters', () => {
      const loadSpy = vi.spyOn(component as unknown as MyPositionsPageComponentInternals, 'loadJobs').mockResolvedValue(undefined);
      component.onFilterEmit({ filterId: 'status', selectedValues: ['jobState.draft'] });
      expect(component.selectedStatusFilters()).toContain(CreatedJobDTOStateEnum.Draft);
      expect(loadSpy).toHaveBeenCalledOnce();

      loadSpy.mockClear();
      component.selectedStatusFilters.set([]);
      component.onFilterEmit({ filterId: 'subjectArea', selectedValues: ['CS'] });
      expect(component.selectedStatusFilters()).toEqual([]);
      expect(loadSpy).not.toHaveBeenCalled();
    });

    it('should fall back to original key in mapTranslationKeysToEnumValues', () => {
      const result = (component as unknown as MyPositionsPageComponentInternals).mapTranslationKeysToEnumValues(['unknownKey']);
      expect(result).toEqual(['unknownKey']);
    });
  });

  describe('Sorting and Pagination', () => {
    it('should sort and reset page', () => {
      const loadSpy = vi.spyOn(component as unknown as MyPositionsPageComponentInternals, 'loadJobs').mockResolvedValue(undefined);
      component.page.set(3);
      component.loadOnSortEmit({ field: 'title', direction: 'ASC' });
      expect(component.sortBy()).toBe('title');
      expect(component.sortDirection()).toBe('ASC');
      expect(component.page()).toBe(0);
      expect(loadSpy).toHaveBeenCalledOnce();
    });

    it('should compute page from first/rows on table emit', () => {
      const loadSpy = vi.spyOn(component as unknown as MyPositionsPageComponentInternals, 'loadJobs').mockResolvedValue(undefined);
      component.loadOnTableEmit({ first: 20, rows: 10 });
      expect(component.page()).toBe(2);
      expect(component.pageSize()).toBe(10);
      expect(loadSpy).toHaveBeenCalledOnce();
    });

    it('should default page=0 when first/rows undefined', () => {
      vi.spyOn(component as unknown as MyPositionsPageComponentInternals, 'loadJobs').mockResolvedValue(undefined);
      component.pageSize.set(5);
      component.loadOnTableEmit({});
      expect(component.page()).toBe(0);
      expect(component.pageSize()).toBe(5);
    });
  });

  describe('Load Jobs', () => {
    it('should load jobs and set state', async () => {
      await (component as unknown as MyPositionsPageComponentInternals).loadJobs();
      expect(mockJobApi.getJobsForCurrentResearchGroup).toHaveBeenCalledTimes(2);
      expect(component.jobs().length).toBe(1);
      expect(component.totalRecords()).toBe(1);
    });

    it('should toast error when API fails', async () => {
      mockJobApi.getJobsForCurrentResearchGroup.mockReturnValueOnce(throwError(() => new Error('fail')));
      await (component as unknown as MyPositionsPageComponentInternals).loadJobs();
      expect(mockToastService.showErrorKey).toHaveBeenCalledWith('myPositionsPage.errors.loadJobs');
    });

    it.each([
      ['userId is empty', () => vi.spyOn(accountService, 'loadedUser').mockReturnValue({ id: '', email: '', name: '' })],
      ['loadedUser is undefined', () => vi.spyOn(accountService, 'loadedUser').mockReturnValue(undefined)],
    ])('should not call API when %s', async (_label, setup) => {
      setup();
      const spy = vi.spyOn(mockJobApi, 'getJobsForCurrentResearchGroup');
      spy.mockClear();
      await (component as unknown as MyPositionsPageComponentInternals).loadJobs();
      expect(spy).not.toHaveBeenCalled();
    });

    it('should default jobs/totalRecords to empty when API returns undefined fields', async () => {
      mockJobApi.getJobsForCurrentResearchGroup.mockReturnValueOnce(
        of<PageCreatedJobDTO>({ content: undefined, totalElements: undefined }),
      );
      await (component as unknown as MyPositionsPageComponentInternals).loadJobs();
      expect(component.jobs()).toEqual([]);
      expect(component.totalRecords()).toBe(0);
    });

    it('should send filters/search/sort to API', async () => {
      component.selectedStatusFilters.set([CreatedJobDTOStateEnum.Published]);
      const spy = vi.spyOn(mockJobApi, 'getJobsForCurrentResearchGroup');
      spy.mockReturnValue(of({ content: [], totalElements: 0 } as PageCreatedJobDTO));
      await (component as unknown as MyPositionsPageComponentInternals).loadJobs();
      expect(spy).toHaveBeenCalledWith(
        component.pageSize(),
        component.page(),
        [CreatedJobDTOStateEnum.Published],
        undefined,
        component.sortBy(),
        component.sortDirection(),
        component.searchQuery(),
      );
    });
  });

  describe('Job Actions', () => {
    it('should delete job successfully and reload', async () => {
      const loadSpy = vi.spyOn(component as unknown as MyPositionsPageComponentInternals, 'loadJobs').mockResolvedValue(undefined);
      await component.onDeleteJob('1');
      expect(mockJobApi.deleteJob).toHaveBeenCalledWith('1');
      expect(mockToastService.showSuccessKey).toHaveBeenCalledOnce();
      expect(loadSpy).toHaveBeenCalledOnce();
    });

    it('should toast error on delete failure', async () => {
      vi.spyOn(mockJobApi, 'deleteJob').mockReturnValueOnce(throwError(() => new Error('delete failed')));
      await component.onDeleteJob('1');
      expect(mockToastService.showErrorKey).toHaveBeenCalledWith(
        'myPositionsPage.toastMessages.deleteJobFailed',
        expect.objectContaining({ detail: expect.stringContaining('delete failed') }),
      );
    });

    it('should close job successfully and reload', async () => {
      const loadSpy = vi.spyOn(component as unknown as MyPositionsPageComponentInternals, 'loadJobs').mockResolvedValue(undefined);
      await component.onCloseJob('1');
      expect(mockJobApi.changeJobState).toHaveBeenCalledWith('1', CreatedJobDTOStateEnum.Closed);
      expect(mockToastService.showSuccessKey).toHaveBeenCalledOnce();
      expect(loadSpy).toHaveBeenCalledOnce();
    });

    it('should toast error on close failure', async () => {
      vi.spyOn(mockJobApi, 'changeJobState').mockReturnValueOnce(throwError(() => new Error('close fail')));
      await component.onCloseJob('1');
      expect(mockToastService.showErrorKey).toHaveBeenCalledWith(
        'myPositionsPage.toastMessages.closeJobFailed',
        expect.objectContaining({ detail: expect.stringContaining('close fail') }),
      );
    });
  });

  describe('Confirm Actions', () => {
    type ConfirmActionTarget = 'onEditJob' | 'onDeleteJob' | 'onCloseJob';
    const confirmRows: ReadonlyArray<readonly [string, ConfirmActionTarget, () => void | Promise<void>, boolean]> = [
      ['onConfirmEdit', 'onEditJob', () => component.onConfirmEdit(), false],
      ['onConfirmDelete', 'onDeleteJob', () => component.onConfirmDelete(), true],
      ['onConfirmClose', 'onCloseJob', () => component.onConfirmClose(), true],
    ];

    it.each(confirmRows)('%s should skip when currentJobId empty/undefined', async (_name, target, call, isAsync) => {
      const spy = vi.spyOn(component, target).mockImplementation(() => (isAsync ? Promise.resolve() : undefined));
      component.currentJobId.set(undefined);
      const result = call();
      if (isAsync) await result;
      expect(spy).not.toHaveBeenCalled();
    });

    it.each(confirmRows)('%s should invoke %s with currentJobId', async (_name, target, call, isAsync) => {
      const spy = vi.spyOn(component, target).mockImplementation(() => (isAsync ? Promise.resolve() : undefined));
      component.currentJobId.set('job-x');
      const result = call();
      if (isAsync) await result;
      expect(spy).toHaveBeenCalledWith('job-x');
    });
  });

  describe('Job Menu Items', () => {
    it.each([
      [CreatedJobDTOStateEnum.Draft, ['button.edit', 'button.delete']],
      [CreatedJobDTOStateEnum.Published, ['button.edit', 'button.close']],
    ])('builds menu labels for %s', (state, labels) => {
      component.jobs.set([{ jobId: 'jx', state, title: 'X' } as CreatedJobDTO]);
      expect((component.jobMenuItems().get('jx') ?? []).map(i => i.label)).toEqual(labels);
    });

    it('should omit menu items for closed jobs', () => {
      component.jobs.set([{ jobId: '3', state: CreatedJobDTOStateEnum.Closed, title: 'Closed' } as CreatedJobDTO]);
      expect(component.jobMenuItems().get('3') ?? []).toEqual([]);
    });

    it('should invoke edit command for draft jobs', () => {
      const editSpy = vi.spyOn(component, 'onEditJob');
      component.jobs.set([{ jobId: '1', state: CreatedJobDTOStateEnum.Draft, title: 'Draft' } as CreatedJobDTO]);
      component.jobMenuItems().get('1')?.[0].command?.();
      expect(editSpy).toHaveBeenCalledWith('1');
    });

    it('should set dialog flags via menu commands', () => {
      // Published edit -> showEditPublishedDialog
      component.jobs.set([{ jobId: '2', state: CreatedJobDTOStateEnum.Published, title: 'P' } as CreatedJobDTO]);
      component.jobMenuItems().get('2')?.[0].command?.();
      expect(component.currentJobId()).toBe('2');
      expect(component.showEditPublishedDialog()).toBe(true);

      // Draft delete -> showDeleteDialog
      component.jobs.set([{ jobId: '4', state: CreatedJobDTOStateEnum.Draft, title: 'D' } as CreatedJobDTO]);
      component.jobMenuItems().get('4')?.[1].command?.();
      expect(component.showDeleteDialog()).toBe(true);

      // Published close -> showCloseDialog
      component.jobs.set([{ jobId: '5', state: CreatedJobDTOStateEnum.Published, title: 'P' } as CreatedJobDTO]);
      component.jobMenuItems().get('5')?.[1].command?.();
      expect(component.showCloseDialog()).toBe(true);
    });
  });
});
