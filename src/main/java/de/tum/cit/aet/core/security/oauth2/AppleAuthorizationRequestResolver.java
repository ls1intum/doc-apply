package de.tum.cit.aet.core.security.oauth2;

import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;

/**
 * Wraps the default authorization-request resolver to add {@code response_mode=form_post} for Apple.
 * Apple requires {@code form_post} whenever the {@code name}/{@code email} scopes are requested and delivers
 * the callback as a cross-site POST (handled together with {@link HttpCookieOAuth2AuthorizationRequestRepository}
 * and {@link AppleUserAttributesFilter}). Other providers (e.g. Google) are returned unchanged.
 */
public class AppleAuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {

    private static final String APPLE_REGISTRATION_ID = "apple";

    private final DefaultOAuth2AuthorizationRequestResolver delegate;

    public AppleAuthorizationRequestResolver(ClientRegistrationRepository clientRegistrationRepository) {
        this.delegate = new DefaultOAuth2AuthorizationRequestResolver(clientRegistrationRepository, "/oauth2/authorization");
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        return customize(delegate.resolve(request));
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
        return customize(delegate.resolve(request, clientRegistrationId));
    }

    private OAuth2AuthorizationRequest customize(OAuth2AuthorizationRequest authorizationRequest) {
        if (authorizationRequest == null) {
            return null;
        }
        Object registrationId = authorizationRequest.getAttribute(OAuth2ParameterNames.REGISTRATION_ID);
        if (!APPLE_REGISTRATION_ID.equals(registrationId)) {
            return authorizationRequest;
        }
        Map<String, Object> additionalParameters = new HashMap<>(authorizationRequest.getAdditionalParameters());
        additionalParameters.put("response_mode", "form_post");
        return OAuth2AuthorizationRequest.from(authorizationRequest).additionalParameters(additionalParameters).build();
    }
}
