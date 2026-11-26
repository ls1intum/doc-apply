package de.tum.cit.aet.usermanagement.web;

import de.tum.cit.aet.core.security.annotations.Applicant;
import de.tum.cit.aet.usermanagement.dto.ProfOnboardingDTO;
import de.tum.cit.aet.usermanagement.service.ResearchGroupService;
import de.tum.cit.aet.usermanagement.service.UserSettingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/**
 * REST resource for professor onboarding flow.
 * Provides endpoints to check if the onboarding dialog should be displayed
 * and to update the onboarding state based on user actions.
 */
@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class ProfOnboardingResource {

    private static final String ONBOARDED = "onboarded";

    private final UserSettingService userSettingService;
    private final ResearchGroupService researchGroupService;

    /**
     * Check whether the onboarding dialog should be shown for the current user.
     *
     * @return ProfOnboardingDTO containing the show flag and whether an access request is still pending
     */
    @Applicant
    @GetMapping("/prof-onboarding")
    public ProfOnboardingDTO check() {
        boolean onboarded = userSettingService.getBool(ONBOARDED);
        return new ProfOnboardingDTO(!onboarded, researchGroupService.hasPendingAccessRequest());
    }

    /**
     * Mark the current user as onboarded (either applicant confirmed or professor email sent).
     */
    @Applicant
    @PostMapping("/prof-onboarding/confirm")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void confirmOnboarding() {
        userSettingService.setBool(ONBOARDED, true);
    }

    /**
     * Mark the current user as not yet onboarded (remind later).
     */
    @Applicant
    @PostMapping("/prof-onboarding/remind")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remindLater() {
        userSettingService.setBool(ONBOARDED, false);
    }
}
