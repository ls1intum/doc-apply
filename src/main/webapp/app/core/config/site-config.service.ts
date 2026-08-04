import { Injectable, signal } from '@angular/core';

/** Fallback shown until the configured site name is loaded from the server. */
export const DEFAULT_SITE_NAME = 'DocApply';

/**
 * Holds the configurable site name used wherever the platform refers to itself
 * (header, page titles, translated texts). The value is loaded from the public
 * config endpoint during app initialization and can be updated by admins.
 *
 * Deliberately dependency-free so low-level infrastructure like the translate
 * compiler can inject it without risking circular dependencies.
 */
@Injectable({ providedIn: 'root' })
export class SiteConfigService {
  /** The site name displayed across the whole platform. */
  readonly siteName = signal<string>(DEFAULT_SITE_NAME);
}
