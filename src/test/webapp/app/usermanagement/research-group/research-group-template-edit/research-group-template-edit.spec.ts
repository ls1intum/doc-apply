import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResearchGroupTemplateEdit } from 'app/usermanagement/research-group/research-group-template-edit/research-group-template-edit';
import { EmailTemplateResourceApi } from 'app/generated/api/email-template-resource-api';
import { EmailTemplateDTOEmailTypeEnum } from 'app/generated/model/email-template-dto';
import { provideToastServiceMock } from 'util/toast-service.mock';
import { provideAccountServiceMock } from 'util/account.service.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';
import { provideRouterMock } from 'util/router.mock';
import { createActivatedRouteMock, provideActivatedRouteMock } from 'util/activated-route.mock';
import { createUserResourceApiMock, provideUserResourceApiMock } from 'util/user-resource-api.service.mock';

class EmailTemplateResourceApiMock {
  getTemplate = vi.fn();
  getTemplates = vi.fn();
  createTemplate = vi.fn();
  updateTemplate = vi.fn();
}

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

describe('ResearchGroupTemplateEdit', () => {
  let api: EmailTemplateResourceApiMock;

  beforeEach(() => {
    global.ResizeObserver = ResizeObserverMock;

    api = new EmailTemplateResourceApiMock();
    api.getTemplate.mockReturnValue(of({}));
    api.getTemplates.mockReturnValue(of({ content: [], totalElements: 0 }));
    const userApi = createUserResourceApiMock();
    userApi.getAiConsent.mockReturnValue(of(true));

    TestBed.configureTestingModule({
      imports: [ResearchGroupTemplateEdit],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideFontAwesomeTesting(),
        provideRouterMock(),
        provideActivatedRouteMock(createActivatedRouteMock()),
        provideTranslateMock(),
        provideToastServiceMock(),
        provideAccountServiceMock(),
        provideUserResourceApiMock(userApi),
        { provide: EmailTemplateResourceApi, useValue: api },
      ],
    });
  });

  it('should update emailType via setSelectedEmailType', () => {
    const fixture = TestBed.createComponent(ResearchGroupTemplateEdit);
    fixture.detectChanges();

    fixture.componentInstance.customizableEmailTypes.set([EmailTemplateDTOEmailTypeEnum.ApplicationSent]);
    fixture.componentInstance.setSelectedEmailType({ name: 'X', value: EmailTemplateDTOEmailTypeEnum.ApplicationSent });

    expect(fixture.componentInstance.formModel().emailType).toBe(EmailTemplateDTOEmailTypeEnum.ApplicationSent);
  });

  it('should update english subject via updateEnglishSubject', () => {
    const fixture = TestBed.createComponent(ResearchGroupTemplateEdit);
    fixture.detectChanges();

    fixture.componentInstance.updateEnglishSubject('Hello');

    expect(fixture.componentInstance.formModel().english?.subject).toBe('Hello');
  });

  it('should translate a language the author emptied again only after the other language changes', async () => {
    const fixture = TestBed.createComponent(ResearchGroupTemplateEdit);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    component.customizableEmailTypes.set([EmailTemplateDTOEmailTypeEnum.ApplicationSent]);
    component.setSelectedEmailType({ name: 'X', value: EmailTemplateDTOEmailTypeEnum.ApplicationSent });

    component.updateEnglishSubject('Your application');
    component.updateEnglishBody('<p>Thank you.</p>');
    expect(component.pendingTranslation()).toEqual({ source: 'english', target: 'german' });

    component.updateGermanSubject('Ihre');
    component.updateGermanSubject('');
    expect(component.pendingTranslation()).toBeUndefined();

    component.updateEnglishBody('<p>Thank you for applying.</p>');
    expect(component.pendingTranslation()).toEqual({ source: 'english', target: 'german' });
  });
});
