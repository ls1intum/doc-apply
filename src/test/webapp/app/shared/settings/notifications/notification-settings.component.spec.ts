import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';
import { NotificationSettingsComponent, NotificationGroup } from 'app/shared/settings/notifications/notification-settings.component';
import { EmailSettingResourceApi } from 'app/generated/api/email-setting-resource-api';
import { createToastServiceMock, provideToastServiceMock } from '../../../../util/toast-service.mock';
import { provideTranslateMock } from '../../../../util/translate.mock';
import { JobCardDTOSubjectAreaEnum as ApplicantSubjectAreaSubscriptionsEnum } from 'app/generated/model/job-card-dto';
import { EmailSettingDTO, EmailSettingDTOEmailTypeEnum } from 'app/generated/model/email-setting-dto';
import { createApplicantResourceApiMock, provideApplicantResourceApiMock } from 'util/applicant-resource-api.service.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';

const RolesEnum = UserShortDTORolesEnum;
const EmailTypeEnum = EmailSettingDTOEmailTypeEnum;
const SubjectAreaEnum = ApplicantSubjectAreaSubscriptionsEnum;

describe('NotificationSettingsComponent', () => {
  let fixture: ComponentFixture<NotificationSettingsComponent>;
  let component: NotificationSettingsComponent;
  let subjectAreaSubscriptions: () => NotificationSettingsComponent['subjectAreaSubscriptions'];
  let getSubmissionGroup: () => NotificationGroup;
  let setRoleAndWaitForLoad: (role: UserShortDTORolesEnum) => Promise<void>;

  const emailSettingServiceMock = {
    getEmailSettings: vi.fn(),
    updateEmailSettings: vi.fn(),
  };

  const applicantApiMock = createApplicantResourceApiMock();
  const toastServiceMock = createToastServiceMock();
  const createComponent = () => {
    fixture = TestBed.createComponent(NotificationSettingsComponent);
    component = fixture.componentInstance;

    const waitForLoaded = async () => {
      for (let attempts = 0; attempts < 5; attempts += 1) {
        await fixture.whenStable();
        fixture.detectChanges();
        if (component['loaded']()) {
          return;
        }
        await Promise.resolve();
      }
      throw new Error('Expected notification settings to finish loading');
    };

    subjectAreaSubscriptions = () => component['subjectAreaSubscriptions'];
    getSubmissionGroup = () => {
      const groups = component['roleSettings']().get(RolesEnum.Applicant) ?? [];
      const group = groups.find(entry => entry.groupKey.includes('submission'));
      if (!group) {
        throw new Error('Expected applicant submission notification group');
      }
      return group;
    };
    setRoleAndWaitForLoad = async (role: UserShortDTORolesEnum) => {
      fixture.componentRef.setInput('currentRole', role);
      fixture.detectChanges();
      await waitForLoaded();
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      imports: [NotificationSettingsComponent],
      providers: [
        { provide: EmailSettingResourceApi, useValue: emailSettingServiceMock },
        provideApplicantResourceApiMock(applicantApiMock),
        provideFontAwesomeTesting(),
        provideToastServiceMock(toastServiceMock),
        provideTranslateMock(),
      ],
    });

    createComponent();
  });

  describe('loadSettings', () => {
    it('should mark groups enabled when all relevant types are enabled', async () => {
      emailSettingServiceMock.getEmailSettings.mockReturnValue(
        of<EmailSettingDTO[]>([
          { emailType: EmailTypeEnum.ApplicationSent, enabled: true },
          { emailType: EmailTypeEnum.ApplicationWithdrawn, enabled: true },
        ]),
      );
      applicantApiMock.getSubjectAreaSubscriptions.mockReturnValue(of([]));

      await component.loadSettings(RolesEnum.Applicant);

      const groups = component['roleSettings']().get(RolesEnum.Applicant) ?? [];
      expect(groups.every(group => group.enabled)).toBe(true);
      expect(component['loaded']()).toBe(true);
    });

    it.each([
      [false, false],
      [undefined, true],
    ])('should treat ApplicationSent enabled=%s as group.enabled=%s', async (enabled, expected) => {
      emailSettingServiceMock.getEmailSettings.mockReturnValue(
        of<EmailSettingDTO[]>([
          { emailType: EmailTypeEnum.ApplicationSent, enabled },
          { emailType: EmailTypeEnum.ApplicationWithdrawn, enabled: true },
        ]),
      );
      applicantApiMock.getSubjectAreaSubscriptions.mockReturnValue(of([]));

      await component.loadSettings(RolesEnum.Applicant);

      expect(getSubmissionGroup().enabled).toBe(expected);
    });

    it('should show error toast and still mark loaded on service failure', async () => {
      emailSettingServiceMock.getEmailSettings.mockReturnValue(throwError(() => new Error('fail')));
      applicantApiMock.getSubjectAreaSubscriptions.mockReturnValue(of([]));

      await component.loadSettings(RolesEnum.Applicant);

      expect(toastServiceMock.showErrorKey).toHaveBeenCalledWith('settings.notifications.loadFailed');
      expect(component['loaded']()).toBe(true);
    });

    it('should load and sort subject area subscriptions for applicants only', async () => {
      emailSettingServiceMock.getEmailSettings.mockReturnValue(
        of<EmailSettingDTO[]>([{ emailType: EmailTypeEnum.JobPublishedSubjectArea, enabled: false }]),
      );
      applicantApiMock.getSubjectAreaSubscriptions.mockReturnValue(of([SubjectAreaEnum.Mathematics, SubjectAreaEnum.ComputerScience]));

      await component.loadSettings(RolesEnum.Applicant);

      expect(subjectAreaSubscriptions().selected()).toEqual([SubjectAreaEnum.ComputerScience, SubjectAreaEnum.Mathematics]);
      expect(component['subjectAreaNotificationsEnabled']()).toBe(false);
    });

    it('should clear subject area subscriptions for non-applicants and skip the API call', async () => {
      emailSettingServiceMock.getEmailSettings.mockReturnValue(of<EmailSettingDTO[]>([]));
      subjectAreaSubscriptions().selected.set([SubjectAreaEnum.ComputerScience]);

      await component.loadSettings(RolesEnum.Professor);

      expect(subjectAreaSubscriptions().selected()).toEqual([]);
      expect(applicantApiMock.getSubjectAreaSubscriptions).not.toHaveBeenCalled();
    });

    it.each([RolesEnum.Admin, RolesEnum.Employee])(
      'should ignore role-specific groups for %s, who has no configured groups',
      async role => {
        emailSettingServiceMock.getEmailSettings.mockReturnValue(
          of<EmailSettingDTO[]>([{ emailType: EmailTypeEnum.JobPublishedSubjectArea, enabled: false }]),
        );

        await component.loadSettings(role);

        expect(component['roleSettings']().has(role)).toBe(false);
        expect(component['loaded']()).toBe(true);
      },
    );
  });

  describe('template', () => {
    it('should render the applicant subject area notification section', async () => {
      emailSettingServiceMock.getEmailSettings.mockReturnValue(
        of<EmailSettingDTO[]>([{ emailType: EmailTypeEnum.JobPublishedSubjectArea, enabled: true }]),
      );
      applicantApiMock.getSubjectAreaSubscriptions.mockReturnValue(of([SubjectAreaEnum.ComputerScience]));

      await setRoleAndWaitForLoad(RolesEnum.Applicant);

      expect(fixture.nativeElement.textContent ?? '').toContain('settings.notifications.applicant.subjectAreas.title');
      expect(fixture.nativeElement.querySelector('jhi-subject-area-subscription-selector')).not.toBeNull();
    });

    it('should not render the subject area section for non-applicant roles', async () => {
      emailSettingServiceMock.getEmailSettings.mockReturnValue(of<EmailSettingDTO[]>([]));

      await setRoleAndWaitForLoad(RolesEnum.Professor);

      expect(fixture.nativeElement.textContent ?? '').not.toContain('settings.notifications.applicant.subjectAreas.title');
      expect(applicantApiMock.getSubjectAreaSubscriptions).not.toHaveBeenCalled();
    });
  });

  describe('onToggleChanged', () => {
    it('should call updateEmailSettings with correct payload', () => {
      const group: NotificationGroup = {
        groupKey: 'test',
        descriptionKey: 'desc',
        emailTypes: [EmailTypeEnum.ApplicationSent, EmailTypeEnum.ApplicationWithdrawn],
        enabled: true,
      };

      emailSettingServiceMock.updateEmailSettings.mockReturnValue(of(undefined));

      component.onToggleChanged(group);

      expect(emailSettingServiceMock.updateEmailSettings).toHaveBeenCalledOnce();
      expect(emailSettingServiceMock.updateEmailSettings).toHaveBeenCalledWith([
        { emailType: EmailTypeEnum.ApplicationSent, enabled: true },
        { emailType: EmailTypeEnum.ApplicationWithdrawn, enabled: true },
      ]);
    });

    it('should show error toast if update throws synchronously', () => {
      emailSettingServiceMock.updateEmailSettings.mockImplementation(() => {
        throw new Error('boom');
      });

      const group: NotificationGroup = {
        groupKey: 'test',
        descriptionKey: 'desc',
        emailTypes: [EmailTypeEnum.ApplicationAccepted],
        enabled: false,
      };

      component.onToggleChanged(group);

      expect(toastServiceMock.showErrorKey).toHaveBeenCalledOnce();
      expect(toastServiceMock.showErrorKey).toHaveBeenCalledWith('settings.notifications.saveFailed');
    });

    it('should reload the email notification groups when an update fails and a role is set', async () => {
      fixture.componentRef.setInput('currentRole', RolesEnum.Applicant);
      emailSettingServiceMock.updateEmailSettings.mockReturnValue(throwError(() => new Error('boom')));
      emailSettingServiceMock.getEmailSettings.mockReturnValue(of([]));
      const reloadSpy = vi.spyOn(component, 'loadEmailNotificationGroups').mockResolvedValue();

      component.onToggleChanged({
        groupKey: 'test',
        descriptionKey: 'desc',
        emailTypes: [EmailTypeEnum.ApplicationAccepted],
        enabled: false,
      });
      await Promise.resolve();

      expect(toastServiceMock.showErrorKey).toHaveBeenCalledWith('settings.notifications.saveFailed');
      expect(reloadSpy).toHaveBeenCalledWith(RolesEnum.Applicant);
    });
  });

  describe('onSubjectAreaToggleChanged', () => {
    it('should persist the subject area notification setting', () => {
      emailSettingServiceMock.updateEmailSettings.mockReturnValue(of(undefined));

      component.onSubjectAreaToggleChanged(false);

      expect(emailSettingServiceMock.updateEmailSettings).toHaveBeenCalledOnce();
      expect(emailSettingServiceMock.updateEmailSettings).toHaveBeenCalledWith([
        { emailType: EmailTypeEnum.JobPublishedSubjectArea, enabled: false },
      ]);
      expect(component['subjectAreaNotificationsEnabled']()).toBe(false);
    });

    it('should not clear selected subject areas when toggled off', () => {
      subjectAreaSubscriptions().selected.set([SubjectAreaEnum.ComputerScience, SubjectAreaEnum.Mathematics]);
      emailSettingServiceMock.updateEmailSettings.mockReturnValue(of(undefined));

      component.onSubjectAreaToggleChanged(false);

      expect(applicantApiMock.removeSubjectAreaSubscription).not.toHaveBeenCalled();
      expect(subjectAreaSubscriptions().selected()).toEqual([SubjectAreaEnum.ComputerScience, SubjectAreaEnum.Mathematics]);
    });

    it('should reload only when a role is set after a subject area toggle save failure', async () => {
      emailSettingServiceMock.updateEmailSettings.mockReturnValue(throwError(() => new Error('boom')));
      const reloadSpy = vi.spyOn(component, 'loadEmailNotificationGroups').mockResolvedValue();

      component.onSubjectAreaToggleChanged(false);
      await Promise.resolve();

      expect(toastServiceMock.showErrorKey).toHaveBeenCalledWith('settings.notifications.saveFailed');
      expect(reloadSpy).not.toHaveBeenCalled();

      fixture.componentRef.setInput('currentRole', RolesEnum.Applicant);
      component.onSubjectAreaToggleChanged(false);
      await Promise.resolve();

      expect(reloadSpy).toHaveBeenCalledWith(RolesEnum.Applicant);
    });
  });

  describe('roleEffect', () => {
    it('should trigger load only when a role is set', async () => {
      const spy = vi.spyOn(component, 'loadSettings').mockResolvedValue();

      fixture.componentRef.setInput('currentRole', undefined);
      fixture.detectChanges();
      expect(spy).not.toHaveBeenCalled();

      fixture.componentRef.setInput('currentRole', RolesEnum.Applicant);
      fixture.detectChanges();
      await Promise.resolve();

      expect(spy).toHaveBeenCalledWith(RolesEnum.Applicant);
    });
  });
});
