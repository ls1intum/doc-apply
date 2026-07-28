package de.tum.cit.aet.core.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * The configurable site name shown wherever the platform refers to itself.
 *
 * @param siteName the site name to display across the whole platform
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record SiteNameDTO(@NotBlank @Size(max = SiteNameDTO.MAX_SITE_NAME_LENGTH) String siteName) {
    /** Upper bound keeping the name usable in headers, email subjects and PDF footers. */
    public static final int MAX_SITE_NAME_LENGTH = 50;
}
