import { HttpErrorResponse } from '@angular/common/http';

/**
 * Error code the server returns when an action breaks a business rule, for example a second access request while
 * the first one is still pending.
 */
export const OPERATION_NOT_ALLOWED_ERROR_CODE = 'OPERATION_NOT_ALLOWED';

/** Error code the server returns when a user would join a research group while already belonging to one. */
export const ALREADY_MEMBER_ERROR_CODE = 'ALREADY_MEMBER_OF_RESEARCH_GROUP';

/**
 * Reads the error code that the server puts into the body of every handled error.
 *
 * @param error the error thrown by a generated API call
 * @returns the error code, or undefined when the error carries none
 */
export function getApiErrorCode(error: unknown): string | undefined {
  if (!(error instanceof HttpErrorResponse)) {
    return undefined;
  }
  const body: unknown = error.error;
  if (body instanceof Object && 'errorCode' in body && typeof body.errorCode === 'string') {
    return body.errorCode;
  }
  return undefined;
}
