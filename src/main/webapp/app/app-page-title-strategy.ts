import { Injectable, effect, inject } from '@angular/core';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { SiteConfigService } from 'app/core/config/site-config.service';

@Injectable()
export class AppPageTitleStrategy extends TitleStrategy {
  private readonly translateService = inject(TranslateService);
  private readonly siteConfigService = inject(SiteConfigService);

  /** Title key of the active route, remembered so it can be re-resolved on demand. */
  private currentTitleKey = 'global.title';

  /**
   * Re-applies the tab title when the admin changes the site name, so titles
   * built from `{siteName}` (e.g. `global.title`) update live without navigation.
   */
  private readonly reapplyOnSiteNameChange = effect(() => {
    this.siteConfigService.siteName();
    this.applyTitle();
  });

  override updateTitle(routerState: RouterStateSnapshot): void {
    this.currentTitleKey = this.buildTitle(routerState) ?? 'global.title';
    this.applyTitle();
  }

  private applyTitle(): void {
    this.translateService.get(this.currentTitleKey).subscribe(title => {
      document.title = title;
    });
  }
}
