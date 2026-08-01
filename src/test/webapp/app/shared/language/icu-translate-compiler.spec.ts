import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { IcuTranslateCompiler } from 'app/shared/language/icu-translate-compiler';
import { SiteConfigService } from 'app/core/config/site-config.service';

describe('IcuTranslateCompiler', () => {
  let compiler: IcuTranslateCompiler;
  let siteConfigService: SiteConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    compiler = TestBed.inject(IcuTranslateCompiler);
    siteConfigService = TestBed.inject(SiteConfigService);
  });

  it('should return plain strings without placeholders unchanged', () => {
    expect(compiler.compile('Plain text', 'en')).toBe('Plain text');
  });

  it('should interpolate simple parameters', () => {
    const result = compiler.compile('Hello {name}', 'en') as (p: Record<string, unknown>) => string;
    expect(result({ name: 'Anna' })).toBe('Hello Anna');
  });

  it.each([
    ['en', '{count, plural, =1 {issue} other {issues}}', { count: 1 }, 'issue'],
    ['en', '{count, plural, =1 {issue} other {issues}}', { count: 5 }, 'issues'],
    ['de', '{n, plural, =1 {ein Problem} other {{n} Probleme}}', { n: 1 }, 'ein Problem'],
  ])('should select the correct plural form (lang=%s)', (lang, source, params, expected) => {
    const result = compiler.compile(source, lang) as (p: Record<string, unknown>) => string;
    expect(result(params)).toBe(expected);
  });

  it('should inject the current site name as implicit siteName parameter', () => {
    const result = compiler.compile('Welcome to {siteName}', 'en') as (p?: Record<string, unknown>) => string;

    expect(result()).toBe('Welcome to DocApply');

    siteConfigService.siteName.set('Doctoral Portal');
    expect(result()).toBe('Welcome to Doctoral Portal');
  });

  it('should let explicit parameters override the implicit site name', () => {
    const result = compiler.compile('Welcome to {siteName}', 'en') as (p?: Record<string, unknown>) => string;

    expect(result({ siteName: 'Override' })).toBe('Welcome to Override');
  });

  it('should compile a translations tree recursively', () => {
    const tree = {
      title: 'Plain',
      nested: { greeting: 'Hi {name}', leafNumber: 42 },
    } as unknown as Parameters<IcuTranslateCompiler['compileTranslations']>[0];
    const compiled = compiler.compileTranslations(tree, 'en') as unknown as {
      title: string;
      nested: { greeting: (p: Record<string, unknown>) => string; leafNumber: number };
    };
    expect(compiled.title).toBe('Plain');
    expect(compiled.nested.greeting({ name: 'Anna' })).toBe('Hi Anna');
    expect(compiled.nested.leafNumber).toBe(42);
  });

  it('should cache compiled message instances per locale and source', () => {
    expect(compiler.compile('{n, plural, =1 {x} other {y}}', 'en')).toBe(compiler.compile('{n, plural, =1 {x} other {y}}', 'en'));
  });
});
