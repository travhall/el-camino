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

describe('BaseHead social tags', () => {
  const tag = (html: string, attr: string, name: string) =>
    html.match(new RegExp(`<meta[^>]*${attr}="${name}"[^>]*>`, 'g')) ?? [];
  const content = (metaTag: string | undefined) =>
    metaTag?.match(/content="([^"]*)"/)?.[1];

  it('defaults to a single website og:type and the site default image', async () => {
    const html = await render();
    const ogType = tag(html, 'property', 'og:type');
    const ogImage = tag(html, 'property', 'og:image');
    expect(ogType).toHaveLength(1);
    expect(content(ogType[0])).toBe('website');
    expect(ogImage).toHaveLength(1);
    expect(content(ogImage[0])).toBe(siteConfig.seo.defaultImage);
    expect(count(html, /<title>T<\/title>/g)).toBe(1);
    expect(content(tag(html, 'property', 'og:title')[0])).toBe('T');
  });

  it('uses per-page ogType, image and socialTitle without duplicating tags', async () => {
    const html = await render({
      ogType: 'product',
      image: 'https://x/y.jpg',
      socialTitle: 'Brand Thing',
      description: 'D',
    });
    for (const [attr, name] of [
      ['property', 'og:type'],
      ['property', 'og:image'],
      ['property', 'og:title'],
      ['property', 'og:site_name'],
      ['name', 'twitter:title'],
      ['name', 'twitter:card'],
      ['name', 'twitter:description'],
      ['name', 'twitter:image:src'],
    ]) {
      expect(tag(html, attr, name), name).toHaveLength(1);
    }
    expect(content(tag(html, 'property', 'og:type')[0])).toBe('product');
    expect(content(tag(html, 'property', 'og:image')[0])).toBe(
      'https://x/y.jpg'
    );
    expect(content(tag(html, 'name', 'twitter:image:src')[0])).toBe(
      'https://x/y.jpg'
    );
    expect(content(tag(html, 'property', 'og:title')[0])).toBe('Brand Thing');
    expect(content(tag(html, 'name', 'twitter:title')[0])).toBe('Brand Thing');
    expect(html).toContain('<title>T</title>');
    expect(html).not.toContain(siteConfig.seo.defaultImage);
  });
});
