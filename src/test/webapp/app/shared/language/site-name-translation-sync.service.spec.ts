import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { TranslateService } from '@ngx-translate/core';

import { SiteConfigService } from 'app/core/config/site-config.service';
import { SiteNameTranslationSync } from 'app/shared/language/site-name-translation-sync.service';

describe('SiteNameTranslationSync', () => {
  const setup = (currentLang: string): { setTranslation: ReturnType<typeof vi.fn>; siteConfig: SiteConfigService } => {
    const setTranslation = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        SiteNameTranslationSync,
        SiteConfigService,
        { provide: TranslateService, useValue: { getCurrentLang: () => currentLang, setTranslation } },
      ],
    });
    const siteConfig = TestBed.inject(SiteConfigService);
    TestBed.inject(SiteNameTranslationSync);
    TestBed.tick(); // flush the initial effect run
    setTranslation.mockClear();
    return { setTranslation, siteConfig };
  };

  it('should re-emit the current language translations when the site name changes', () => {
    const { setTranslation, siteConfig } = setup('en');

    siteConfig.siteName.set('New Portal');
    TestBed.tick();

    expect(setTranslation).toHaveBeenCalledExactlyOnceWith('en', {}, true);
  });

  it('should do nothing when no language is active yet', () => {
    const { setTranslation, siteConfig } = setup('');

    siteConfig.siteName.set('New Portal');
    TestBed.tick();

    expect(setTranslation).not.toHaveBeenCalled();
  });
});
