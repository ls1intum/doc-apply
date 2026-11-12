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
});
