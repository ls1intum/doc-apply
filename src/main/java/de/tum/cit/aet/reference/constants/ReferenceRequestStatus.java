package de.tum.cit.aet.reference.constants;

/**
 * Lifecycle states of a reference request opened by an applicant.
 *
 * ADDED      request was created but invitation email not sent yet
 * REQUESTED  invitation has been sent
 * SUBMITTED  referee uploaded the letter
 * EXPIRED    deadline passed without submission
 * DECLINED   referee declined to provide a letter
 * CANCELLED  applicant withdrew the application, so the recommendation is no longer needed
 */
public enum ReferenceRequestStatus {
    ADDED,
    REQUESTED,
    SUBMITTED,
    EXPIRED,
    DECLINED,
    CANCELLED,
}
