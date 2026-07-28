import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs/operators';
import { EventManager, EventWithContent } from 'app/core/util/event-manager.service';

/**
 * Broadcasts an `docApplyApp.httpError` event for any non-401 HTTP failure
 * (and 401s outside the account endpoint) so the global error handler can
 * surface them.
 *
 * @param request outgoing HTTP request
 * @param next next handler in the interceptor chain
 * @returns the response stream, side-effecting on errors
 */
export const errorHandlerInterceptor: HttpInterceptorFn = (request: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const eventManager = inject(EventManager);

  return next(request).pipe(
    tap({
      error(err: HttpErrorResponse) {
        const isAccountAuthError = err.status === 401 && (err.message === '' || err.url?.includes('api/account') === true);
        if (!isAccountAuthError) {
          eventManager.broadcast(new EventWithContent('docApplyApp.httpError', err));
        }
      },
    }),
  );
};
