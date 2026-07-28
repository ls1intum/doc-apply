import { describe, it, expect, vi } from 'vitest';
import { extractTextFromHtml, hasText } from 'app/shared/util/text.util';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('extractTextFromHtml', () => {
  it('should extract plain text from HTML', () => {
    expect(extractTextFromHtml('<p>Hello</p>')).toBe('Hello');
  });

  it('should handle nested tags', () => {
    expect(extractTextFromHtml('<div><b>Test</b> Value</div>')).toBe('Test Value');
  });

  it('should return empty string when no text present', () => {
    expect(extractTextFromHtml('<div></div>')).toBe('');
  });

  it('should handle null textContent and undefined trim safely', () => {
    const mockElem = {
      innerHTML: '',
      textContent: null,
      innerText: { trim: (() => undefined) as unknown as () => string },
    };
    const createSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockElem as unknown as HTMLElement);
    expect(extractTextFromHtml('<p>ignored</p>')).toBe('');
    createSpy.mockRestore();
  });
});

describe('hasText', () => {
  it.each<[string, string | undefined, boolean]>([
    ['a string with content as present', 'value', true],
    ['an empty string as absent', '', false],
    ['undefined as absent', undefined, false],
    ['whitespace as present', ' ', true],
  ])('should treat %s', (_description, value, expected) => {
    expect(hasText(value)).toBe(expected);
  });
});
