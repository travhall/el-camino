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

// Plan 146: images are requested at /cdn-img, which netlify.toml rewrites to the
// image service. A plain rewrite drops the query string, so each URL shape needs
// a rule that captures and forwards its parameters. A rule matches when every
// parameter it lists is present (extra ones are ignored), so the first matching
// rule must list exactly the request's parameters or one would be silently
// dropped. This checks that for every shape the helper can emit.
describe('netlify.toml /cdn-img rules cover every URL shape', () => {
  const toml = readFileSync(
    join(__dirname, '../../../../netlify.toml'),
    'utf8'
  );
  const rules = [
    ...toml.matchAll(/\[\[redirects\]\]\n([\s\S]*?)(?=\n\[\[|\n\[[a-z]|$)/g),
  ]
    .map((m) => m[1])
    .filter((b) => /from = "\/cdn-img"/.test(b))
    .map((b) => {
      const q = b.match(/query = \{([^}]*)\}/)?.[1] ?? '';
      const to = b.match(/to = "([^"]*)"/)?.[1] ?? '';
      return {
        names: [...q.matchAll(/(\w+) = ":\1"/g)].map((m) => m[1]).sort(),
        to,
        force: /force = true/.test(b),
        status: b.match(/status = (\d+)/)?.[1],
      };
    });

  it('has rules, all rewriting (status 200, forced) to the image service', () => {
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) {
      expect(r.status).toBe('200');
      expect(r.force).toBe(true);
      expect(r.to.startsWith('/.netlify/images?')).toBe(true);
    }
  });

  it('forwards exactly the parameters each rule captures', () => {
    for (const r of rules) {
      const sent = [...r.to.matchAll(/(\w+)=:(\w+)/g)].map((m) => m[1]).sort();
      expect(sent).toEqual(r.names);
    }
  });

  const shapes: Array<{
    fit?: string | null;
    height?: number;
    format?: string;
  }> = [];
  for (const fit of [undefined, null]) {
    for (const height of [undefined, 100]) {
      for (const format of [undefined, 'avif'])
        shapes.push({ fit, height, format });
    }
  }

  it.each(shapes)('a request shaped %j loses no parameter', (shape) => {
    const emitted = new URLSearchParams(
      toNetlifyImageCDN(SRC, 100, shape).split('?')[1]
    );
    const request = [...emitted.keys()].sort();
    const hit = rules.find((r) => r.names.every((n) => request.includes(n)));
    expect(hit, `no rule matches ${request.join(',')}`).toBeDefined();
    expect(hit!.names).toEqual(request);
  });

  it('covers the static shape used by the-shop (url, fm, w, q)', () => {
    const request = ['fm', 'q', 'url', 'w'];
    const hit = rules.find((r) => r.names.every((n) => request.includes(n)));
    expect(hit?.names).toEqual(request);
  });
});
