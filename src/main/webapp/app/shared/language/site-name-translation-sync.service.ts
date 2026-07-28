import { Injectable, effect, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { SiteConfigService } from 'app/core/config/site-config.service';

/**
 * Keeps already-rendered `{siteName}` text in step with a live rename.
 *
 * The translate pipe and directive cache their resolved output and only re-render on a
 * translation change event, so re-storing the current language as a no-op merge is what
 * makes them pick the new name up.
 */
@Injectable({ providedIn: 'root' })
export class SiteNameTranslationSync {
  private readonly translateService = inject(TranslateService);
  private readonly siteConfigService = inject(SiteConfigService);

  /** Re-emits the current language's translations whenever the site name changes. */
  private readonly refreshOnSiteNameChange = effect(() => {
    // Track the site name so this re-runs whenever an admin changes it.
    this.siteConfigService.siteName();
    const lang = this.translateService.getCurrentLang();
    if (lang) {
      this.translateService.setTranslation(lang, {}, true);
    }
  });
}
