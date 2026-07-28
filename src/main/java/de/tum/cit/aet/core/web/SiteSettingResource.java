package de.tum.cit.aet.core.web;

import de.tum.cit.aet.core.dto.SiteNameDTO;
import de.tum.cit.aet.core.security.annotations.Admin;
import de.tum.cit.aet.core.service.SiteSettingService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller for admin updates to site-wide branding settings.
 */
@RestController
@RequestMapping("/api/site-settings")
@Slf4j
public class SiteSettingResource {

    private final SiteSettingService siteSettingService;

    public SiteSettingResource(SiteSettingService siteSettingService) {
        this.siteSettingService = siteSettingService;
    }

    /**
     * Updates the site name displayed across the whole platform. Admin only.
     *
     * @param siteNameDTO the new site name
     * @return the updated site name
     */
    @Admin
    @PutMapping("/site-name")
    public ResponseEntity<SiteNameDTO> updateSiteName(@Valid @RequestBody SiteNameDTO siteNameDTO) {
        log.info("PUT /api/site-settings/site-name - Admin updating site name");
        return ResponseEntity.ok(new SiteNameDTO(siteSettingService.updateSiteName(siteNameDTO.siteName())));
    }
}
