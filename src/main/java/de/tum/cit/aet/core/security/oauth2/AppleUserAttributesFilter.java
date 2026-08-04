package de.tum.cit.aet.core.security.oauth2;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

/**
 * Captures the user's name from Apple's sign-in callback. Apple returns the {@code name} only on the user's
 * FIRST authorization, as a {@code user} form field on the {@code form_post} callback (it is not in the id
 * token). This filter parses it and stashes the first/last name as request attributes so
 * {@link OAuth2LoginSuccessHandler} can apply them when provisioning the user. Must run before
 * {@code OAuth2LoginAuthenticationFilter} on the OAuth2 login chain.
 */
@Slf4j
public class AppleUserAttributesFilter extends OncePerRequestFilter {

    public static final String FIRST_NAME_ATTRIBUTE = "apple.user.firstName";
    public static final String LAST_NAME_ATTRIBUTE = "apple.user.lastName";

    private static final String CALLBACK_SUFFIX = "/login/oauth2/code/apple";

    private final ObjectMapper objectMapper;

    public AppleUserAttributesFilter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {
        if ("POST".equalsIgnoreCase(request.getMethod()) && request.getRequestURI().endsWith(CALLBACK_SUFFIX)) {
            captureName(request);
        }
        filterChain.doFilter(request, response);
    }

    private void captureName(HttpServletRequest request) {
        String userJson = request.getParameter("user");
        if (userJson == null || userJson.isBlank()) {
            return;
        }
        try {
            Map<?, ?> root = objectMapper.readValue(userJson, Map.class);
            if (root.get("name") instanceof Map<?, ?> name) {
                setIfPresent(request, FIRST_NAME_ATTRIBUTE, name.get("firstName"));
                setIfPresent(request, LAST_NAME_ATTRIBUTE, name.get("lastName"));
            }
        } catch (RuntimeException e) {
            log.debug("Could not parse Apple 'user' payload: {}", e.getMessage());
        }
    }

    private void setIfPresent(HttpServletRequest request, String attribute, Object value) {
        if (value != null && !String.valueOf(value).isBlank()) {
            request.setAttribute(attribute, String.valueOf(value));
        }
    }
}
