package de.tum.cit.aet.usermanagement.dto;

/**
 * DTO for professor onboarding information.
 * Returned by the /api/me/prof-onboarding endpoint to indicate whether the onboarding dialog should be shown.
 *
 * @param show                 whether the onboarding dialog should be displayed
 * @param accessRequestPending whether the user already asked for access to the professor area and waits for an admin
 */
public record ProfOnboardingDTO(boolean show, boolean accessRequestPending) {}
