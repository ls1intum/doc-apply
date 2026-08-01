package de.tum.cit.aet.core.security.webauthn;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.tum.cit.aet.core.service.AppTokenService;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.dto.auth.AuthResponseDTO;
import de.tum.cit.aet.usermanagement.dto.auth.AuthSessionInfoDTO;
import de.tum.cit.aet.usermanagement.service.UserService;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.TestingAuthenticationToken;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class WebAuthnLoginSuccessHandlerTest {

    @Mock
    private UserService userService;

    @Mock
    private AppTokenService appTokenService;

    @Mock
    private ObjectMapper objectMapper;

    private WebAuthnLoginSuccessHandler handler;

    @BeforeEach
    void setUp() {
        handler = new WebAuthnLoginSuccessHandler(userService, appTokenService, objectMapper);
    }

    @Test
    void issuesAppSessionCookiesOnSuccessfulPasskeyAuthentication() throws Exception {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setUserId(userId);
        when(userService.findById(userId.toString())).thenReturn(user);
        when(appTokenService.issueFor(user)).thenReturn(new AuthResponseDTO("access", "refresh", 300, 2_592_000));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        handler.onAuthenticationSuccess(request, response, new TestingAuthenticationToken(userId.toString(), null));

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getHeaders("Set-Cookie")).anyMatch(c -> c.startsWith("access_token="));
        assertThat(response.getHeaders("Set-Cookie")).anyMatch(c -> c.startsWith("refresh_token="));
        verify(appTokenService).issueFor(user);
        verify(objectMapper).writeValue(any(java.io.OutputStream.class), any(AuthSessionInfoDTO.class));
    }

    @Test
    void returnsUnauthorizedWhenNoUserMatchesPrincipal() throws Exception {
        when(userService.findById("ghost")).thenThrow(new RuntimeException("not found"));
        when(userService.findByEmail("ghost")).thenReturn(java.util.Optional.empty());

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        handler.onAuthenticationSuccess(request, response, new TestingAuthenticationToken("ghost", null));

        assertThat(response.getStatus()).isEqualTo(401);
        verify(appTokenService, org.mockito.Mockito.never()).issueFor(any());
    }
}
