import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfessorFaqSectionComponent } from 'app/shared/pages/professor-landing-page/professor-faq-section/professor-faq-section.component';
import { provideTranslateMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideHttpClientMock } from 'util/http-client.mock';
import { createDialogServiceMock, DialogServiceMock, provideDialogServiceMock } from '../../../../../util/dialog.service.mock';
import { OnboardingDialog } from 'app/shared/components/molecules/onboarding-dialog/onboarding-dialog';

describe('ProfessorFaqSectionComponent', () => {
  let fixture: ComponentFixture<ProfessorFaqSectionComponent>;
  let component: ProfessorFaqSectionComponent;
  let mockDialogService: DialogServiceMock;

  beforeEach(async () => {
    mockDialogService = createDialogServiceMock();

    await TestBed.configureTestingModule({
      imports: [ProfessorFaqSectionComponent],
      providers: [
        provideTranslateMock(),
        provideFontAwesomeTesting(),
        provideHttpClientMock(),
        provideDialogServiceMock(mockDialogService),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfessorFaqSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('openRegistrationForm', () => {
    it('should open onboarding dialog with correct header', () => {
      const openSpy = vi.spyOn(mockDialogService, 'open');

      component.openRegistrationForm();

      expect(openSpy).toHaveBeenCalledOnce();
      const [componentType, config] = openSpy.mock.calls[0];
      expect(componentType).toBe(OnboardingDialog);
      expect(config).toMatchObject({
        header: 'onboarding.title',
      });
    });
  });
});
