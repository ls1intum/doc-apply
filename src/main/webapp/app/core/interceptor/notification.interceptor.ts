import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs/operators';
import { AlertService } from 'app/core/util/alert.service';

/**
 * Surfaces server-side alerts attached to responses via `*app-alert` /
 * `*app-params` headers as success toasts.
 *
 * @param request outgoing HTTP request
 * @param next next handler in the interceptor chain
 * @returns the response stream, side-effecting on responses that carry alert headers
 */
export const notificationInterceptor: HttpInterceptorFn = (request: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const alertService = inject(AlertService);

  return next(request).pipe(
    tap((event: HttpEvent<unknown>) => {
      if (!(event instanceof HttpResponse)) {
        return;
      }

      let alert: string | undefined;
      let alertParams: string | undefined;

      for (const headerKey of event.headers.keys()) {
        if (headerKey.toLowerCase().endsWith('app-alert')) {
          alert = event.headers.get(headerKey) ?? undefined;
        } else if (headerKey.toLowerCase().endsWith('app-params')) {
          const raw = event.headers.get(headerKey);
          alertParams = raw === null ? undefined : decodeURIComponent(raw.replace(/\+/g, ' '));
        }
      }

      if (alert !== undefined) {
        alertService.addAlert({
          type: 'success',
          translationKey: alert,
          translationParams: { param: alertParams },
        });
      }
    }),
  );
};
