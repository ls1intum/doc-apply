package de.tum.cit.aet.notification.constants;

import de.tum.cit.aet.usermanagement.constants.UserRole;
import java.util.Set;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * Enumeration representing different types of emails that can be sent within the application.
 * Each email type defines the recipients (based on UserRole) and whether it can be customised
 * per research group via the admin templates page.
 */
@Getter
@AllArgsConstructor
public enum EmailType {
    /**
     * When an application was accepted
     * To: Applicant whose application was accepted
     * BCC: Supervising Professor of accepted application
     */
    APPLICATION_ACCEPTED("APPLICATION_ACCEPTED", Set.of(UserRole.APPLICANT, UserRole.PROFESSOR, UserRole.EMPLOYEE), true, SignoffType.NONE),

    /**
     * Rejection because the position has been filled.
     * To: Applicant whose application was rejected
     */
    APPLICATION_REJECTED_JOB_FILLED("APPLICATION_REJECTED_JOB_FILLED", Set.of(UserRole.APPLICANT), true, SignoffType.RESEARCH_GROUP),

    /**
     * Rejection because the job listing is outdated.
     * To: Applicant whose application was rejected
     */
    APPLICATION_REJECTED_JOB_OUTDATED("APPLICATION_REJECTED_JOB_OUTDATED", Set.of(UserRole.APPLICANT), true, SignoffType.RESEARCH_GROUP),

    /**
     * Rejection because the applicant did not meet the requirements.
     * To: Applicant whose application was rejected
     */
    APPLICATION_REJECTED_FAILED_REQUIREMENTS(
        "APPLICATION_REJECTED_FAILED_REQUIREMENTS",
        Set.of(UserRole.APPLICANT),
        true,
        SignoffType.RESEARCH_GROUP
    ),

    /**
     * Rejection for any other reason.
     * To: Applicant whose application was rejected
     */
    APPLICATION_REJECTED_OTHER_REASON("APPLICATION_REJECTED_OTHER_REASON", Set.of(UserRole.APPLICANT), true, SignoffType.RESEARCH_GROUP),

    /**
     * When a new application was received for a job
     * To: Supervising professor of the job
     */
    APPLICATION_RECEIVED("APPLICATION_RECEIVED", Set.of(UserRole.PROFESSOR, UserRole.EMPLOYEE), false, SignoffType.SYSTEM),

    /**
     * Confirmation that application was successfully submitted
     * To: Applicant who sent the application
     */
    APPLICATION_SENT("APPLICATION_SENT", Set.of(UserRole.APPLICANT), true, SignoffType.RESEARCH_GROUP),

    /**
     * Confirmation that application was successfully withdrawn
     * To: Applicant who withdrew the application
     */
    APPLICATION_WITHDRAWN("APPLICATION_WITHDRAWN", Set.of(UserRole.APPLICANT), false, SignoffType.RESEARCH_GROUP),

    /**
     * Notification when a job with a matching subject area is published
     * To: Applicants subscribed to the exact subject area
     */
    JOB_PUBLISHED_SUBJECT_AREA("JOB_PUBLISHED_SUBJECT_AREA", Set.of(UserRole.APPLICANT), false, SignoffType.SYSTEM),

    /**
     * Interview invitation when applicant is assigned to an interview slot
     * To: Applicant who was assigned to the slot
     */
    INTERVIEW_INVITATION("INTERVIEW_INVITATION", Set.of(UserRole.APPLICANT), true, SignoffType.RESEARCH_GROUP),

    /**
     * When a user is added to a research group
     * To: Newly added member
     */
    RESEARCH_GROUP_MEMBER_ADDED("RESEARCH_GROUP_MEMBER_ADDED", Set.of(UserRole.EMPLOYEE, UserRole.PROFESSOR), true, SignoffType.SYSTEM),

    /**
     * When a research group request is approved
     * To: Research group owner (professor)
     */
    RESEARCH_GROUP_APPROVED("RESEARCH_GROUP_APPROVED", Set.of(UserRole.PROFESSOR), false, SignoffType.SYSTEM),

    /**
     * Confirmation when applicant books their own interview slot
     * To: Applicant who booked the slot
     */
    INTERVIEW_BOOKED_APPLICANT("INTERVIEW_BOOKED_APPLICANT", Set.of(UserRole.APPLICANT), false, SignoffType.RESEARCH_GROUP),

    /**
     * Notification to professor when applicant books an interview slot
     * To: Supervising professor of the job
     */
    INTERVIEW_BOOKED_PROFESSOR("INTERVIEW_BOOKED_PROFESSOR", Set.of(UserRole.PROFESSOR, UserRole.EMPLOYEE), false, SignoffType.SYSTEM),

    /**
     * Confirmation to professor when they manually assign a slot to an applicant
     * To: Supervising professor of the job
     */
    INTERVIEW_ASSIGNED_PROFESSOR("INTERVIEW_ASSIGNED_PROFESSOR", Set.of(UserRole.PROFESSOR, UserRole.EMPLOYEE), false, SignoffType.SYSTEM),

    /**
     * Notification when the location of a booked interview slot is updated
     * To: Applicant whose booked slot location was changed
     */
    INTERVIEW_LOCATION_CHANGED("INTERVIEW_LOCATION_CHANGED", Set.of(UserRole.APPLICANT), true, SignoffType.RESEARCH_GROUP),

    /**
     * Invitation to self-schedule an interview slot
     * To: Applicant
     */
    INTERVIEW_SELF_SCHEDULING_INVITATION(
        "INTERVIEW_SELF_SCHEDULING_INVITATION",
        Set.of(UserRole.APPLICANT),
        true,
        SignoffType.RESEARCH_GROUP
    ),

    /**
     * Notification that an interview slot was cancelled (and no new link is sent)
     * To: Applicant
     */
    INTERVIEW_CANCELLED("INTERVIEW_CANCELLED", Set.of(UserRole.APPLICANT), true, SignoffType.RESEARCH_GROUP),

    /**
     * Notification that an interview slot was cancelled and the applicant is requested to reschedule
     * To: Applicant
     */
    INTERVIEW_RESCHEDULE_REQUESTED("INTERVIEW_RESCHEDULE_REQUESTED", Set.of(UserRole.APPLICANT), true, SignoffType.RESEARCH_GROUP),

    /**
     * Data export ready notification
     * To: User who requested the export
     */
    DATA_EXPORT_READY(
        "DATA_EXPORT_READY",
        Set.of(UserRole.APPLICANT, UserRole.PROFESSOR, UserRole.EMPLOYEE, UserRole.ADMIN),
        false,
        SignoffType.SYSTEM
    ),

    /**
     * Warning email sent to inactive users before their data is deleted due to prolonged inactivity.
     * This notification is triggered 28 days before the scheduled deletion date,
     * giving users time to log in and reactivate their account.
     * To: Inactive applicants, employees, and professors who are approaching the data deletion threshold.
     */
    USER_DATA_DELETION_WARNING(
        "USER_DATA_DELETION_WARNING",
        Set.of(UserRole.APPLICANT, UserRole.EMPLOYEE, UserRole.PROFESSOR),
        false,
        SignoffType.SYSTEM
    ),

    /**
     * Warning email sent to applicants before their application data is deleted as part of the applicant retention policy.
     * To: Applicants whose data is scheduled for deletion under the retention policy.
     */
    APPLICANT_DATA_DELETION_WARNING("APPLICANT_DATA_DELETION_WARNING", Set.of(UserRole.APPLICANT), false, SignoffType.SYSTEM),

    /**
     * Invitation to an external referee asking them to upload a recommendation letter for a specific application.
     * To: External referee email (no TUMApply account required)
     */
    REFERENCE_LETTER_INVITATION("REFERENCE_LETTER_INVITATION", Set.of(), false, SignoffType.SYSTEM_FORMAL),

    /**
     * Reminder to an external referee that their recommendation letter upload window is about to close.
     * To: External referee email (no TUMApply account required)
     */
    REFERENCE_LETTER_REMINDER("REFERENCE_LETTER_REMINDER", Set.of(), false, SignoffType.SYSTEM_FORMAL),

    /**
     * Notice to an external referee that a pending recommendation is no longer needed because the
     * applicant withdrew their application.
     * To: External referee email (no TUMApply account required)
     */
    REFERENCE_LETTER_CANCELLED("REFERENCE_LETTER_CANCELLED", Set.of(), false, SignoffType.SYSTEM_FORMAL);

    private final String value;

    /** The UserRoles that can receive this message. */
    private final Set<UserRole> roles;

    /**
     * Whether a research group can override this template via the admin templates page.
     * Templates that are sent system-wide (no research group context) or that do not
     * benefit from per-group customisation are marked {@code false}.
     */
    private final boolean customizable;

    /**
     * Which sign-off variant the layout auto-appends to the body of this email.
     * See {@link SignoffType} for the available variants.
     */
    private final SignoffType signoffType;
}
