import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { provideRouter, Router } from '@angular/router';

import { JobCardListComponent } from 'app/job/job-overview/job-card-list/job-card-list.component';
import { JobResourceApi } from 'app/generated/api/job-resource-api';
import { provideTranslateMock } from 'src/test/webapp/util/translate.mock';
import { provideFontAwesomeTesting } from 'src/test/webapp/util/fontawesome.testing';
import { ApplicationStatusExtended, JobCardComponent } from 'app/job/job-overview/job-card/job-card.component';
import * as DropdownOptions from 'app/job/dropdown-options';
import { JobCardDTOLocationEnum as JobLocationEnum } from 'app/generated/model/job-card-dto';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';
import { By } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { createAccountServiceMock, provideAccountServiceMock } from 'src/test/webapp/util/account.service.mock';
import { createToastServiceMock, provideToastServiceMock } from '../../../../util/toast-service.mock';
import { getRequiredAnchor } from 'src/test/webapp/util/utility-methods/dom-query.util';

describe('JobCardListComponent', () => {
  let fixture: ComponentFixture<JobCardListComponent>;
  let component: JobCardListComponent;
  let accountService = createAccountServiceMock();

  let jobApi: {
    getAllFilters: ReturnType<typeof vi.fn>;
    getAvailableJobs: ReturnType<typeof vi.fn>;
  };

  let mockToastService = createToastServiceMock();

  beforeEach(async () => {
    localStorage.clear();
    jobApi = {
      getAllFilters: vi.fn().mockReturnValue(
        of({
          subjectAreas: [DropdownOptions.subjectAreas[0].value, DropdownOptions.subjectAreas[1].value],
          supervisorNames: ['Prof. X'],
        }),
      ),
      getAvailableJobs: vi.fn().mockReturnValue(
        of({
          content: [
            {
              jobId: '1',
              title: 'Test Job',
              professorName: 'Prof. Y',
              location: JobLocationEnum.Munich,
            },
          ],
          totalElements: 1,
        }),
      ),
    };
    accountService = createAccountServiceMock();
    accountService.setAuthorities([UserShortDTORolesEnum.Applicant]);

    await TestBed.configureTestingModule({
      imports: [JobCardListComponent],
      providers: [
        { provide: JobResourceApi, useValue: jobApi },
        provideTranslateMock(),
        provideFontAwesomeTesting(),
        provideToastServiceMock(mockToastService),
        provideAccountServiceMock(accountService),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(JobCardListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load filters successfully', async () => {
    await component.loadAllFilter();

    expect(jobApi.getAllFilters).toHaveBeenCalledTimes(2);
    // allSubjectAreas is a static list of i18n keys from DropdownOptions
    expect(component.allSubjectAreas).toEqual(DropdownOptions.subjectAreas.map(option => option.name));
    expect(component.allSupervisorNames()).toEqual(['Prof. X']);
    expect(mockToastService.showErrorKey).not.toHaveBeenCalled();
  });

  it('should handle error when loading filters', async () => {
    jobApi.getAllFilters.mockReturnValueOnce(throwError(() => new Error('fail')));

    await component.loadAllFilter();

    expect(mockToastService.showErrorKey).toHaveBeenCalledWith('jobOverviewPage.errors.loadFilter');
  });

  it('should load jobs successfully', async () => {
    await component.loadJobs();

    expect(jobApi.getAvailableJobs).toHaveBeenCalledTimes(2);
    expect(component.jobs().length).toBe(1);
    expect(component.totalRecords()).toBe(1);
  });

  it('should handle error when loading jobs', async () => {
    jobApi.getAvailableJobs.mockReturnValueOnce(throwError(() => new Error('fail')));

    await runSilently(() => component.loadJobs());

    expect(mockToastService.showErrorKey).toHaveBeenCalledWith('jobOverviewPage.errors.loadJobs');
  });

  it('should reset page and update search query on new search', async () => {
    const spy = vi.spyOn(component, 'loadJobs').mockResolvedValue(true);

    component.searchQuery.set('Old query');
    component.page.set(5);

    component.onSearchEmit('New query');
    fixture.detectChanges();

    expect(component.page()).toBe(0);
    expect(component.searchQuery()).toBe('New query');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('should not reload jobs if search query is the same after trimming', async () => {
    const spy = vi.spyOn(component, 'loadJobs').mockResolvedValue(true);

    component.searchQuery.set('Same query');
    component.onSearchEmit('   Same   query   ');

    expect(spy).not.toHaveBeenCalled();
  });

  it.each<{
    filterId: string;
    values: string[];
    selector: 'selectedSubjectAreaFilters' | 'selectedLocationFilters' | 'selectedSupervisorFilters';
    expected: string[];
  }>([
    {
      filterId: 'subjectArea',
      values: [DropdownOptions.subjectAreas[0].name],
      selector: 'selectedSubjectAreaFilters',
      expected: [DropdownOptions.subjectAreas[0].value],
    },
    {
      filterId: 'location',
      values: ['jobCreationForm.basicInformationSection.locations.Munich'],
      selector: 'selectedLocationFilters',
      expected: ['MUNICH'],
    },
    {
      filterId: 'supervisor',
      values: ['Prof. X'],
      selector: 'selectedSupervisorFilters',
      expected: ['Prof. X'],
    },
  ])('should handle filter changes for $filterId', ({ filterId, values, selector, expected }) => {
    const spy = vi.spyOn(component, 'loadJobs').mockResolvedValue(true);
    component.onFilterEmit({ filterId, selectedValues: values });
    fixture.detectChanges();
    expect(component[selector]()).toEqual(expected);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('should handle sort emit correctly', async () => {
    const spy = vi.spyOn(component, 'loadJobs').mockResolvedValue(true);

    component.onSortEmit({ field: 'title', direction: 'ASC' });
    fixture.detectChanges();
    expect(component.page()).toBe(0);
    expect(component.sortBy()).toBe('title');
    expect(component.sortDirection()).toBe('ASC');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('should handle table lazy load correctly', async () => {
    const spy = vi.spyOn(component, 'loadJobs').mockResolvedValue(true);

    component.loadOnTableEmit({ first: 16, rows: 8 });
    fixture.detectChanges();
    expect(component.page()).toBe(2);
    expect(component.pageSize()).toBe(8);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('should update pageSize when dynamic-table reports a hydrated value', () => {
    component.onPageSizeHydrated(30);

    expect(component.pageSize()).toBe(30);
  });

  it('should set empty jobs and totalRecords when API returns no content', async () => {
    jobApi.getAvailableJobs.mockReturnValueOnce(of({ content: undefined, totalElements: undefined }));

    await component.loadJobs();

    expect(component.jobs()).toEqual([]);
    expect(component.totalRecords()).toBe(0);
  });

  it('should handle loadAllFilter when API returns null fields', async () => {
    jobApi.getAllFilters.mockReturnValueOnce(of({ jobNames: null, subjectAreas: null, supervisorNames: null }));

    await component.loadAllFilter();

    // allSubjectAreas remains the static list of i18n keys
    expect(component.allSubjectAreas).toEqual(DropdownOptions.subjectAreas.map(option => option.name));
    expect(component.allSupervisorNames()).toEqual([]);
  });

  it('should ignore unknown filterId in onFilterEmit', async () => {
    const spy = vi.spyOn(component, 'loadJobs').mockResolvedValue(true);

    component.onFilterEmit({ filterId: 'unknown', selectedValues: ['x'] });

    expect(spy).not.toHaveBeenCalled();
  });

  it('should clear search when only whitespace is entered', async () => {
    const spy = vi.spyOn(component, 'loadJobs').mockResolvedValue(true);

    component.searchQuery.set('Existing');
    component.onSearchEmit('   ');
    fixture.detectChanges();

    expect(component.searchQuery()).toBe('');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('should update sort when called twice with different values', async () => {
    const spy = vi.spyOn(component, 'loadJobs').mockResolvedValue(true);

    component.onSortEmit({ field: 'title', direction: 'ASC' });
    fixture.detectChanges();
    component.onSortEmit({ field: 'startDate', direction: 'DESC' });
    fixture.detectChanges();

    expect(component.sortBy()).toBe('startDate');
    expect(component.sortDirection()).toBe('DESC');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('should calculate page correctly when rows are missing in lazy load', async () => {
    const spy = vi.spyOn(component, 'loadJobs').mockResolvedValue(true);

    component.loadOnTableEmit({ first: 16, rows: undefined });
    fixture.detectChanges();
    expect(component.page()).toBe(Math.floor(16 / component.pageSize()));
    expect(spy).toHaveBeenCalledOnce();
  });

  it('should render one job-card per job when jobs exist', () => {
    component.jobs.set([
      {
        jobId: '1',
        title: 'A',
        professorName: 'P1',
        location: JobLocationEnum.Heilbronn,
        subjectArea: DropdownOptions.subjectAreas[0].value,
      },
      {
        jobId: '2',
        title: 'B',
        professorName: 'P2',
        location: JobLocationEnum.Heilbronn,
        subjectArea: DropdownOptions.subjectAreas[0].value,
      },
    ]);
    fixture.detectChanges();

    const cards = fixture.debugElement.queryAll(By.directive(JobCardComponent));
    expect(cards.length).toBe(2);
  });

  it('should pass NotYetApplied when applicationState is undefined', () => {
    component.jobs.set([
      {
        jobId: '1',
        title: 'A',
        professorName: 'P1',
        location: JobLocationEnum.Heilbronn,
        subjectArea: DropdownOptions.subjectAreas[0].value,
        applicationState: undefined,
      },
    ]);
    fixture.detectChanges();

    const cardDE = fixture.debugElement.query(By.directive(JobCardComponent));
    const child = cardDE.componentInstance as JobCardComponent;

    expect(child.applicationState()).toBe(ApplicationStatusExtended.NotYetApplied);
  });

  it('should use relativeTimeEnglish for EN and relativeTimeGerman after switching to DE', () => {
    component.jobs.set([
      {
        jobId: '1',
        title: 'A',
        professorName: 'P1',
        location: JobLocationEnum.Garching,
        subjectArea: DropdownOptions.subjectAreas[0].value,
        relativeTimeEnglish: '2 days ago',
        relativeTimeGerman: 'vor 2 Tagen',
      },
    ]);
    fixture.detectChanges();

    // initial EN
    let cardDE = fixture.debugElement.query(By.directive(JobCardComponent));
    let child = cardDE.componentInstance as JobCardComponent;
    expect(child.relativeTime()).toBe('2 days ago');

    // switch to German
    const translate = TestBed.inject(TranslateService) as Partial<TranslateService & { currentLang?: string }>;
    (translate as TranslateService).use('de');
    fixture.detectChanges();

    cardDE = fixture.debugElement.query(By.directive(JobCardComponent));
    child = cardDE.componentInstance as JobCardComponent;
    expect(child.relativeTime()).toBe('vor 2 Tagen');
  });

  it('should compute page 0 when first is undefined but rows is defined (lazy load)', async () => {
    const spy = vi.spyOn(component, 'loadJobs').mockResolvedValue(true);
    component.page.set(5);
    component.loadOnTableEmit({ rows: 20 });
    fixture.detectChanges();
    expect(component.page()).toBe(0);
    expect(component.pageSize()).toBe(20);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('should default initial language to EN when translateService.currentLang is undefined', () => {
    // Grab the mock that provideTranslateMock already gave us
    const translate = TestBed.inject(TranslateService) as Partial<TranslateService & { currentLang?: string }>;

    // Override currentLang for this test
    translate.currentLang = undefined;

    // Recreate the component so constructor logic runs again
    const fixture2 = TestBed.createComponent(JobCardListComponent);
    const component2 = fixture2.componentInstance;
    fixture2.detectChanges();

    expect(component2.currentLanguage()).toBe('EN');
  });

  it('should navigate to notification settings through the Angular router', async () => {
    const router = TestBed.inject(Router);
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture.detectChanges();
    const link = getRequiredAnchor(fixture.nativeElement, '[data-testid="notifications-settings-link"]');

    expect(link.getAttribute('href')).toContain('/settings?tab=notifications');

    link.click();
    await fixture.whenStable();

    expect(navigateByUrlSpy).toHaveBeenCalledOnce();
    const navigationTarget = navigateByUrlSpy.mock.calls[0][0];
    const serializedTarget = typeof navigationTarget === 'string' ? navigationTarget : router.serializeUrl(navigationTarget);
    expect(serializedTarget).toBe('/settings?tab=notifications');
  });
});
