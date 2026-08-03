package de.tum.cit.aet.core.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Reads the {@code X-Active-Research-Group-Id} header from each incoming
 * request, parses it as a UUID, and stores the result on the request as the
 * attribute {@link #ACTIVE_RESEARCH_GROUP_ID_ATTRIBUTE}.
 *
 * <p>The filter does not validate membership — it only parses the header. The
 * downstream {@code CurrentUserService} performs membership validation and
 * applies the fallback ("first membership") when the attribute is absent or
 * does not match any of the user's groups.
 */
@Component
public class ActiveResearchGroupHeaderFilter extends OncePerRequestFilter {

    public static final String HEADER_NAME = "X-Active-Research-Group-Id";
    public static final String ACTIVE_RESEARCH_GROUP_ID_ATTRIBUTE = "activeResearchGroupId";

    @Override
    protected void doFilterInternal(
        @NonNull HttpServletRequest request,
        @NonNull HttpServletResponse response,
        @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String raw = request.getHeader(HEADER_NAME);
        if (raw != null && !raw.isBlank()) {
            try {
                UUID parsed = UUID.fromString(raw.trim());
                request.setAttribute(ACTIVE_RESEARCH_GROUP_ID_ATTRIBUTE, parsed);
            } catch (IllegalArgumentException ignored) {
                // Malformed header — leave attribute unset and fall through to the resolver's fallback.
            }
        }
        filterChain.doFilter(request, response);
    }
}
