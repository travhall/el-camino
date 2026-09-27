// @vitest-environment node
/**
 * BaseHead is the only place that emits the meta description tag. Pages pass a
 * `description` prop (via Layout) instead of emitting their own tag, so a page
 * can never produce a duplicate description (plan 196).
 */
import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import BaseHead from '../BaseHead.astro';
import { siteConfig } from '@/lib/site-config';

async function render(props: Record<string, unknown> = {}): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(BaseHead, {
    props: { title: 'T', orgSchema: {}, ...props },
    locals: { nonce: 'test' },
    request: new Request('http://localhost/'),
  });
}

const count = (html: string, needle: RegExp) =>
  (html.match(needle) ?? []).length;

describe('BaseHead description', () => {
  it('falls back to the site default with exactly one description tag', async () => {
    const html = await render();
    expect(html).toContain(siteConfig.seo.defaultDescription);
    expect(count(html, /name="description"/g)).toBe(1);
  });

  it('uses a page-specific description and drops the default', async () => {
    const html = await render({ description: 'Custom copy' });
    expect(html).toMatch(
      /<meta[^>]*name="description"[^>]*content="Custom copy"[^>]*>/
    );
    expect(html).toMatch(
      /<meta[^>]*name="twitter:description"[^>]*content="Custom copy"[^>]*>/
    );
    expect(html).not.toContain(siteConfig.seo.defaultDescription);
    expect(count(html, /name="description"/g)).toBe(1);
  });
});
