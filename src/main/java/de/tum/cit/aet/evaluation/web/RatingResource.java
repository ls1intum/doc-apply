package de.tum.cit.aet.evaluation.web;

import de.tum.cit.aet.core.security.annotations.Professor;
import de.tum.cit.aet.core.security.annotations.ProfessorOrEmployee;
import de.tum.cit.aet.evaluation.domain.enumeration.RecommendationDecision;
import de.tum.cit.aet.evaluation.dto.RatingOverviewDTO;
import de.tum.cit.aet.evaluation.service.RatingService;
import java.util.UUID;
import lombok.AllArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/applications/{applicationId}/ratings")
@AllArgsConstructor
public class RatingResource {

    private final RatingService ratingService;

    /**
     * Retrieves the ratings for the specified application.
     *
     * @param applicationId the unique ID of the application; must not be {@code null}
     * @return a {@link ResponseEntity} containing the {@link RatingOverviewDTO} for the specified application
     */
    @GetMapping
    @ProfessorOrEmployee
    public ResponseEntity<RatingOverviewDTO> getRatings(@PathVariable("applicationId") UUID applicationId) {
        return ResponseEntity.ok(ratingService.getRatingOverview(applicationId));
    }

    /**
     * Creates, updates, or deletes the current user's rating for the specified application.
     *
     * @param applicationId the unique ID of the application to rate; must not be {@code null}
     * @param rating        the recommendation decision to set, or {@code null} to remove the current one
     * @return a {@link ResponseEntity} containing the updated {@link RatingOverviewDTO} for the specified application
     */
    @PutMapping
    @ProfessorOrEmployee
    public ResponseEntity<RatingOverviewDTO> updateRating(
        @PathVariable("applicationId") UUID applicationId,
        @RequestParam(required = false) RecommendationDecision rating
    ) {
        return ResponseEntity.ok(ratingService.updateRating(applicationId, rating));
    }
}
