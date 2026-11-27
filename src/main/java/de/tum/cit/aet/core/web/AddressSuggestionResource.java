package de.tum.cit.aet.core.web;

import de.tum.cit.aet.core.dto.AddressSuggestionDTO;
import de.tum.cit.aet.core.security.annotations.Public;
import de.tum.cit.aet.core.service.AddressSuggestionService;
import de.tum.cit.aet.core.util.HttpUtils;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller that suggests complete addresses while a user types an address into a form.
 * It is public because applicants fill in their address before they have an account.
 */
@Slf4j
@RestController
@RequestMapping("/api/public/address-suggestions")
@RequiredArgsConstructor
public class AddressSuggestionResource {

    private final AddressSuggestionService addressSuggestionService;

    /**
     * Suggests addresses matching a partly typed street, street with house number or postal code.
     *
     * @param query   the text typed so far; fewer than three characters return no suggestions
     * @param lang    the language for place and country names, "de" or "en"
     * @param request the HTTP request, used to identify the client for the request limit
     * @return HTTP 200 OK with up to five suggestions, best match first; an empty list when nothing matches or the
     *         address search is unavailable
     */
    @Public
    @GetMapping
    public ResponseEntity<List<AddressSuggestionDTO>> getAddressSuggestions(
        @RequestParam String query,
        @RequestParam(defaultValue = "en") String lang,
        HttpServletRequest request
    ) {
        log.debug("GET /api/public/address-suggestions - Looking up address suggestions");
        return ResponseEntity.ok(addressSuggestionService.findSuggestions(query, lang, HttpUtils.getClientIp(request)));
    }
}
