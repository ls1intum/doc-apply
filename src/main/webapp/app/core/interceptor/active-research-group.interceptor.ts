import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { AccountService } from 'app/core/auth/account.service';

/**
 * Attaches the X-Active-Research-Group-Id header to outbound API requests so
 * the server can scope research-group-aware queries to the user's currently
 * selected membership.
 *
 * The header is added only for `/api/` requests and only when the user has a
 * resolved active research group. Other requests (static assets, third-party
 * calls) are unaffected.
 *
 * @param request outgoing HTTP request
 * @param next next handler in the interceptor chain
 * @returns the (potentially augmented) response stream
 */
export const activeResearchGroupInterceptor: HttpInterceptorFn = (request: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const accountService = inject(AccountService);

  const activeId = accountService.activeResearchGroupId();
  if (activeId !== undefined && request.url.startsWith('/api/')) {
    return next(request.clone({ setHeaders: { 'X-Active-Research-Group-Id': activeId } }));
  }
  return next(request);
};
