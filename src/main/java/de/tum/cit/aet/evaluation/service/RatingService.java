package de.tum.cit.aet.evaluation.service;

import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.core.exception.EntityNotFoundException;
import de.tum.cit.aet.core.service.CurrentUserService;
import de.tum.cit.aet.evaluation.domain.Rating;
import de.tum.cit.aet.evaluation.domain.enumeration.RecommendationDecision;
import de.tum.cit.aet.evaluation.dto.RatingOverviewDTO;
import de.tum.cit.aet.evaluation.repository.ApplicationEvaluationRepository;
import de.tum.cit.aet.evaluation.repository.RatingRepository;
import de.tum.cit.aet.usermanagement.domain.User;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@AllArgsConstructor
public class RatingService {

    private final RatingRepository ratingRepository;
    private final ApplicationEvaluationRepository applicationEvaluationRepository;
    private final CurrentUserService currentUserService;

    /**
     * Retrieves the ratings for the given application and constructs a {@link RatingOverviewDTO}.
     *
     * @param applicationId the unique ID of the application; must not be {@code null}
     * @return a {@link RatingOverviewDTO} containing all ratings for the specified application
     */
    public RatingOverviewDTO getRatingOverview(UUID applicationId) {
        checkReviewRights(applicationId);
        Set<Rating> ratings = ratingRepository.findByApplicationApplicationId(applicationId);
        return constructRatingOverviewDTO(ratings);
    }

    /**
     * Retrieves all raw {@link Rating} entities for the specified application,
     * skipping the permission check used by {@link #getRatingOverview(UUID)}.
     * Intended for internal callers such as data export that have already
     * authorised the surrounding operation.
     *
     * @param applicationId the unique ID of the application; must not be {@code null}
     * @return the set of ratings attached to the application
     */
    public Set<Rating> findAllByApplicationId(UUID applicationId) {
        return ratingRepository.findByApplicationApplicationId(applicationId);
    }

    /**
     * Creates, updates, or deletes the current user's rating for the specified application,
     * and returns the updated {@link RatingOverviewDTO}.
     *
     * @param applicationId the unique ID of the application to rate; must not be {@code null}
     * @param rating        the recommendation decision to set, or {@code null} to remove the current one
     * @return the updated {@link RatingOverviewDTO} for the specified application
     * @throws jakarta.persistence.EntityNotFoundException if the application does not exist
     */
    @Transactional
    public RatingOverviewDTO updateRating(UUID applicationId, RecommendationDecision rating) {
        checkReviewRights(applicationId);
        User user = currentUserService.getUser();

        if (rating == null) {
            // Delete existing rating
            ratingRepository.deleteByFromAndApplicationApplicationId(user, applicationId);
        } else {
            Optional<Rating> existingRating = ratingRepository.findByFromAndApplicationApplicationId(user, applicationId);

            if (existingRating.isPresent()) {
                // Update existing rating
                Rating ratingEntity = existingRating.get();
                ratingEntity.setRating(rating);
                ratingRepository.save(ratingEntity);
            } else {
                // Create new rating
                Rating newRating = new Rating();
                newRating.setFrom(user);
                newRating.setRating(rating);
                @SuppressWarnings("OptionalGetWithoutIsPresent") // existence is already checked in checkReviewRights()
                Application application = applicationEvaluationRepository.findById(applicationId).get();
                newRating.setApplication(application);
                ratingRepository.save(newRating);
            }
        }

        return getRatingOverview(applicationId);
    }

    /**
     * Constructs a {@link RatingOverviewDTO} separating the current user's rating
     * from all other ratings.
     *
     * @param ratings the set of all {@link Rating} entities; must not be {@code null}
     * @return a {@link RatingOverviewDTO} containing the current user's rating and all other ratings
     */
    private RatingOverviewDTO constructRatingOverviewDTO(Set<Rating> ratings) {
        User user = currentUserService.getUser();
        Rating currentUserRating = null;

        Set<Rating> otherRatings = new HashSet<>();

        for (Rating rating : ratings) {
            if (rating.getFrom().getUserId().equals(user.getUserId())) {
                currentUserRating = rating;
            } else {
                otherRatings.add(rating);
            }
        }

        return RatingOverviewDTO.getRatingOverviewDTO(currentUserRating, otherRatings);
    }

    /**
     * Verifies that the current user has permission to review the specified application.
     *
     * @param applicationId the unique ID of the application
     */
    private void checkReviewRights(UUID applicationId) {
        Application application = applicationEvaluationRepository
            .findById(applicationId)
            .orElseThrow(() -> EntityNotFoundException.forId("Application", applicationId));
        currentUserService.assertAccessTo(application.getJob().getResearchGroup());
    }
}
