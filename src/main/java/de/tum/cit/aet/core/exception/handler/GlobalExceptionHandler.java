package de.tum.cit.aet.core.exception.handler;

import de.tum.cit.aet.core.constants.ErrorCode;
import de.tum.cit.aet.core.dto.ApiError;
import de.tum.cit.aet.core.exception.*;
import de.tum.cit.aet.core.exception.errors.ValidationFieldError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.TypeMismatchException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * Global exception handler for all unhandled runtime and validation exceptions
 * in the application.
 * Provides consistent error responses to the client using ApiError structure
 * and error codes.
 */
@ControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private static final Map<Class<? extends Exception>, ExceptionMetadata> EXCEPTION_METADATA = Map.ofEntries(
        Map.entry(EntityNotFoundException.class, new ExceptionMetadata(HttpStatus.NOT_FOUND, ErrorCode.ENTITY_NOT_FOUND)),
        Map.entry(ResourceAlreadyExistsException.class, new ExceptionMetadata(HttpStatus.CONFLICT, ErrorCode.RESOURCE_ALREADY_EXISTS)),
        Map.entry(
            jakarta.persistence.OptimisticLockException.class,
            new ExceptionMetadata(HttpStatus.CONFLICT, ErrorCode.RESOURCE_ALREADY_EXISTS)
        ),
        Map.entry(
            org.springframework.orm.ObjectOptimisticLockingFailureException.class,
            new ExceptionMetadata(HttpStatus.CONFLICT, ErrorCode.RESOURCE_ALREADY_EXISTS)
        ),
        Map.entry(TimeConflictException.class, new ExceptionMetadata(HttpStatus.CONFLICT, ErrorCode.TIME_CONFLICT)),
        Map.entry(InvalidParameterException.class, new ExceptionMetadata(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_PARAMETER)),
        Map.entry(OperationNotAllowedException.class, new ExceptionMetadata(HttpStatus.BAD_REQUEST, ErrorCode.OPERATION_NOT_ALLOWED)),
        Map.entry(
            AlreadyMemberOfResearchGroupException.class,
            new ExceptionMetadata(HttpStatus.BAD_REQUEST, ErrorCode.OPERATION_NOT_ALLOWED)
        ),
        Map.entry(UploadException.class, new ExceptionMetadata(HttpStatus.BAD_REQUEST, ErrorCode.UPLOAD_FAILED)),
        Map.entry(AuthorizationDeniedException.class, new ExceptionMetadata(HttpStatus.FORBIDDEN, ErrorCode.ACCESS_DENIED)),
        Map.entry(EmailVerificationFailedException.class, new ExceptionMetadata(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED)),
        Map.entry(AccessDeniedException.class, new ExceptionMetadata(HttpStatus.FORBIDDEN, ErrorCode.ACCESS_DENIED)),
        Map.entry(UnauthorizedException.class, new ExceptionMetadata(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED)),
        Map.entry(
            org.springframework.security.oauth2.server.resource.InvalidBearerTokenException.class,
            new ExceptionMetadata(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED)
        ),
        Map.entry(InterviewProcessClosedException.class, new ExceptionMetadata(HttpStatus.FORBIDDEN, ErrorCode.INTERVIEW_PROCESS_CLOSED)),
        Map.entry(TooManyRequestsException.class, new ExceptionMetadata(HttpStatus.TOO_MANY_REQUESTS, ErrorCode.TOO_MANY_REQUESTS)),
        Map.entry(MailingException.class, new ExceptionMetadata(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.MAILING_ERROR)),
        Map.entry(InternalServerException.class, new ExceptionMetadata(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR)),
        Map.entry(UnknownImageTypeException.class, new ExceptionMetadata(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.UNKNOWN_IMAGE_TYPE)),
        Map.entry(
            HttpRequestMethodNotSupportedException.class,
            new ExceptionMetadata(HttpStatus.METHOD_NOT_ALLOWED, ErrorCode.INVALID_PARAMETER)
        ),
        Map.entry(
            HttpMediaTypeNotSupportedException.class,
            new ExceptionMetadata(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ErrorCode.INVALID_PARAMETER)
        ),
        Map.entry(HttpMessageNotReadableException.class, new ExceptionMetadata(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_PARAMETER))
    );

    /**
     * Handles all runtime exceptions and validation errors.
     * Maps them to appropriate HTTP responses and error codes.
     *
     * @param ex      the exception that was thrown
     * @param request the current HTTP request
     * @return a ResponseEntity with a structured ApiError body
     */
    @ExceptionHandler({ Exception.class })
    public ResponseEntity<Object> handleRuntime(Exception ex, HttpServletRequest request) {
        if (ex instanceof HandlerMethodValidationException hmve) {
            log.warn("Handled handler-method validation: {} - Path: {}", hmve.getMessage(), request.getRequestURI());
            return buildErrorResponse(
                HttpStatus.BAD_REQUEST,
                ErrorCode.VALIDATION_ERROR,
                ex,
                request.getRequestURI(),
                extractFieldErrors(hmve)
            );
        }
        if (ex instanceof MethodArgumentNotValidException manve) {
            log.warn("Handled validation exception: {} - Path: {}", ex.getClass().getSimpleName(), request.getRequestURI(), ex);
            return buildErrorResponse(
                HttpStatus.BAD_REQUEST,
                ErrorCode.VALIDATION_ERROR,
                ex,
                request.getRequestURI(),
                extractFieldErrors(manve)
            );
        }
        if (ex instanceof ConstraintViolationException cve) {
            log.warn("Handled constraint validation exception: {} - Path: {}", ex.getClass().getSimpleName(), request.getRequestURI(), ex);
            return buildErrorResponse(
                HttpStatus.BAD_REQUEST,
                ErrorCode.VALIDATION_ERROR,
                ex,
                request.getRequestURI(),
                extractFieldErrors(cve)
            );
        }
        if (ex instanceof MissingServletRequestParameterException msrpe) {
            log.warn("Handled missing servlet request parameter: {} - Path: {}", msrpe.getParameterName(), request.getRequestURI(), ex);

            return buildErrorResponse(
                HttpStatus.BAD_REQUEST,
                ErrorCode.VALIDATION_ERROR,
                ex,
                request.getRequestURI(),
                extractFieldErrors(msrpe)
            );
        }
        if (ex instanceof MethodArgumentTypeMismatchException mismatch) {
            log.warn("Argument type mismatch: {} - Path: {}", mismatch.getName(), request.getRequestURI(), ex);
            return buildErrorResponse(
                HttpStatus.BAD_REQUEST,
                ErrorCode.INVALID_PARAMETER,
                ex,
                request.getRequestURI(),
                List.of(new ValidationFieldError("request", mismatch.getName(), "Invalid value: " + mismatch.getValue()))
            );
        }
        if (ex instanceof TypeMismatchException mismatch) {
            log.warn("Type mismatch: {} - Path: {}", mismatch.getPropertyName(), request.getRequestURI(), ex);
            return buildErrorResponse(
                HttpStatus.BAD_REQUEST,
                ErrorCode.INVALID_PARAMETER,
                ex,
                request.getRequestURI(),
                List.of(new ValidationFieldError("request", mismatch.getPropertyName(), "Invalid value"))
            );
        }
        if (ex instanceof TemplateProcessingException tpe) {
            log.warn("Handled template processing exception: {} - Path: {}", tpe.getClass().getSimpleName(), request.getRequestURI(), ex);
            return buildErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.TEMPLATE_ERROR, ex, request.getRequestURI(), null);
        }
        if (ex instanceof MailingException me) {
            log.warn("Handled mailing exception: {} - Path: {}", me.getClass().getSimpleName(), request.getRequestURI(), ex);
            return buildErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.MAILING_ERROR, ex, request.getRequestURI(), null);
        }
        if (ex instanceof EmailSettingException ese) {
            log.warn("Handled mailing exception: {} - Path: {}", ese.getClass().getSimpleName(), request.getRequestURI(), ex);
            return buildErrorResponse(HttpStatus.BAD_REQUEST, ErrorCode.EMAIL_SETTING_ERROR, ex, request.getRequestURI(), null);
        }
        if (ex instanceof EmailTemplateException ete) {
            log.warn("Handled email template exception: {} - Path: {}", ete.getClass().getSimpleName(), request.getRequestURI(), ex);
            return buildErrorResponse(HttpStatus.BAD_REQUEST, ErrorCode.EMAIL_TEMPLATE_ERROR, ex, request.getRequestURI(), null);
        }
        if (ex instanceof EmailVerificationFailedException evfe) {
            log.info("Handled OTP verification failure - Path: {}", request.getRequestURI());
            return buildErrorResponse(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED, evfe, request.getRequestURI(), null);
        }
        if (ex instanceof InterviewProcessClosedException ipce) {
            log.info("Handled interview process closed exception - Path: {}", request.getRequestURI());
            return buildErrorResponse(HttpStatus.FORBIDDEN, ErrorCode.INTERVIEW_PROCESS_CLOSED, ipce, request.getRequestURI(), null);
        }
        if (ex instanceof BadRequestException bre) {
            log.info("Handled bad request exception - Path: {}", request.getRequestURI());
            return buildErrorResponse(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST, bre, request.getRequestURI(), null);
        }
        ExceptionMetadata metadata = EXCEPTION_METADATA.getOrDefault(
            ex.getClass(),
            new ExceptionMetadata(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR)
        );
        if (metadata.status().is5xxServerError()) {
            log.error("Handled exception: {} - Path: {}", ex.getClass().getSimpleName(), request.getRequestURI(), ex);
        } else {
            log.warn("Handled exception: {} - Path: {}", ex.getClass().getSimpleName(), request.getRequestURI(), ex);
        }
        return buildErrorResponse(metadata.status(), metadata.code(), ex, request.getRequestURI(), null);
    }

    private List<ValidationFieldError> extractFieldErrors(HandlerMethodValidationException ex) {
        return ex
            .getParameterValidationResults()
            .stream()
            .flatMap(r ->
                r
                    .getResolvableErrors()
                    .stream()
                    .map(err -> new ValidationFieldError("request", r.getMethodParameter().getParameterName(), err.getDefaultMessage()))
            )
            .toList();
    }

    private List<ValidationFieldError> extractFieldErrors(MethodArgumentNotValidException ex) {
        return ex
            .getBindingResult()
            .getFieldErrors()
            .stream()
            .map(fe -> new ValidationFieldError(fe.getObjectName(), fe.getField(), fe.getDefaultMessage()))
            .toList();
    }

    private List<ValidationFieldError> extractFieldErrors(ConstraintViolationException ex) {
        return ex
            .getConstraintViolations()
            .stream()
            .map(v -> new ValidationFieldError(v.getRootBeanClass().getSimpleName(), v.getPropertyPath().toString(), v.getMessage()))
            .toList();
    }

    private List<ValidationFieldError> extractFieldErrors(MissingServletRequestParameterException ex) {
        return List.of(
            new ValidationFieldError(
                "request",
                ex.getParameterName(),
                String.format("Required parameter '%s' is missing", ex.getParameterName())
            )
        );
    }

    /**
     * Builds a standardized API error response object from the given exception and
     * metadata.
     *
     * @param status      the HTTP status to return
     * @param code        the application-specific error code
     * @param ex          the thrown exception
     * @param path        the request URI that caused the error
     * @param fieldErrors optional list of field-level validation errors (null if
     *                    not applicable)
     * @return a ResponseEntity containing the ApiError
     */
    private ResponseEntity<Object> buildErrorResponse(
        HttpStatus status,
        ErrorCode code,
        Exception ex,
        String path,
        List<ValidationFieldError> fieldErrors
    ) {
        ApiError error = new ApiError(Instant.now(), status.value(), status.getReasonPhrase(), ex.getMessage(), path, code, fieldErrors);
        return new ResponseEntity<>(error, status);
    }

    /**
     * Metadata record for mapping exceptions to corresponding HTTP status and error
     * code.
     *
     * @param status the HTTP status to return
     * @param code   the error code associated with the exception
     */
    private record ExceptionMetadata(HttpStatus status, ErrorCode code) {}
}
