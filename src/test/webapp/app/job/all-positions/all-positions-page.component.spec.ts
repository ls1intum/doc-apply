import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

import { AllPositionsPageComponent } from 'app/job/all-positions/all-positions-page.component';
import { AdminCreatedJobDTO, AdminCreatedJobDTOStateEnum } from 'app/generated/model/admin-created-job-dto';
import { PageAdminCreatedJobDTO } from 'app/generated/model/page-admin-created-job-dto';
import { ResearchGroupResourceApi } from 'app/generated/api/research-group-resource-api';
import { UserResourceApi } from 'app/generated/api/user-resource-api';
import { provideFontAwesomeTesting } from 'src/test/webapp/util/fontawesome.testing';
import { provideTranslateMock } from 'src/test/webapp/util/translate.mock';
import {
  createJobResourceApiMock,
  JobResourceApiMock,
  provideJobResourceApiMock,
} from 'src/test/webapp/util/job-resource-api.service.mock';
import {
  createResearchGroupResourceApiMock,
  ResearchGroupResourceApiMock,
} from 'src/test/webapp/util/research-group-resource-api.service.mock';
import { createUserResourceApiMock, UserResourceApiMock } from 'src/test/webapp/util/user-resource-api.service.mock';
import { createRouterMock, provideRouterMock, RouterMock } from 'src/test/webapp/util/router.mock';
import { createToastServiceMock, provideToastServiceMock } from '../../../util/toast-service.mock';

describe('AllPositionsPageComponent', () => {
  let fixture: ComponentFixture<AllPositionsPageComponent>;
  let component: AllPositionsPageComponent;

  let router: RouterMock;
  let mockJobApi: JobResourceApiMock;
  let mockRgApi: ResearchGroupResourceApiMock;
  let mockUserApi: UserResourceApiMock;
  let mockToastService: ReturnType<typeof createToastServiceMock>;

  beforeEach(async () => {
    mockJobApi = createJobResourceApiMock();
    mockJobApi.getAllJobs.mockReturnValue(
      of<PageAdminCreatedJobDTO>({
        content: [
          {
            jobId: '1',
            title: 'Job A',
            state: AdminCreatedJobDTOStateEnum.Draft,
            researchGroupName: 'RG 1',
            professorName: 'Alice Example',
          } as AdminCreatedJobDTO,
        ],
        totalElements: 1,
      }),
    );
    mockJobApi.deleteJob.mockReturnValue(of({}));
    mockJobApi.changeJobState.mockReturnValue(of({}));

    mockRgApi = createResearchGroupResourceApiMock();
    mockRgApi.getResearchGroupsForAdmin.mockReturnValue(
      of({
        content: [{ id: 'r1', researchGroup: 'RG 1' }],
        totalElements: 1,
      }),
    );

    mockUserApi = createUserResourceApiMock();
    mockUserApi.getAllProfessors.mockReturnValue(of([{ userId: 'p1', firstName: 'Prof', lastName: 'One' }]));

    mockToastService = createToastServiceMock();

    router = createRouterMock();

    await TestBed.configureTestingModule({
      imports: [AllPositionsPageComponent, TranslateModule.forRoot()],
      providers: [
        provideJobResourceApiMock(mockJobApi),
        { provide: ResearchGroupResourceApi, useValue: mockRgApi },
        { provide: UserResourceApi, useValue: mockUserApi },
        provideRouterMock(router),
        provideToastServiceMock(mockToastService),
        provideFontAwesomeTesting(),
        provideTranslateMock(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AllPositionsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should load research-group options on init via getResearchGroupsForAdmin', async () => {
      expect(mockRgApi.getResearchGroupsForAdmin).toHaveBeenCalledOnce();
      expect(component.researchGroupOptions()).toEqual([{ id: 'r1', name: 'RG 1' }]);
    });

    it('should load professor options on init using firstName + lastName', async () => {
      expect(mockUserApi.getAllProfessors).toHaveBeenCalledOnce();
      expect(component.professorOptions()).toEqual([{ id: 'p1', name: 'Prof One' }]);
    });

    it('should drop research-group entries with missing id or name', async () => {
      mockRgApi.getResearchGroupsForAdmin.mockReturnValueOnce(
        of({
          content: [
            { id: 'r1', researchGroup: 'RG 1' },
            { id: '', researchGroup: 'No Id' },
            { id: 'r2', researchGroup: '' },
          ],
          totalElements: 3,
        }),
      );
      mockUserApi.getAllProfessors.mockReturnValueOnce(of([]));

      const newFixture = TestBed.createComponent(AllPositionsPageComponent);
      newFixture.detectChanges();
      await newFixture.whenStable();

      expect(newFixture.componentInstance.researchGroupOptions()).toEqual([{ id: 'r1', name: 'RG 1' }]);
    });

    it('should drop professor entries with missing id or name', async () => {
      mockUserApi.getAllProfessors.mockReturnValueOnce(
        of([
          { userId: 'p1', firstName: 'Prof', lastName: 'One' },
          { userId: '', firstName: 'No', lastName: 'Id' },
          { userId: 'p2', firstName: '', lastName: '' },
        ]),
      );
      mockRgApi.getResearchGroupsForAdmin.mockReturnValueOnce(of({ content: [], totalElements: 0 }));

      const newFixture = TestBed.createComponent(AllPositionsPageComponent);
      newFixture.detectChanges();
      await newFixture.whenStable();

      expect(newFixture.componentInstance.professorOptions()).toEqual([{ id: 'p1', name: 'Prof One' }]);
    });

    it('should toast loadFilters error when getResearchGroupsForAdmin fails', async () => {
      mockRgApi.getResearchGroupsForAdmin.mockReturnValueOnce(throwError(() => new Error('fail')));
      mockUserApi.getAllProfessors.mockReturnValueOnce(of([]));

      const newFixture = TestBed.createComponent(AllPositionsPageComponent);
      newFixture.detectChanges();
      await newFixture.whenStable();

      expect(mockToastService.showErrorKey).toHaveBeenCalledExactlyOnceWith('allPositionsPage.errors.loadFilters');
    });

    it('should toast loadFilters error when getAllProfessors fails', async () => {
      mockRgApi.getResearchGroupsForAdmin.mockReturnValueOnce(of({ content: [], totalElements: 0 }));
      mockUserApi.getAllProfessors.mockReturnValueOnce(throwError(() => new Error('fail')));

      const newFixture = TestBed.createComponent(AllPositionsPageComponent);
      newFixture.detectChanges();
      await newFixture.whenStable();

      expect(mockToastService.showErrorKey).toHaveBeenCalledExactlyOnceWith('allPositionsPage.errors.loadFilters');
    });
  });

  describe('Lazy load and pagination', () => {
    it('should call getAllJobs with current paging on lazy load', async () => {
      mockJobApi.getAllJobs.mockClear();
      component.loadOnTableEmit({ first: 20, rows: 10 });
      await fixture.whenStable();
      expect(component.page()).toBe(2);
      expect(component.pageSize()).toBe(10);
      expect(mockJobApi.getAllJobs).toHaveBeenCalledOnce();
    });

    it('should fall back to current pageSize when event values are missing', async () => {
      const loadSpy = vi.spyOn(component as unknown as { loadJobs: () => Promise<void> }, 'loadJobs').mockResolvedValue();
      component.pageSize.set(5);
      component.loadOnTableEmit({});
      expect(component.page()).toBe(0);
      expect(component.pageSize()).toBe(5);
      expect(loadSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Search and filters', () => {
    it('should reload with normalized query on search emit', () => {
      const loadSpy = vi.spyOn(component as unknown as { loadJobs: () => Promise<void> }, 'loadJobs').mockResolvedValue();
      component.searchQuery.set('old');
      component.onSearchEmit('  new   query ');
      expect(component.searchQuery()).toBe('new query');
      expect(component.page()).toBe(0);
      expect(loadSpy).toHaveBeenCalledOnce();
    });

    it('should not reload when search query is unchanged', () => {
      const loadSpy = vi.spyOn(component as unknown as { loadJobs: () => Promise<void> }, 'loadJobs').mockResolvedValue();
      component.searchQuery.set('same query');
      component.onSearchEmit(' same   query ');
      expect(loadSpy).not.toHaveBeenCalled();
    });

    it('should map status translation keys to enum values and reload', () => {
      const loadSpy = vi.spyOn(component as unknown as { loadJobs: () => Promise<void> }, 'loadJobs').mockResolvedValue();
      component.onFilterEmit({ filterId: 'status', selectedValues: ['jobState.draft', 'jobState.published'] });
      expect(component.selectedStatusFilters()).toEqual([AdminCreatedJobDTOStateEnum.Draft, AdminCreatedJobDTOStateEnum.Published]);
      expect(loadSpy).toHaveBeenCalledOnce();
    });

    it('should map research-group display names to ids and reload', () => {
      const loadSpy = vi.spyOn(component as unknown as { loadJobs: () => Promise<void> }, 'loadJobs').mockResolvedValue();
      component.onFilterEmit({ filterId: 'researchGroup', selectedValues: ['RG 1'] });
      expect(component.selectedResearchGroupIds()).toEqual(['r1']);
      expect(loadSpy).toHaveBeenCalledOnce();
    });

    it('should map professor display names to ids and reload', () => {
      const loadSpy = vi.spyOn(component as unknown as { loadJobs: () => Promise<void> }, 'loadJobs').mockResolvedValue();
      component.onFilterEmit({ filterId: 'professor', selectedValues: ['Prof One'] });
      expect(component.selectedProfessorIds()).toEqual(['p1']);
      expect(loadSpy).toHaveBeenCalledOnce();
    });

    it('should keep original value when name is not found in research-group options', () => {
      vi.spyOn(component as unknown as { loadJobs: () => Promise<void> }, 'loadJobs').mockResolvedValue();
      component.onFilterEmit({ filterId: 'researchGroup', selectedValues: ['Unknown RG'] });
      expect(component.selectedResearchGroupIds()).toEqual(['Unknown RG']);
    });

    it('should ignore unknown filter ids', () => {
      const loadSpy = vi.spyOn(component as unknown as { loadJobs: () => Promise<void> }, 'loadJobs').mockResolvedValue();
      component.onFilterEmit({ filterId: 'somethingElse', selectedValues: ['x'] });
      expect(loadSpy).not.toHaveBeenCalled();
    });
  });

  describe('Sorting', () => {
    it('should reset page and store sort field/direction on sort emit', () => {
      const loadSpy = vi.spyOn(component as unknown as { loadJobs: () => Promise<void> }, 'loadJobs').mockResolvedValue();
      component.page.set(3);
      component.loadOnSortEmit({ field: 'title', direction: 'ASC' });
      expect(component.page()).toBe(0);
      expect(component.sortBy()).toBe('title');
      expect(component.sortDirection()).toBe('ASC');
      expect(loadSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Load jobs', () => {
    it('should call getAllJobs with mapped filter ids', async () => {
      component.selectedStatusFilters.set([AdminCreatedJobDTOStateEnum.Published]);
      component.selectedResearchGroupIds.set(['r1']);
      component.selectedProfessorIds.set(['p1']);
      mockJobApi.getAllJobs.mockClear();
      mockJobApi.getAllJobs.mockReturnValue(of<PageAdminCreatedJobDTO>({ content: [], totalElements: 0 }));

      await (component as unknown as { loadJobs: () => Promise<void> }).loadJobs();

      expect(mockJobApi.getAllJobs).toHaveBeenCalledExactlyOnceWith(
        component.pageSize(),
        component.page(),
        [AdminCreatedJobDTOStateEnum.Published],
        ['r1'],
        ['p1'],
        component.sortBy(),
        component.sortDirection(),
        component.searchQuery(),
      );
    });

    it('should pass undefined for empty filter arrays', async () => {
      component.selectedStatusFilters.set([]);
      component.selectedResearchGroupIds.set([]);
      component.selectedProfessorIds.set([]);
      mockJobApi.getAllJobs.mockClear();
      mockJobApi.getAllJobs.mockReturnValue(of<PageAdminCreatedJobDTO>({ content: [], totalElements: 0 }));

      await (component as unknown as { loadJobs: () => Promise<void> }).loadJobs();

      expect(mockJobApi.getAllJobs).toHaveBeenCalledExactlyOnceWith(
        component.pageSize(),
        component.page(),
        undefined,
        undefined,
        undefined,
        component.sortBy(),
        component.sortDirection(),
        component.searchQuery(),
      );
    });

    it('should toast loadJobs error when API fails', async () => {
      mockJobApi.getAllJobs.mockReturnValueOnce(throwError(() => new Error('fail')));
      await (component as unknown as { loadJobs: () => Promise<void> }).loadJobs();
      expect(mockToastService.showErrorKey).toHaveBeenCalledExactlyOnceWith('allPositionsPage.errors.loadJobs');
    });

    it('should default jobs and totalRecords when API returns undefined values', async () => {
      mockJobApi.getAllJobs.mockReturnValueOnce(of<PageAdminCreatedJobDTO>({ content: undefined, totalElements: undefined }));
      await (component as unknown as { loadJobs: () => Promise<void> }).loadJobs();
      expect(component.jobs()).toEqual([]);
      expect(component.totalRecords()).toBe(0);
    });
  });

  describe('Job actions', () => {
    it('should navigate to edit page on Edit', () => {
      component.onEditJob('123');
      expect(router.navigate).toHaveBeenCalledExactlyOnceWith(['/job/edit/123']);
    });

    it('should log error when editing with empty id', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      component.onEditJob('');
      expect(spy).toHaveBeenCalledOnce();
    });

    it('should navigate to detail page on View', () => {
      component.onViewJob('321');
      expect(router.navigate).toHaveBeenCalledExactlyOnceWith(['/job/detail/321']);
    });

    it('should call deleteJob and refresh on delete', async () => {
      const loadSpy = vi.spyOn(component as unknown as { loadJobs: () => Promise<void> }, 'loadJobs').mockResolvedValue();
      await component.onDeleteJob('1');
      expect(mockJobApi.deleteJob).toHaveBeenCalledExactlyOnceWith('1');
      expect(mockToastService.showSuccessKey).toHaveBeenCalledExactlyOnceWith('allPositionsPage.toastMessages.deleteJobSuccess');
      expect(loadSpy).toHaveBeenCalledOnce();
    });

    it('should toast on delete failure', async () => {
      vi.spyOn(mockJobApi, 'deleteJob').mockReturnValueOnce(throwError(() => new Error('delete failed')));
      await component.onDeleteJob('1');
      expect(mockToastService.showErrorKey).toHaveBeenCalledExactlyOnceWith(
        'allPositionsPage.toastMessages.deleteJobFailed',
        expect.objectContaining({ detail: expect.stringContaining('delete failed') }),
      );
    });

    it('should call changeJobState(CLOSED) and refresh on close', async () => {
      const loadSpy = vi.spyOn(component as unknown as { loadJobs: () => Promise<void> }, 'loadJobs').mockResolvedValue();
      await component.onCloseJob('1');
      expect(mockJobApi.changeJobState).toHaveBeenCalledExactlyOnceWith('1', AdminCreatedJobDTOStateEnum.Closed);
      expect(mockToastService.showSuccessKey).toHaveBeenCalledExactlyOnceWith('allPositionsPage.toastMessages.closeJobSuccess');
      expect(loadSpy).toHaveBeenCalledOnce();
    });

    it('should toast on close failure', async () => {
      vi.spyOn(mockJobApi, 'changeJobState').mockReturnValueOnce(throwError(() => new Error('close fail')));
      await component.onCloseJob('1');
      expect(mockToastService.showErrorKey).toHaveBeenCalledExactlyOnceWith(
        'allPositionsPage.toastMessages.closeJobFailed',
        expect.objectContaining({ detail: expect.stringContaining('close fail') }),
      );
    });
  });

  describe('Confirm actions', () => {
    it('should skip confirm edit when currentJobId is undefined', () => {
      const spy = vi.spyOn(component, 'onEditJob');
      component.currentJobId.set(undefined);
      component.onConfirmEdit();
      expect(spy).not.toHaveBeenCalled();
    });

    it('should confirm edit when currentJobId is set', () => {
      const spy = vi.spyOn(component, 'onEditJob');
      component.currentJobId.set('job-1');
      component.onConfirmEdit();
      expect(spy).toHaveBeenCalledExactlyOnceWith('job-1');
    });

    it('should skip confirm delete when currentJobId is empty', async () => {
      const spy = vi.spyOn(component, 'onDeleteJob').mockResolvedValue();
      component.currentJobId.set('');
      await component.onConfirmDelete();
      expect(spy).not.toHaveBeenCalled();
    });

    it('should call onDeleteJob on confirmed delete', async () => {
      const spy = vi.spyOn(component, 'onDeleteJob').mockResolvedValue();
      component.currentJobId.set('job-2');
      await component.onConfirmDelete();
      expect(spy).toHaveBeenCalledExactlyOnceWith('job-2');
    });

    it('should skip confirm close when currentJobId is empty', async () => {
      const spy = vi.spyOn(component, 'onCloseJob').mockResolvedValue();
      component.currentJobId.set('');
      await component.onConfirmClose();
      expect(spy).not.toHaveBeenCalled();
    });

    it('should call onCloseJob on confirmed close', async () => {
      const spy = vi.spyOn(component, 'onCloseJob').mockResolvedValue();
      component.currentJobId.set('job-3');
      await component.onConfirmClose();
      expect(spy).toHaveBeenCalledExactlyOnceWith('job-3');
    });
  });

  describe('Job menu items', () => {
    it.each([
      [AdminCreatedJobDTOStateEnum.Draft, ['button.edit', 'button.delete']],
      [AdminCreatedJobDTOStateEnum.Published, ['button.edit', 'button.delete', 'button.close']],
      [AdminCreatedJobDTOStateEnum.Closed, ['button.edit', 'button.delete', 'button.reopen']],
      [AdminCreatedJobDTOStateEnum.ApplicantFound, ['button.edit', 'button.delete', 'button.reopen']],
    ] as const)('should build menu items for %s jobs', (state, expectedLabels) => {
      component.jobs.set([{ jobId: '1', state, title: 'T' } as AdminCreatedJobDTO]);
      const items = component.jobMenuItems().get('1') ?? [];
      expect(items.map(i => i.label)).toEqual(expectedLabels);
    });

    it('should invoke edit command directly for draft jobs', () => {
      const editSpy = vi.spyOn(component, 'onEditJob');
      component.jobs.set([{ jobId: '1', state: AdminCreatedJobDTOStateEnum.Draft, title: 'Draft' } as AdminCreatedJobDTO]);
      const items = component.jobMenuItems().get('1') ?? [];
      items[0]?.command?.();
      expect(editSpy).toHaveBeenCalledExactlyOnceWith('1');
    });

    it('should open the edit-published dialog for published jobs', () => {
      component.jobs.set([{ jobId: '2', state: AdminCreatedJobDTOStateEnum.Published, title: 'Pub' } as AdminCreatedJobDTO]);
      const items = component.jobMenuItems().get('2') ?? [];
      items[0]?.command?.();
      expect(component.currentJobId()).toBe('2');
      expect(component.showEditPublishedDialog()).toBe(true);
    });

    it('should open the delete dialog for draft jobs', () => {
      component.jobs.set([{ jobId: '1', state: AdminCreatedJobDTOStateEnum.Draft, title: 'Draft' } as AdminCreatedJobDTO]);
      const items = component.jobMenuItems().get('1') ?? [];
      items[1]?.command?.();
      expect(component.currentJobId()).toBe('1');
      expect(component.showDeleteDialog()).toBe(true);
    });

    it('should open the close dialog for published jobs', () => {
      component.jobs.set([{ jobId: '2', state: AdminCreatedJobDTOStateEnum.Published, title: 'Pub' } as AdminCreatedJobDTO]);
      const items = component.jobMenuItems().get('2') ?? [];
      items[2]?.command?.();
      expect(component.currentJobId()).toBe('2');
      expect(component.showCloseDialog()).toBe(true);
    });
  });

  describe('Reopen flow', () => {
    it('should call changeJobState with PUBLISHED when reopen is confirmed', async () => {
      component.currentJobId.set('j');
      await component.onConfirmReopen();
      expect(mockJobApi.changeJobState).toHaveBeenCalledExactlyOnceWith('j', AdminCreatedJobDTOStateEnum.Published);
    });

    it('should show success toast and reload jobs after a successful reopen', async () => {
      component.currentJobId.set('j');
      await component.onConfirmReopen();
      expect(mockToastService.showSuccessKey).toHaveBeenCalledExactlyOnceWith('allPositionsPage.toastMessages.reopenJobSuccess');
    });

    it('should show error toast on reopen failure', async () => {
      mockJobApi.changeJobState.mockReturnValueOnce(throwError(() => new Error('boom')));
      component.currentJobId.set('j');
      await component.onConfirmReopen();
      expect(mockToastService.showErrorKey).toHaveBeenCalledExactlyOnceWith('allPositionsPage.toastMessages.reopenJobFailed', {
        detail: 'boom',
      });
    });
  });

  describe('Delete dialog copy', () => {
    it('should expose draft delete copy when current job is DRAFT', async () => {
      mockJobApi.getAllJobs.mockReturnValueOnce(
        of<PageAdminCreatedJobDTO>({
          content: [{ jobId: 'j', title: 'T', state: AdminCreatedJobDTOStateEnum.Draft } as AdminCreatedJobDTO],
          totalElements: 1,
        }),
      );
      component.loadOnTableEmit({ first: 0, rows: 10 } as never);
      await fixture.whenStable();
      component.currentJobId.set('j');
      expect(component.deleteDialogHeaderKey()).toBe('allPositionsPage.confirmDialog.deleteHeader');
      expect(component.deleteDialogMessageKey()).toBe('allPositionsPage.confirmDialog.deleteMessage');
    });

    it('should expose non-draft delete copy when current job is PUBLISHED', async () => {
      mockJobApi.getAllJobs.mockReturnValueOnce(
        of<PageAdminCreatedJobDTO>({
          content: [{ jobId: 'j', title: 'T', state: AdminCreatedJobDTOStateEnum.Published } as AdminCreatedJobDTO],
          totalElements: 1,
        }),
      );
      component.loadOnTableEmit({ first: 0, rows: 10 } as never);
      await fixture.whenStable();
      component.currentJobId.set('j');
      expect(component.deleteDialogHeaderKey()).toBe('allPositionsPage.confirmDialog.deleteHeaderNonDraft');
      expect(component.deleteDialogMessageKey()).toBe('allPositionsPage.confirmDialog.deleteMessageNonDraft');
    });
  });
});
