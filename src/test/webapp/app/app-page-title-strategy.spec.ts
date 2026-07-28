import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { describe, it, expect } from 'vitest';
import { TranslateService } from '@ngx-translate/core';

import { AppPageTitleStrategy } from 'app/app-page-title-strategy';
import { SiteConfigService } from 'app/core/config/site-config.service';

describe('AppPageTitleStrategy', () => {
  it('should re-resolve the document title when the site name changes', () => {
    const siteConfig = new SiteConfigService();
    TestBed.configureTestingModule({
      providers: [
        AppPageTitleStrategy,
        { provide: SiteConfigService, useValue: siteConfig },
        // `global.title` is `{siteName}`, so the resolved title mirrors the current site name.
        { provide: TranslateService, useValue: { get: (): Observable<string> => of(siteConfig.siteName()) } },
      ],
    });
    TestBed.inject(AppPageTitleStrategy);

    TestBed.tick();
    expect(document.title).toBe('DocApply');

    siteConfig.siteName.set('New Portal');
    TestBed.tick();
    expect(document.title).toBe('New Portal');
  });
});
