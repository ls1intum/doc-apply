import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { IntervieweeCardComponent } from 'app/interview/interview-process-detail/interviewee-section/interviewee-card/interviewee-card.component';
import { IntervieweeDTO, IntervieweeDTOStateEnum } from 'app/generated/model/interviewee-dto';
import { provideTranslateMock } from 'util/translate.mock';
import { provideRouterMock, createRouterMock, RouterMock } from 'util/router.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';

const uncontactedInterviewee: IntervieweeDTO = {
  id: 'iee-1',
  applicationId: 'app-1',
  state: IntervieweeDTOStateEnum.Uncontacted,
  user: {
    userId: 'user-1',
    firstName: 'Alice',
    lastName: 'Mueller',
    email: 'alice@example.com',
    avatar: '/img/alice.jpg',
  },
};

const scheduledInterviewee: IntervieweeDTO = {
  id: 'iee-2',
  applicationId: 'app-2',
  state: IntervieweeDTOStateEnum.Scheduled,
  user: {
    userId: 'user-2',
    firstName: 'Bob',
    lastName: 'Schmidt',
    email: 'bob@example.com',
  },
  scheduledSlot: {
    id: 'slot-1',
    startDateTime: '2026-03-20T14:00:00',
    endDateTime: '2026-03-20T15:00:00',
    location: 'Room 303',
  },
};

const virtualInterviewee: IntervieweeDTO = {
  id: 'iee-3',
  applicationId: 'app-3',
  state: IntervieweeDTOStateEnum.Scheduled,
  user: {
    userId: 'user-3',
    firstName: 'Charlie',
    lastName: 'Brown',
    email: 'charlie@example.com',
  },
  scheduledSlot: {
    id: 'slot-2',
    startDateTime: '2026-03-20T14:00:00',
    endDateTime: '2026-03-20T15:00:00',
    location: 'virtual',
  },
};

describe('IntervieweeCardComponent', () => {
  let fixture: ComponentFixture<IntervieweeCardComponent>;
  let component: IntervieweeCardComponent;
  let routerMock: RouterMock;

  beforeEach(async () => {
    routerMock = createRouterMock();

    await TestBed.configureTestingModule({
      imports: [IntervieweeCardComponent],
      providers: [provideTranslateMock(), provideRouterMock(routerMock), provideFontAwesomeTesting()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(IntervieweeCardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Computed Properties', () => {
    it('should compute full name and avatar URL from user', () => {
      fixture.componentRef.setInput('interviewee', uncontactedInterviewee);
      fixture.componentRef.setInput('processId', 'proc-1');
      fixture.detectChanges();

      expect(component.fullName()).toContain('Alice');
      expect(component.fullName()).toContain('Mueller');
      expect(component.avatarUrl()).toBe('/img/alice.jpg');
    });

    it.each([
      { description: 'scheduled interviewee with slot', interviewee: scheduledInterviewee, expected: 'Room 303' },
      { description: 'uncontacted interviewee without slot', interviewee: uncontactedInterviewee, expected: '' },
    ])('should compute location="$expected" for $description', ({ interviewee, expected }) => {
      fixture.componentRef.setInput('interviewee', interviewee);
      fixture.componentRef.setInput('processId', 'proc-1');
      fixture.detectChanges();

      expect(component.location()).toBe(expected);
    });

    it.each([
      { description: 'virtual location', interviewee: virtualInterviewee, expected: true },
      { description: 'physical location', interviewee: scheduledInterviewee, expected: false },
    ])('should compute isVirtual=$expected for $description', ({ interviewee, expected }) => {
      fixture.componentRef.setInput('interviewee', interviewee);
      fixture.componentRef.setInput('processId', 'proc-1');
      fixture.detectChanges();

      expect(component.isVirtual()).toBe(expected);
    });
  });

  describe('Navigation', () => {
    it('should navigate to assessment page', () => {
      fixture.componentRef.setInput('interviewee', uncontactedInterviewee);
      fixture.componentRef.setInput('processId', 'proc-1');
      fixture.detectChanges();

      component.navigateToAssessment();

      expect(routerMock.navigate).toHaveBeenCalledOnce();
      expect(routerMock.navigate).toHaveBeenCalledWith(['/interviews', 'process', 'proc-1', 'interviewee', 'iee-1', 'assessment']);
    });
  });

  describe('Cancel Interview', () => {
    it('should emit cancelInterview with interviewee and stop propagation', () => {
      fixture.componentRef.setInput('interviewee', scheduledInterviewee);
      fixture.componentRef.setInput('processId', 'proc-1');
      fixture.detectChanges();

      const emitSpy = vi.spyOn(component.cancelInterview, 'emit');
      const mockEvent = { stopPropagation: vi.fn() } as unknown as Event;

      component.onCancelInterview(mockEvent);

      expect(mockEvent.stopPropagation).toHaveBeenCalledOnce();
      expect(emitSpy).toHaveBeenCalledOnce();
      expect(emitSpy).toHaveBeenCalledWith(scheduledInterviewee);
    });
  });

  describe('Invitation button', () => {
    it.each([
      { hasSlots: false, expected: 'interview.interviewees.invitation.noSlots.detail' },
      { hasSlots: true, expected: undefined },
    ])('should explain the disabled invitation button with "$expected" when hasSlots=$hasSlots', ({ hasSlots, expected }) => {
      fixture.componentRef.setInput('interviewee', uncontactedInterviewee);
      fixture.componentRef.setInput('processId', 'proc-1');
      fixture.componentRef.setInput('hasSlots', hasSlots);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('jhi-button .disabled-reason')?.textContent).toBe(expected);
    });
  });
});
