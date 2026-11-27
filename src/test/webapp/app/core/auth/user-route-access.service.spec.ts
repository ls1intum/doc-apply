import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { UserRouteAccessService } from 'app/core/auth/user-route-access.service';
import { IdpProvider } from 'app/core/auth/keycloak-authentication.service';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';
import { AccountServiceMock, createAccountServiceMock, provideAccountServiceMock } from '../../../util/account.service.mock';
import { AuthDialogServiceMock, createAuthDialogServiceMock, provideAuthDialogServiceMock } from '../../../util/auth-dialog.service.mock';
import { AuthFacadeServiceMock, createAuthFacadeServiceMock, provideAuthFacadeServiceMock } from '../../../util/auth-facade.service.mock';
import { provideRouterMock } from '../../../util/router.mock';

describe('UserRouteAccessService', () => {
  let accountService: AccountServiceMock;
  let authDialogService: AuthDialogServiceMock;
  let authFacade: AuthFacadeServiceMock;

  beforeEach(() => {
    accountService = createAccountServiceMock(false);
    authDialogService = createAuthDialogServiceMock();
    authFacade = createAuthFacadeServiceMock();

    TestBed.configureTestingModule({
      providers: [
        provideAccountServiceMock(accountService),
        provideAuthDialogServiceMock(authDialogService),
        provideAuthFacadeServiceMock(authFacade),
        provideRouterMock(),
      ],
    });
  });

  /**
   * Runs the guard for a route that requires the given roles.
   *
   * @param authorities the roles the route requires
   * @param url the requested URL
   * @returns what the guard returned
   */
  async function activate(authorities: UserShortDTORolesEnum[], url: string): Promise<unknown> {
    const route = new ActivatedRouteSnapshot();
    route.data = { authorities };
    const state: RouterStateSnapshot = Object.assign(Object.create(RouterStateSnapshot.prototype), { url });
    return TestBed.runInInjectionContext(() => UserRouteAccessService(route, state));
  }

  it.each([
    ['/settings?tab=notifications', [UserShortDTORolesEnum.Admin, UserShortDTORolesEnum.Professor, UserShortDTORolesEnum.Applicant], true],
    ['/interview-booking/process-1', [UserShortDTORolesEnum.Applicant], false],
  ])('should open the login dialog and keep the target URL when a signed-out user opens %s', async (url, authorities, offerTumLogin) => {
    const result = await activate(authorities, url);

    expect(result).toBe(false);
    expect(authDialogService.open).toHaveBeenCalledExactlyOnceWith({ redirectUri: window.location.origin + url, offerTumLogin });
    expect(authFacade.loginWithProvider).not.toHaveBeenCalled();
  });

  it('should start the TUM login when a signed-out user opens a route that applicants cannot use', async () => {
    const result = await activate([UserShortDTORolesEnum.Professor, UserShortDTORolesEnum.Employee], '/my-positions');

    expect(result).toBe(false);
    expect(authFacade.loginWithProvider).toHaveBeenCalledExactlyOnceWith(IdpProvider.TUM, window.location.origin + '/my-positions');
    expect(authDialogService.open).not.toHaveBeenCalled();
  });
});
