import { HttpInterceptorFn } from '@angular/common/http';

import { activeResearchGroupInterceptor } from './active-research-group.interceptor';
import { authInterceptor } from './auth.interceptor';
import { errorHandlerInterceptor } from './error-handler.interceptor';
import { notificationInterceptor } from './notification.interceptor';

export const httpInterceptors: HttpInterceptorFn[] = [
  authInterceptor,
  activeResearchGroupInterceptor,
  errorHandlerInterceptor,
  notificationInterceptor,
];
