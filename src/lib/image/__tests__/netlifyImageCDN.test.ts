import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { toNetlifyImageCDN, IMAGE_CDN_PREFIX } from '../netlifyImageCDN';

const SRC = 'https://items-images-sandbox.s3.amazonaws.com/a b.jpg';
const params = (url: string) => new URLSearchParams(url.split('?')[1]);

describe('toNetlifyImageCDN', () => {
  it('builds the url, width, quality and fit params for an absolute URL', () => {
    const out = toNetlifyImageCDN(SRC, 600);
    expect(out.startsWith(`${IMAGE_CDN_PREFIX}?`)).toBe(true);
    const p = params(out);
    expect(p.get('url')).toBe(SRC);
    expect(p.get('w')).toBe('600');
    expect(p.get('q')).toBe('80');
    expect(p.get('fit')).toBe('cover');
    expect(p.has('h')).toBe(false);
    expect(p.has('fm')).toBe(false);
  });

  it('keeps a stable parameter order: url, w, q, fit, h, fm', () => {
    const out = toNetlifyImageCDN(SRC, 320, {
      height: 320,
      quality: 85,
      format: 'avif',
    });
    expect([...params(out).keys()]).toEqual([
      'url',
      'w',
      'q',
      'fit',
      'h',
      'fm',
    ]);
  });

  it('sets h only when a height is given', () => {
    expect(params(toNetlifyImageCDN(SRC, 128, { height: 128 })).get('h')).toBe(
      '128'
    );
    expect(params(toNetlifyImageCDN(SRC, 128)).has('h')).toBe(false);
  });

  it('lets quality, fit and format override or add', () => {
    const p = params(
      toNetlifyImageCDN(SRC, 100, {
        quality: 60,
        fit: 'contain',
        format: 'webp',
      })
    );
    expect(p.get('q')).toBe('60');
    expect(p.get('fit')).toBe('contain');
    expect(p.get('fm')).toBe('webp');
  });

  it('omits fit entirely when it is null (aspect ratio preserved)', () => {
    const out = toNetlifyImageCDN(SRC, 600, { fit: null });
    expect(params(out).has('fit')).toBe(false);
  });

  it('returns a relative path unchanged', () => {
    expect(toNetlifyImageCDN('/the-shop-01.png', 600)).toBe('/the-shop-01.png');
  });

  it('returns a data URI unchanged', () => {
    expect(toNetlifyImageCDN('data:image/png;base64,AAA', 600)).toBe(
      'data:image/png;base64,AAA'
    );
  });

  it('returns an empty string for empty or undefined input without throwing', () => {
    expect(toNetlifyImageCDN('', 600)).toBe('');
    expect(toNetlifyImageCDN(undefined as unknown as string, 600)).toBe('');
  });
});

// Plan 161: one function emits the image CDN URL. Two places are exempt on
// purpose: the-shop's static srcset attributes (relative paths, which the
// helper's http guard would reject) and the WordPress content builder (its own
// parameter shape). A new hardcoded copy fails here.
describe('only one place builds image CDN URLs', () => {
  const EXEMPT = new Set([
    'lib/image/netlifyImageCDN.ts',
    'pages/the-shop/index.astro',
    'lib/wordpress/content-utils.ts',
  ]);
  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) {
        if (entry !== '__tests__' && entry !== 'node_modules') walk(p, out);
      } else if (/\.(ts|tsx|astro)$/.test(entry) && !/\.test\./.test(entry)) {
        out.push(p);
      }
    }
    return out;
  }

  it('has no other source file that spells the endpoint', () => {
    const root = join(__dirname, '../../..');
    const offenders = walk(root)
      .filter((f) => readFileSync(f, 'utf8').includes('/.netlify/images'))
      .map((f) => relative(root, f))
      .filter((f) => !EXEMPT.has(f));
    expect(offenders).toEqual([]);
  });
});
