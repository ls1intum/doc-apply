import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';

import { AccountService } from './account.service';
import { AuthFacadeService } from './auth-facade.service';
import { AuthDialogService } from './auth-dialog.service';
import { IdpProvider } from './keycloak-authentication.service';

/**
 * Lets the user open a route only with one of the roles the route lists in its data. A signed-out user is sent to
 * the login that fits the route: routes that applicants may open show the app's own login dialog, because applicants
 * sign in with their email address, while all other routes go straight to the TUM login.
 * Either way, the user returns to the requested URL, including its query parameters, after signing in.
 *
 * @param next the route that is being activated
 * @param state the router state with the requested URL
 * @returns whether the route may be activated
 */
export const UserRouteAccessService: CanActivateFn = async (next: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const router = inject(Router);
  const accountService = inject(AccountService);
  const authFacade = inject(AuthFacadeService);
  const authDialogService = inject(AuthDialogService);

  const authorities: string[] = next.data['authorities'] ?? [];
  const publicRoute: boolean = authorities.length === 0;

  // If no roles required, allow access
  if (publicRoute) {
    return true;
  }

  // If route requires authentication and user is not logged in, trigger login
  if (!accountService.signedIn()) {
    const targetUrl = window.location.origin + state.url;

    if (authorities.includes(UserShortDTORolesEnum.Applicant)) {
      authDialogService.open({ redirectUri: targetUrl });
      return false;
    }

    await authFacade.loginWithProvider(IdpProvider.TUM, targetUrl);
    return false;
  }

  // if route requires authentication and user is logged in, check authorities
  if (accountService.hasAnyAuthority(authorities)) {
    return true;
  }

  console.warn('Access denied – missing roles:', authorities);
  await router.navigate(['/accessdenied']);
  return false;
};
