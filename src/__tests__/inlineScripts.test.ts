// @vitest-environment node
/**
 * Guard for plan 235: no page-only `<script is:inline>`.
 *
 * Every response gets its own CSP nonce (`script-src 'self' 'nonce-<N>'`, minted
 * per request in src/middleware.ts). On a client-side navigation Astro's router
 * (`runScripts`) skips an inline script only if that exact script already ran in
 * this document; otherwise it re-creates it with the *destination* response's
 * nonce, which never matches the nonce the browser is still enforcing from the
 * first page load, and the browser blocks it (a `script-src-elem` violation).
 *
 * So an inline script that exists on only some pages is dead whenever a shopper
 * arrives on one of those pages by client-side navigation, which is the normal
 * way. This broke the Size Guide button on every apparel product page (it
 * attached its click handler from an inline script). Page-specific scripts
 * belong in a hoisted `<script>` (bundled to an external file, which
 * `script-src 'self'` allows); an inline script is only safe if it is rendered,
 * byte-identical, on every page (see BaseHead.astro) or the page is never
 * reached by client-side navigation.
 *
 * Adding a file to the allowlist is a decision: write the reason.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');
const SRC = join(ROOT, 'src');

const ALLOWED: Record<string, string> = {
  'src/components/BaseHead.astro':
    'Rendered on every page, so each script is byte-identical across navigations and the router skips it as already run.',
  'src/components/Header.astro':
    'Part of the shared layout: on every page, byte-identical.',
  'src/components/AnnouncementBanner.astro':
    'Part of the shared layout: on every page, byte-identical.',
  'src/components/ArticleGrid.astro':
    'Home and news only, and it has to run before the page module graph (plan 230 measured it). On a first client-side arrival the browser blocks it (one console CSP report) and the hoisted module arms the cards instead, so it degrades gracefully. Do not put anything that must run into it.',
  'src/layouts/AdminLayout.astro':
    'The admin layout does not use the router (no BaseHead / ClientRouter), so admin pages are full page loads.',
  'src/pages/admin/login.astro': 'Admin page, full page load (no router).',
  'src/pages/admin/content/sku-reference.astro':
    'Admin page, full page load (no router).',
  'src/pages/admin/content/event-reference.astro':
    'Admin page, full page load (no router).',
  'src/pages/order-confirmation.astro':
    'Only reached by the redirect back from Square, which is a full page load; it redirects before paint from <head>.',
};

function astroFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === 'node_modules' ? [] : astroFiles(path);
    }
    return path.endsWith('.astro') ? [path] : [];
  });
}

/**
 * The opening tags of `<script ... is:inline ...>` that actually execute.
 *
 * A data block (`type="application/ld+json"`, `application/json`, ...) is not
 * executable: the CSP's `script-src` does not apply to it and the router's
 * `runScripts` skips any script whose type is not JavaScript or a module, so
 * JSON-LD on a page is safe. The scan tracks `{}` depth so an attribute like
 * `set:html={...}` cannot end the tag early.
 */
function executableInlineScriptTags(source: string): string[] {
  const tags: string[] = [];
  let from = 0;
  for (;;) {
    const start = source.indexOf('<script', from);
    if (start === -1) return tags;
    let depth = 0;
    let end = start;
    for (; end < source.length; end++) {
      const ch = source[end];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth <= 0) break;
    }
    const tag = source.slice(start, end + 1);
    from = end + 1;
    if (!/\bis:inline\b/.test(tag)) continue;
    const type = /\btype\s*=\s*["']([^"']*)["']/.exec(tag)?.[1];
    const executable =
      type === undefined || type === 'module' || type === 'text/javascript';
    if (executable) tags.push(tag);
  }
}

function filesWithInlineScripts(): Record<string, number> {
  const found: Record<string, number> = {};
  for (const file of astroFiles(SRC)) {
    const count = executableInlineScriptTags(readFileSync(file, 'utf8')).length;
    if (count > 0) found[relative(ROOT, file)] = count;
  }
  return found;
}

describe('inline scripts and the per-request CSP nonce (plan 235)', () => {
  const found = filesWithInlineScripts();

  it('only the files with a recorded reason contain an is:inline script', () => {
    const unexpected = Object.keys(found).filter((file) => !(file in ALLOWED));

    expect(
      unexpected,
      'A new <script is:inline> exists on only some pages, so it is blocked after a client-side navigation. Use a hoisted <script> (an external module) instead, or add the file to ALLOWED with a reason.'
    ).toEqual([]);
  });

  it('every allowlisted file still has one, so the list does not go stale', () => {
    const stale = Object.keys(ALLOWED).filter((file) => !(file in found));

    expect(stale).toEqual([]);
  });

  describe('the scanner', () => {
    it('counts an executable inline script', () => {
      expect(
        executableInlineScriptTags(
          '<script is:inline nonce={nonce}>x()</script>'
        )
      ).toHaveLength(1);
    });

    it('counts an inline module script', () => {
      expect(
        executableInlineScriptTags('<script is:inline type="module">x</script>')
      ).toHaveLength(1);
    });

    it('does not count a hoisted script, which is bundled to an external file', () => {
      expect(
        executableInlineScriptTags("<script>import { init } from 'x';</script>")
      ).toEqual([]);
    });

    it.each(['application/ld+json', 'application/json'])(
      'does not count a %s data block',
      (type) => {
        expect(
          executableInlineScriptTags(
            `<script is:inline nonce={nonce} type="${type}" set:html={safeJson({ a: 1 })} />`
          )
        ).toEqual([]);
      }
    );

    it('is not fooled by braces or an arrow function inside an attribute', () => {
      const source =
        '<script set:html={items.map((i) => ({ id: i }))} is:inline></script>' +
        '<script type="application/ld+json" is:inline set:html={{ a: (b) => b }} />';

      expect(executableInlineScriptTags(source)).toHaveLength(1);
    });

    it('finds every tag in a file, across lines', () => {
      const source = `<script
        is:inline
        nonce={nonce}
      >a</script>
      <p>x</p>
      <script is:inline>b</script>`;

      expect(executableInlineScriptTags(source)).toHaveLength(2);
    });
  });

  it('every allowlist entry explains itself', () => {
    for (const [file, reason] of Object.entries(ALLOWED)) {
      expect(reason.length, file).toBeGreaterThan(20);
    }
  });

  it('the size guide, which this broke, is an external module and not an inline script', () => {
    expect(Object.keys(found)).not.toContain('src/components/SizeGuide.astro');
    const source = readFileSync(
      join(SRC, 'components', 'SizeGuide.astro'),
      'utf8'
    );
    expect(source).toContain("from '@/scripts/size-guide-client'");
  });
});
