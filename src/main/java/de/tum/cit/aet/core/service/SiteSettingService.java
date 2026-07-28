package de.tum.cit.aet.core.service;

import de.tum.cit.aet.core.domain.SystemSetting;
import de.tum.cit.aet.core.dto.SiteNameDTO;
import de.tum.cit.aet.core.exception.BadRequestException;
import de.tum.cit.aet.core.repository.SystemSettingRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

/**
 * Manages site-wide branding settings, currently the configurable site name.
 *
 * The site name is displayed everywhere the platform refers to itself: the client header,
 * page titles, translated UI texts, email subjects and bodies, PDF exports, and data-export
 * READMEs. It is persisted in the {@code system_settings} table so it survives restarts and
 * cached in memory so render paths (emails, PDFs) never hit the database per call.
 */
@Service
public class SiteSettingService {

    /** Fallback used when no custom name has been persisted yet. */
    public static final String DEFAULT_SITE_NAME = "DocApply";

    private static final String SETTING_KEY = "site.name";

    private final SystemSettingRepository systemSettingRepository;

    private volatile String siteName = DEFAULT_SITE_NAME;

    public SiteSettingService(SystemSettingRepository systemSettingRepository) {
        this.systemSettingRepository = systemSettingRepository;
    }

    @PostConstruct
    void init() {
        try {
            systemSettingRepository.findById(SETTING_KEY).ifPresent(setting -> siteName = setting.getValue());
        } catch (Exception e) {
            // Table may not exist during API docs generation (no-liquibase profile); keep the default
        }
    }

    /**
     * Returns the current site name.
     *
     * @return the configured site name, or the default if none was configured
     */
    public String getSiteName() {
        return siteName;
    }

    /**
     * Updates the site name system-wide. Persisted to the database.
     *
     * @param newSiteName the new site name; must not be blank and at most {@value SiteNameDTO#MAX_SITE_NAME_LENGTH} characters
     * @return the updated site name
     */
    public String updateSiteName(String newSiteName) {
        String trimmed = newSiteName == null ? "" : newSiteName.trim();
        if (trimmed.isEmpty()) {
            throw new BadRequestException("Site name must not be blank");
        }
        if (trimmed.length() > SiteNameDTO.MAX_SITE_NAME_LENGTH) {
            throw new BadRequestException("Site name must not exceed " + SiteNameDTO.MAX_SITE_NAME_LENGTH + " characters");
        }
        siteName = trimmed;
        systemSettingRepository.save(new SystemSetting(SETTING_KEY, trimmed));
        return trimmed;
    }
}
