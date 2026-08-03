import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { AuthFacadeService } from '../auth/auth-facade.service';
import { KeycloakAuthenticationService } from '../auth/keycloak-authentication.service';

/**
 * Session-lifecycle endpoints (login, logout, refresh, otp-complete, ...) manage their own auth state, so a
 * 401 from them must not trigger the refresh-and-retry recovery below — that would loop or fight their own
 * handling.
 */
const isAuthEndpoint = (url: string): boolean => url.includes('/api/auth/');

/**
 * Attaches the Keycloak bearer token to every outgoing request. On a 401 it silently refreshes the active
 * session (app-issued cookie or Keycloak token) and replays the request once, logging out only if the
 * refresh — or the replay — still fails. This keeps a session alive up to the refresh token's lifetime
 * instead of dropping the user on the first expired access token.
 *
 * Implemented as a functional interceptor so its dependencies are resolved lazily per request — this avoids
 * a construction-time circular dependency between `HttpClient` and services that transitively depend on it
 * (e.g. `KeycloakAuthenticationService` → `AuthenticationResourceApi` → `HttpClient`).
 *
 * @param request outgoing HTTP request
 * @param next next handler in the interceptor chain
 * @returns the (potentially augmented) response stream
 */
export const authInterceptor: HttpInterceptorFn = (request: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const keycloakService = inject(KeycloakAuthenticationService);
  const authFacade = inject(AuthFacadeService);

  const withBearer = (req: HttpRequest<unknown>): HttpRequest<unknown> => {
    const token = keycloakService.getToken();
    return token !== undefined && token.length > 0 ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  };

  return next(withBearer(request)).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || isAuthEndpoint(request.url)) {
        return throwError(() => err);
      }
      // 1) The access token expired between proactive refreshes: refresh the active session once...
      return from(authFacade.refreshSession()).pipe(
        switchMap(refreshed => {
          if (!refreshed) {
            void authFacade.logout(true);
            return throwError(() => err);
          }
          // 2) ...then replay the original request with the fresh token; log out only if it still fails.
          return next(withBearer(request)).pipe(
            catchError((retryErr: HttpErrorResponse) => {
              if (retryErr.status === 401) {
                void authFacade.logout(true);
              }
              return throwError(() => retryErr);
            }),
          );
        }),
      );
    }),
  );
};
