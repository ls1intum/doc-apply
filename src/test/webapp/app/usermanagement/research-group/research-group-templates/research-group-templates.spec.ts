import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResearchGroupTemplates } from 'app/usermanagement/research-group/research-group-templates/research-group-templates';
import { EmailTemplateResourceApi } from 'app/generated/api/email-template-resource-api';
import { EmailTemplateOverviewDTO, EmailTemplateOverviewDTOEmailTypeEnum } from 'app/generated/model/email-template-overview-dto';
import { createToastServiceMock, provideToastServiceMock, ToastServiceMock } from 'util/toast-service.mock';
import { provideAccountServiceMock } from 'util/account.service.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';
import { provideRouterMock } from 'util/router.mock';

class EmailTemplateResourceApiMock {
  getTemplates = vi.fn();
  deleteTemplate = vi.fn();
}

describe('ResearchGroupTemplates', () => {
  let api: EmailTemplateResourceApiMock;
  let toast: ToastServiceMock;

  beforeEach(() => {
    api = new EmailTemplateResourceApiMock();
    toast = createToastServiceMock();

    TestBed.configureTestingModule({
      imports: [ResearchGroupTemplates],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideFontAwesomeTesting(),
        provideRouterMock(),
        provideTranslateMock(),
        provideToastServiceMock(toast),
        provideAccountServiceMock(),
        { provide: EmailTemplateResourceApi, useValue: api },
      ],
    });
  });

  it('renders custom and default rows from a paged response', async () => {
    const rows: EmailTemplateOverviewDTO[] = [
      {
        emailTemplateId: 'id-1',
        emailType: EmailTemplateOverviewDTOEmailTypeEnum.ApplicationSent,
        isCustom: true,
        firstName: 'A',
        lastName: 'B',
      },
      {
        emailType: EmailTemplateOverviewDTOEmailTypeEnum.ApplicationAccepted,
        isCustom: false,
      },
    ];
    api.getTemplates.mockReturnValue(of({ content: rows, totalElements: 2 }));

    const fixture = TestBed.createComponent(ResearchGroupTemplates);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(api.getTemplates).toHaveBeenCalledWith(0, 10);
    expect(fixture.componentInstance['tableData']()).toHaveLength(2);
  });

  it('shows an error toast when loading fails', async () => {
    api.getTemplates.mockReturnValueOnce(throwError(() => new Error('boom')));

    const fixture = TestBed.createComponent(ResearchGroupTemplates);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(toast.showError).toHaveBeenCalledOnce();
  });

  it('delete reloads the list', async () => {
    api.getTemplates.mockReturnValue(of({ content: [], totalElements: 0 }));
    api.deleteTemplate.mockReturnValue(of(undefined));

    const fixture = TestBed.createComponent(ResearchGroupTemplates);
    fixture.detectChanges();
    await fixture.whenStable();
    api.getTemplates.mockClear();

    await fixture.componentInstance.delete('some-id');

    expect(api.deleteTemplate).toHaveBeenCalledWith('some-id');
    expect(api.getTemplates).toHaveBeenCalledOnce();
  });
});
