import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';
import { AiConsentModalComponent } from 'app/shared/settings/ai-consent-settings/ai-consent-modal/ai-consent-modal.component';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideTranslateMock } from 'util/translate.mock';

describe('AiConsentModalComponent', () => {
  it.each([
    [
      UserShortDTORolesEnum.Applicant,
      true,
      'settings.aiFeatures.modal.scope.applicant',
      'settings.aiFeatures.modal.consent.descriptionSettings',
    ],
    [
      UserShortDTORolesEnum.Professor,
      false,
      'settings.aiFeatures.modal.scope.professorOrEmployee',
      'settings.aiFeatures.modal.consent.description',
    ],
  ])('should explain the scope for %s and the consent with settings=%s', (role, settings, scopeKey, consentKey) => {
    TestBed.configureTestingModule({
      imports: [AiConsentModalComponent],
      providers: [provideTranslateMock(), provideFontAwesomeTesting()],
    });
    const fixture = TestBed.createComponent(AiConsentModalComponent);
    fixture.componentRef.setInput('visible', false);
    fixture.componentRef.setInput('currentRole', role);
    fixture.componentRef.setInput('settings', settings);

    expect(fixture.componentInstance.points().map(point => point.descriptionKey)).toEqual([
      'settings.aiFeatures.modal.processing.description',
      scopeKey,
      consentKey,
    ]);
  });
});
