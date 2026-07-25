package de.tum.cit.aet.reference.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import de.tum.cit.aet.job.constants.RecommendationType;
import de.tum.cit.aet.reference.constants.ReferenceRequestStatus;
import java.time.LocalDateTime;

/**
 * Context returned to a referee opening their tokenized invitation link. The token is the only
 * authentication for this endpoint, so the response intentionally exposes only the minimum the
 * upload page needs: who the letter is for, which position, the deadline, and the request status.
 *
 * @param applicantFirstName first name of the applicant who requested the letter
 * @param applicantLastName  last name of the applicant who requested the letter
 * @param jobTitle           title of the job the applicant is applying to
 * @param researchGroupName  name of the research group running the position
 * @param deadline           deadline by which the referee must upload the letter
 * @param status             current request status (controls whether the upload form is shown)
 * @param confidential       whether the applicant waived access, so only the professor will see the letter
 * @param recommendationType what the referee must provide (letter, evaluation, or both); controls which sections the upload page shows
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ReferenceLetterUploadContextDTO(
    String applicantFirstName,
    String applicantLastName,
    String jobTitle,
    String researchGroupName,
    LocalDateTime deadline,
    ReferenceRequestStatus status,
    boolean confidential,
    RecommendationType recommendationType
) {}
