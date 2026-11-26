import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { of, throwError } from 'rxjs';

import { IntervieweeAssessmentComponent } from 'app/interview/interviewee-assessment/interviewee-assessment.component';
import { InterviewResourceApi } from 'app/generated/api/interview-resource-api';
import { IntervieweeDetailDTO } from 'app/generated/model/interviewee-detail-dto';
import { RecommendationDecision } from 'app/generated/model/recommendation-decision';
import { IntervieweeDTOStateEnum } from 'app/generated/model/interviewee-dto';
import { ApplicationDetailDTOApplicationStateEnum } from 'app/generated/model/application-detail-dto';
import { provideTranslateMock } from 'util/translate.mock';
import { provideRouterMock, createRouterMock, RouterMock } from 'util/router.mock';
import { createActivatedRouteMock, provideActivatedRouteMock, ActivatedRouteMock } from 'util/activated-route.mock';
import { provideToastServiceMock, createToastServiceMock, ToastServiceMock } from 'util/toast-service.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';

const intervieweeDetail: IntervieweeDetailDTO = {
  id: 'iee-1',
  applicationId: 'app-1',
  state: IntervieweeDTOStateEnum.Scheduled,
  rating: RecommendationDecision.StrongPass,
  assessmentNotes: 'Good candidate',
  user: {
    userId: 'user-1',
    firstName: 'Alice',
    lastName: 'Mueller',
    email: 'alice@example.com',
    avatar: '/img/alice.jpg',
  },
  application: {
    applicationId: 'app-1',
    applicationState: ApplicationDetailDTOApplicationStateEnum.Sent,
    jobId: 'job-1',
    researchGroup: 'Applied Software Engineering',
    supervisingProfessorName: 'Prof. Test',
    motivation: 'I love this role',
    specialSkills: 'Angular, TypeScript',
    projects: 'Built a CMS',
    applicant: {
      masterDegreeName: 'Computer Science',
      masterUniversity: 'TU Munich',
      user: {
        userId: 'user-1',
        name: 'Alice Mueller',
        email: 'alice@example.com',
      },
    },
  },
  scheduledSlot: {
    id: 'slot-1',
    startDateTime: '2026-03-20T14:00:00',
    endDateTime: '2026-03-20T15:00:00',
    location: 'Room 303',
  },
};

const intervieweeWithoutOptionals: IntervieweeDetailDTO = {
  id: 'iee-2',
  applicationId: 'app-2',
  state: IntervieweeDTOStateEnum.Uncontacted,
};

describe('IntervieweeAssessmentComponent', () => {
  let fixture: ComponentFixture<IntervieweeAssessmentComponent>;
  let component: IntervieweeAssessmentComponent;
  let mockInterviewService: Partial<InterviewResourceApi>;
  let toastMock: ToastServiceMock;
  let routerMock: RouterMock;
  let activatedRouteMock: ActivatedRouteMock;

  function createComponent(): void {
    fixture = TestBed.createComponent(IntervieweeAssessmentComponent);
    component = fixture.componentInstance;
  }

  function configureTestBed(): Promise<void> {
    return TestBed.configureTestingModule({
      imports: [IntervieweeAssessmentComponent],
      providers: [
        provideTranslateMock(),
        provideRouterMock(routerMock),
        provideActivatedRouteMock(activatedRouteMock),
        provideToastServiceMock(toastMock),
        provideFontAwesomeTesting(),
        { provide: InterviewResourceApi, useValue: mockInterviewService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  }

  beforeEach(async () => {
    mockInterviewService = {
      getIntervieweeDetails: vi.fn().mockReturnValue(of(intervieweeDetail)),
      updateAssessment: vi.fn().mockReturnValue(of(intervieweeDetail)),
    };
    toastMock = createToastServiceMock();
    routerMock = createRouterMock();
    activatedRouteMock = createActivatedRouteMock({ processId: 'proc-1', intervieweeId: 'iee-1' });

    await configureTestBed();
    createComponent();
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Data Loading', () => {
    it('should load interviewee details on init', () => {
      expect(mockInterviewService.getIntervieweeDetails).toHaveBeenCalledOnce();
      expect(mockInterviewService.getIntervieweeDetails).toHaveBeenCalledWith('proc-1', 'iee-1');
      expect(component['loading']()).toBe(false);
      expect(component['interviewee']()).toBe(intervieweeDetail);
    });

    it('should set error signal on 404', async () => {
      (mockInterviewService.getIntervieweeDetails as ReturnType<typeof vi.fn>).mockReturnValue(throwError(() => ({ status: 404 })));

      createComponent();
      await fixture.whenStable();

      expect(component['error']()).toBe('interview.assessment.error.notFound');
      expect(routerMock.navigate).not.toHaveBeenCalled();
    });

    it('should show error toast and navigate to overview on 403', async () => {
      (mockInterviewService.getIntervieweeDetails as ReturnType<typeof vi.fn>).mockReturnValue(throwError(() => ({ status: 403 })));

      createComponent();
      await fixture.whenStable();

      expect(toastMock.showErrorKey).toHaveBeenCalledWith('interview.assessment.error.loadFailed');
      expect(routerMock.navigate).toHaveBeenCalledWith(['/interviews/overview']);
    });

    it('should set error signal and show toast on generic error', async () => {
      (mockInterviewService.getIntervieweeDetails as ReturnType<typeof vi.fn>).mockReturnValue(throwError(() => ({ status: 500 })));

      createComponent();
      await fixture.whenStable();

      expect(component['error']()).toBe('interview.assessment.error.loadFailed');
      expect(toastMock.showErrorKey).toHaveBeenCalledWith('interview.assessment.error.loadFailed');
    });
  });

  it('should compute properties from loaded data', () => {
    expect(component['applicantAvatar']()).toBe('/img/alice.jpg');
    expect(component['degreeName']()).toBe('Computer Science');
    expect(component['universityName']()).toBe('TU Munich');
    expect(component['motivation']()).toBe('I love this role');
    expect(component['skills']()).toBe('Angular, TypeScript');
    expect(component['interests']()).toBe('Built a CMS');
    expect(component['applicationId']()).toBe('app-1');
    expect(component['applicantName']()).toContain('Alice');
    expect(component['slotInfo']()?.location).toBe('Room 303');
  });

  it('should default computed properties when data is missing', async () => {
    (mockInterviewService.getIntervieweeDetails as ReturnType<typeof vi.fn>).mockReturnValue(of(intervieweeWithoutOptionals));
    TestBed.resetTestingModule();
    await configureTestBed();
    createComponent();
    await fixture.whenStable();

    expect(component['applicantName']()).toBe('');
    expect(component['applicantAvatar']()).toBeUndefined();
    expect(component['degreeName']()).toBe('');
    expect(component['universityName']()).toBe('');
    expect(component['motivation']()).toBe('');
    expect(component['skills']()).toBe('');
    expect(component['interests']()).toBe('');
    expect(component['savedNotes']()).toBe('');
  });

  describe('Auto-save Notes', () => {
    it('should only schedule a save after the notes are edited', async () => {
      expect(component['autoSave'].hasPending()).toBe(false);

      component['notesControl'].setValue('Edited notes');
      await fixture.whenStable();

      expect(component['autoSave'].hasPending()).toBe(true);
      component['autoSave'].dispose();
    });

    it('should persist updated notes and resolve to true', async () => {
      component['notesControl'].setValue('Updated notes');
      const saved = await component['persistNotes']();

      expect(mockInterviewService.updateAssessment).toHaveBeenCalledOnce();
      expect(mockInterviewService.updateAssessment).toHaveBeenCalledWith('proc-1', 'iee-1', { notes: 'Updated notes' });
      expect(saved).toBe(true);
    });

    it('should show error toast and resolve to false when saving notes fails', async () => {
      (mockInterviewService.updateAssessment as ReturnType<typeof vi.fn>).mockReturnValue(throwError(() => new Error('fail')));

      component['notesControl'].setValue('New notes');
      const saved = await component['persistNotes']();

      expect(toastMock.showErrorKey).toHaveBeenCalledWith('interview.assessment.error.saveFailed');
      expect(saved).toBe(false);
    });

    it('should not call the assessment endpoint when processId is empty', async () => {
      activatedRouteMock = createActivatedRouteMock({ processId: '', intervieweeId: '' });
      TestBed.resetTestingModule();
      await configureTestBed();
      createComponent();
      await fixture.whenStable();

      const saved = await component['persistNotes']();

      expect(mockInterviewService.updateAssessment).not.toHaveBeenCalled();
      expect(saved).toBe(false);
    });
  });

  describe('Navigation', () => {
    it('should navigate to process detail page on goBack', () => {
      component.goBack();

      expect(routerMock.navigate).toHaveBeenCalledOnce();
      expect(routerMock.navigate).toHaveBeenCalledWith(['/interviews', 'proc-1']);
    });

    it('should navigate to overview when from=overview query param is set', async () => {
      activatedRouteMock = createActivatedRouteMock({ processId: 'proc-1', intervieweeId: 'iee-1' }, { from: 'overview' });
      TestBed.resetTestingModule();
      await configureTestBed();
      createComponent();
      await fixture.whenStable();

      component.goBack();

      expect(routerMock.navigate).toHaveBeenCalledOnce();
      expect(routerMock.navigate).toHaveBeenCalledWith(['/interviews/overview']);
    });

    it('should navigate to overview when processId is empty', async () => {
      activatedRouteMock = createActivatedRouteMock({ processId: '', intervieweeId: 'iee-1' });
      TestBed.resetTestingModule();
      await configureTestBed();
      createComponent();
      await fixture.whenStable();

      component.goBack();

      expect(routerMock.navigate).toHaveBeenCalledWith(['/interviews/overview']);
    });
  });

  describe('Rating', () => {
    it('should initialize rating from loaded data', () => {
      expect(component['rating']()).toBe(RecommendationDecision.StrongPass);
    });

    it('should show error toast and revert rating when save fails', async () => {
      (mockInterviewService.updateAssessment as ReturnType<typeof vi.fn>).mockReturnValue(throwError(() => new Error('fail')));

      component['rating'].set(RecommendationDecision.SoftFail);
      await fixture.whenStable();

      expect(toastMock.showErrorKey).toHaveBeenCalledWith('interview.assessment.error.saveFailed');
      expect(component['rating']()).toBe(RecommendationDecision.StrongPass);
    });
  });
});
