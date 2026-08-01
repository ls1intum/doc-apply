package de.tum.cit.aet.notification.constants;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * The sign-off variant the email layout should auto-append to a template body.
 * Each {@link EmailType} declares which variant it uses, and the FreeMarker
 * layout renders the matching language-specific macro from
 * {@code templates/{de,en}/signoff.ftl}.
 */
@Getter
@AllArgsConstructor
public enum SignoffType {
    /**
     * No sign-off is appended. Used when the template body already contains its
     * own sign-off (e.g. acceptance emails written by the supervising professor).
     */
    NONE("none"),

    /**
     * The DocApply system sign-off in informal tone ("Dein DocApply Team" /
     * "Your DocApply Team"). Used for system notifications addressed to
     * applicants and staff.
     */
    SYSTEM("system"),

    /**
     * Sign-off attributed to the research group, using the
     * {@code RESEARCH_GROUP_NAME} template variable ("Dein <Group> Team" /
     * "The <Group> Team"). Used for application- and interview-related emails.
     */
    RESEARCH_GROUP("group"),

    /**
     * The DocApply system sign-off in formal tone ("Ihr DocApply Team" /
     * "Your DocApply Team"). Used for emails to external recipients addressed
     * with the formal "Sie" form.
     */
    SYSTEM_FORMAL("systemFormal");

    private final String value;
}
