package de.tum.cit.aet.utility.testdata;

import de.tum.cit.aet.application.domain.Application;
import de.tum.cit.aet.evaluation.domain.Rating;
import de.tum.cit.aet.evaluation.domain.enumeration.RecommendationDecision;
import de.tum.cit.aet.evaluation.repository.RatingRepository;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.repository.UserRepository;

/**
 * Test data helpers for Rating.
 */
public final class RatingTestData {

    private static final RecommendationDecision DEFAULT_RATING = RecommendationDecision.SOFT_PASS;

    private RatingTestData() {}

    /** Unsaved Rating with defaults (application + professor, rating=SOFT_PASS). */
    public static Rating newRating(Application application, User professor) {
        Rating r = new Rating();
        r.setApplication(application);
        r.setFrom(professor);
        r.setRating(DEFAULT_RATING);
        return r;
    }

    /** Unsaved Rating with override options (null = keep default). */
    public static Rating newRatingAll(Application application, User professor, RecommendationDecision rating) {
        Rating r = newRating(application, professor);
        if (application != null) r.setApplication(application);
        if (professor != null) r.setFrom(professor);
        if (rating != null) r.setRating(rating);
        return r;
    }

    // --- Saved variants -------------------------------------------------------------------------

    /** Saves a new Rating with given Application and Professor. */
    public static Rating saved(RatingRepository repo, Application application, User professor, RecommendationDecision rating) {
        return repo.save(newRatingAll(application, professor, rating));
    }

    /** Saves a new Rating with a freshly created professor and given Application. */
    public static Rating savedWithNewProfessor(
        RatingRepository repo,
        UserRepository userRepo,
        ResearchGroup rg,
        Application application,
        RecommendationDecision rating
    ) {
        User professor = UserTestData.savedProfessor(userRepo, rg);
        return saved(repo, application, professor, rating);
    }
}
