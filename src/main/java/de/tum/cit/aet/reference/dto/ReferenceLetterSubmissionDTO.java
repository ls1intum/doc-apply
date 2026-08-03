package de.tum.cit.aet.reference.dto;

import de.tum.cit.aet.reference.constants.AcquaintanceDepth;
import de.tum.cit.aet.reference.constants.AcquaintanceDuration;
import de.tum.cit.aet.reference.constants.OverallRecommendation;
import de.tum.cit.aet.reference.constants.PeerRating;
import de.tum.cit.aet.reference.constants.RefereeRelationship;
import java.util.Objects;
import java.util.stream.Stream;
import org.springframework.web.multipart.MultipartFile;

/**
 * The recommendation a referee submits: a letter PDF, a structured assessment, or both.
 * Which parts are required depends on the job's recommendation type, so every field is optional
 * at the DTO level and validated in the service against the job's configuration.
 *
 * @param relationship             capacity in which the referee knows the applicant
 * @param acquaintanceDuration     how long the referee has known the applicant
 * @param acquaintanceDepth        how well the referee knows the applicant
 * @param ratingIntellectualAbility peer-group rating of intellectual ability
 * @param ratingResearchPotential  peer-group rating of research potential
 * @param ratingMotivation         peer-group rating of motivation and drive
 * @param ratingCommunication      peer-group rating of communication skills
 * @param ratingLeadership         peer-group rating of leadership
 * @param ratingCollaboration      peer-group rating of ability to collaborate
 * @param overallRecommendation    the referee's overall endorsement
 * @param letter                   the recommendation letter PDF file
 */
public record ReferenceLetterSubmissionDTO(
    RefereeRelationship relationship,
    AcquaintanceDuration acquaintanceDuration,
    AcquaintanceDepth acquaintanceDepth,
    PeerRating ratingIntellectualAbility,
    PeerRating ratingResearchPotential,
    PeerRating ratingMotivation,
    PeerRating ratingCommunication,
    PeerRating ratingLeadership,
    PeerRating ratingCollaboration,
    OverallRecommendation overallRecommendation,
    MultipartFile letter
) {
    /**
     * @return true when all assessment fields are filled in
     */
    public boolean hasCompleteAssessment() {
        return Stream.of(
            relationship,
            acquaintanceDuration,
            acquaintanceDepth,
            ratingIntellectualAbility,
            ratingResearchPotential,
            ratingMotivation,
            ratingCommunication,
            ratingLeadership,
            ratingCollaboration,
            overallRecommendation
        ).allMatch(Objects::nonNull);
    }

    /**
     * @return true when any assessment field is filled in
     */
    public boolean hasAnyAssessmentAnswer() {
        return Stream.of(
            relationship,
            acquaintanceDuration,
            acquaintanceDepth,
            ratingIntellectualAbility,
            ratingResearchPotential,
            ratingMotivation,
            ratingCommunication,
            ratingLeadership,
            ratingCollaboration,
            overallRecommendation
        ).anyMatch(Objects::nonNull);
    }

    /**
     * @return true when a non-empty letter file is present
     */
    public boolean hasLetter() {
        return letter != null && !letter.isEmpty();
    }
}
