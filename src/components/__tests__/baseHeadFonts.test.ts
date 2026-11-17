import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 220. On the product page the preloaded fonts share the link with the hero
 * (LCP) image. Measured on staging, mobile, devtools throttling, three runs each,
 * dropping the Cabin preload moved LCP from 3,335 ms to ~3,000 ms (two batches,
 * medians 2,996 and 3,001) with CLS 0.0001. Dropping Alumni's preload too gained
 * more but raised CLS to 0.019 (headings reflow), so Alumni stays.
 *
 * Source-reading guards, like the other head tests: they stop the Cabin preload
 * coming back, and stop a preload pointing at a file no @font-face uses.
 */

const head = readFileSync(
  resolve(__dirname, '../BaseHead.astro'),
  'utf8'
).replace(/<!--[\s\S]*?-->/g, '');
const css = readFileSync(
  resolve(__dirname, '../../styles/global.css'),
  'utf8'
).replace(/\/\*[\s\S]*?\*\//g, '');

const fontPreloads = [...head.matchAll(/<link\b[^>]*>/g)]
  .map(([tag]) => tag)
  .filter((tag) => /rel="preload"/.test(tag) && /as="font"/.test(tag))
  .map((tag) => /href="([^"]+)"/.exec(tag)![1]);

describe('BaseHead font preloads', () => {
  it('preloads Alumni Sans (the h1 opacity gate and CLS depend on it)', () => {
    expect(fontPreloads).toContain('/fonts/AlumniSans.woff2');
  });

  it('does not preload Cabin: it competes with the LCP image', () => {
    expect(fontPreloads.filter((href) => /Cabin/.test(href))).toEqual([]);
  });

  it('every preloaded font is the src of an @font-face rule', () => {
    for (const href of fontPreloads) {
      expect(css).toContain(`url('${href}')`);
    }
  });
});
