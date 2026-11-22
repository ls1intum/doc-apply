import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { ProfessorHeroSectionComponent } from 'app/shared/pages/professor-landing-page/professor-hero-section/professor-hero-section.component';
import { provideTranslateMock } from 'util/translate.mock';
import { AuthFacadeServiceMock, createAuthFacadeServiceMock, provideAuthFacadeServiceMock } from 'util/auth-facade.service.mock';
import { AccountServiceMock, createAccountServiceMock, provideAccountServiceMock } from 'util/account.service.mock';
import { createRouterMock, provideRouterMock, RouterMock } from 'util/router.mock';
import { IdpProvider } from 'app/core/auth/keycloak-authentication.service';
import { createDialogServiceMock, DialogServiceMock, provideDialogServiceMock } from 'util/dialog.service.mock';
import { OnboardingDialog } from 'app/shared/components/molecules/onboarding-dialog/onboarding-dialog';
import { onboardingDialogOptions } from 'app/shared/constants/onboarding-dialog.constants';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';

describe('ProfessorHeroSectionComponent', () => {
  let fixture: ComponentFixture<ProfessorHeroSectionComponent>;
  let component: ProfessorHeroSectionComponent;
  let authFacadeServiceMock: AuthFacadeServiceMock;
  let accountServiceMock: AccountServiceMock;
  let routerMock: RouterMock;
  let dialogServiceMock: DialogServiceMock;

  const setupComponent = async (signedIn: boolean, authorities: UserShortDTORolesEnum[] = []) => {
    authFacadeServiceMock = createAuthFacadeServiceMock();
    accountServiceMock = createAccountServiceMock(signedIn);
    if (signedIn) {
      accountServiceMock.setAuthorities(authorities);
    }
    routerMock = createRouterMock();
    dialogServiceMock = createDialogServiceMock();

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ProfessorHeroSectionComponent],
      providers: [
        provideTranslateMock(),
        provideAuthFacadeServiceMock(authFacadeServiceMock),
        provideAccountServiceMock(accountServiceMock),
        provideRouterMock(routerMock),
        provideDialogServiceMock(dialogServiceMock),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProfessorHeroSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  describe('navigateToGetStarted', () => {
    it('should call loginWithProvider when user is not signed in', async () => {
      await setupComponent(false);

      await component.navigateToGetStarted();

      expect(authFacadeServiceMock.loginWithProvider).toHaveBeenCalledWith(IdpProvider.TUM, '/my-positions');
      expect(routerMock.navigate).not.toHaveBeenCalled();
    });

    it.each([[UserShortDTORolesEnum.Professor], [UserShortDTORolesEnum.Employee]])(
      'should navigate to my-positions when signed in as %s',
      async role => {
        await setupComponent(true, [role]);

        await component.navigateToGetStarted();

        expect(routerMock.navigate).toHaveBeenCalledWith(['/my-positions']);
        expect(authFacadeServiceMock.loginWithProvider).not.toHaveBeenCalled();
        expect(dialogServiceMock.open).not.toHaveBeenCalled();
      },
    );

    it('should open the onboarding dialog when signed in but not professor or employee', async () => {
      await setupComponent(true, []);

      await component.navigateToGetStarted();

      expect(dialogServiceMock.open).toHaveBeenCalledWith(OnboardingDialog, onboardingDialogOptions('onboarding.title'));
      expect(routerMock.navigate).not.toHaveBeenCalled();
      expect(authFacadeServiceMock.loginWithProvider).not.toHaveBeenCalled();
    });
  });
});
