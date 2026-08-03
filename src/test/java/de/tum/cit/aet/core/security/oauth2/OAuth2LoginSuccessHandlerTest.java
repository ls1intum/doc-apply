package de.tum.cit.aet.core.security.oauth2;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.tum.cit.aet.core.service.AppTokenService;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.dto.auth.AuthResponseDTO;
import de.tum.cit.aet.usermanagement.service.UserService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;

@ExtendWith(MockitoExtension.class)
class OAuth2LoginSuccessHandlerTest {

    private static final String CLIENT_URL = "https://app.test";

    @Mock
    private UserService userService;

    @Mock
    private AppTokenService appTokenService;

    private OAuth2LoginSuccessHandler handler;

    @BeforeEach
    void setUp() {
        handler = new OAuth2LoginSuccessHandler(userService, appTokenService, CLIENT_URL + "/");
    }

    private static OAuth2AuthenticationToken googleToken(Map<String, Object> attributes) {
        OAuth2User principal = new DefaultOAuth2User(AuthorityUtils.createAuthorityList("ROLE_USER"), attributes, "sub");
        return new OAuth2AuthenticationToken(principal, List.of(), "google");
    }

    @Test
    void provisionsUserAndSetsCookiesOnVerifiedGoogleLogin() throws Exception {
        Map<String, Object> attributes = Map.of(
            "sub",
            "google-123",
            "email",
            "applicant@gmail.com",
            "email_verified",
            true,
            "given_name",
            "Ada",
            "family_name",
            "Lovelace"
        );
        User user = new User();
        user.setUserId(UUID.randomUUID());
        when(userService.provisionExternalUser("applicant@gmail.com", "Ada", "Lovelace")).thenReturn(user);
        when(appTokenService.issueFor(user)).thenReturn(new AuthResponseDTO("access", "refresh", 300, 2_592_000));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        handler.onAuthenticationSuccess(request, response, googleToken(attributes));

        verify(userService).provisionExternalUser("applicant@gmail.com", "Ada", "Lovelace");
        verify(appTokenService).issueFor(user);
        assertThat(response.getRedirectedUrl()).isEqualTo(CLIENT_URL + "/");
        assertThat(response.getHeaders("Set-Cookie")).anyMatch(c -> c.startsWith("access_token="));
        assertThat(response.getHeaders("Set-Cookie")).anyMatch(c -> c.startsWith("refresh_token="));
    }

    @Test
    void rejectsUnverifiedGoogleEmailWithoutProvisioning() throws Exception {
        Map<String, Object> attributes = Map.of("sub", "google-123", "email", "applicant@gmail.com", "email_verified", false);

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        handler.onAuthenticationSuccess(request, response, googleToken(attributes));

        assertThat(response.getRedirectedUrl()).isEqualTo(CLIENT_URL + "/?login_error=email");
        verify(userService, never()).provisionExternalUser(any(), any(), any());
        verify(appTokenService, never()).issueFor(any());
    }
}
