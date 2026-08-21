import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

/**
 * `.btn-bare` resets native button chrome on elements that also carry Tailwind utilities for
 * background, padding, colour and alignment. Unlayered rules outrank every layered one regardless
 * of specificity, so declaring it outside a layer makes the reset beat those utilities and silently
 * strips the styling from every element using it. Keeping it in the components layer, which sits
 * before utilities, is what lets the utilities win.
 */
describe('btn-bare global style', () => {
  const globalScss = readFileSync('src/main/webapp/content/scss/global.scss', 'utf8');

  it('should declare btn-bare inside the components layer so utilities can override it', () => {
    const componentsLayer = /@layer\s+components\s*\{([\s\S]*?)\n\}/.exec(globalScss);

    expect(componentsLayer).not.toBeNull();
    expect(componentsLayer?.[1]).toContain('.btn-bare');
  });
});
