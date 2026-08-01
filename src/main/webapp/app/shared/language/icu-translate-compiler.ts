import { Injectable, inject } from '@angular/core';
import { InterpolatableTranslation, InterpolatableTranslationObject, TranslateCompiler, TranslationObject } from '@ngx-translate/core';
import { IntlMessageFormat } from 'intl-messageformat';
import { SiteConfigService } from 'app/core/config/site-config.service';

/**
 * ngx-translate compiler that delegates to intl-messageformat (formatjs) so
 * translation strings can use ICU MessageFormat syntax — `{count, plural, ...}`,
 * `{gender, select, ...}`, etc. — on top of the default `{paramName}` interpolation.
 *
 * Replaces ngx-translate-messageformat-compiler, whose @messageformat/core
 * dependency is CommonJS-only and broke prod-build bootstrap.
 */
type Renderer = (params?: Record<string, unknown>) => string;

@Injectable({ providedIn: 'root' })
export class IcuTranslateCompiler extends TranslateCompiler {
  private readonly cache = new Map<string, Renderer>();
  private readonly siteConfigService = inject(SiteConfigService);

  /**
   * Compile one translation string. Strings without ICU placeholders are
   * returned untouched so simple lookups stay zero-overhead. Strings with
   * placeholders are wrapped in a renderer function that ngx-translate calls
   * with the parameter map at lookup time. Renderers are cached per (lang, value)
   * so repeated lookups don't re-parse the ICU source.
   *
   * Every renderer receives the configurable site name as the implicit
   * `siteName` parameter, so translations can reference `{siteName}` without
   * each call site passing it explicitly. The value is read at render time,
   * keeping cached renderers correct when an admin changes the name.
   * @param value - the raw translation string
   * @param lang - the target locale (e.g. `en`, `de`)
   * @returns the original string, or a cached renderer function accepting params
   */
  compile(value: string, lang: string): InterpolatableTranslation {
    if (!value.includes('{')) {
      return value;
    }
    const key = `${lang}::${value}`;
    let renderer = this.cache.get(key);
    if (!renderer) {
      const mf = new IntlMessageFormat(value, lang, undefined, { ignoreTag: true });
      renderer = (params): string => String(mf.format(Object.assign({ siteName: this.siteConfigService.siteName() }, params)));
      this.cache.set(key, renderer);
    }
    return renderer;
  }

  /**
   * Walk a translations payload and compile every string leaf. Non-string
   * leaves are returned as-is, preserving the input tree shape.
   * @param translations - the translation tree (string or nested object)
   * @param lang - the target locale
   * @returns the compiled tree, structurally identical to the input
   */
  compileTranslations(translations: TranslationObject, lang: string): InterpolatableTranslationObject {
    const out: InterpolatableTranslationObject = {};
    for (const key of Object.keys(translations)) {
      out[key] = this.compileLeaf(translations[key], lang);
    }
    return out;
  }

  /**
   * Compile a single translation leaf (string, array, or nested object).
   * @param value - the leaf value to compile
   * @param lang - the target locale
   * @returns the compiled leaf, structurally identical to the input
   */
  private compileLeaf(value: unknown, lang: string): InterpolatableTranslation {
    if (typeof value === 'string') {
      return this.compile(value, lang);
    }
    if (value === null || value === undefined) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(item => this.compileLeaf(item, lang));
    }
    if (typeof value === 'object') {
      return this.compileTranslations(value as TranslationObject, lang);
    }
    return value as InterpolatableTranslation;
  }
}
