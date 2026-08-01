package de.tum.cit.aet.notification.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.job.constants.RecommendationType;

/**
 * Context for the emails sent to an external referee.
 *
 * @param refereeNameTitle        the referee's name title (e.g. "Prof.") or null if none
 * @param refereeFirstName        the referee's first name
 * @param refereeLastName         the referee's last name
 * @param applicantFirstName      the applicant who requested the letter
 * @param applicantLastName       the applicant who requested the letter
 * @param jobTitle                the job the application is for
 * @param researchGroupName       the research group running the position
 * @param referenceLink           the tokenized URL the referee uses to upload the letter
 * @param referenceDeadline       human-readable deadline (e.g. dd.MM.yyyy) by which the letter must be uploaded
 * @param recommendationType      what the referee must provide (letter, evaluation, or both); picks the email wording
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ReferenceLetterContextDTO(
    String refereeNameTitle,
    String refereeFirstName,
    String refereeLastName,
    String applicantFirstName,
    String applicantLastName,
    String jobTitle,
    String researchGroupName,
    String referenceLink,
    String referenceDeadline,
    RecommendationType recommendationType
) {}
