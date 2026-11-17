import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { siteConfig } from '@/lib/site-config';
import { canonicalUrl, isCanonicalHost, robotsTagFor } from '@/lib/canonical';

const root = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('site origin', () => {
  it('is the www host, which is the one that answers 200 in production', () => {
    expect(siteConfig.url).toBe('https://www.elcaminoskateshop.com');
  });

  it('is the only spelling of the origin in config, sitemap, email and robots.txt', () => {
    for (const file of [
      'astro.config.mjs',
      'src/lib/sitemapPages.ts',
      'src/lib/email/templates.ts',
    ]) {
      expect(read(file), file).not.toMatch(
        /https:\/\/(www\.)?elcaminoskateshop\.com(?![\w.-])/
      );
    }
    expect(read('public/robots.txt')).toContain(
      `Sitemap: ${siteConfig.url}/sitemap-index.xml`
    );
  });
});

describe('canonicalUrl', () => {
  const c = (u: string) => canonicalUrl(new URL(u));

  it('uses the configured origin, not the request host', () => {
    expect(c('https://elcaminoskateshop.netlify.app/shop/all')).toBe(
      `${siteConfig.url}/shop/all`
    );
    expect(c('http://localhost:4321/')).toBe(`${siteConfig.url}/`);
  });

  it('drops tracking, filter, sort and variant query strings', () => {
    expect(c('https://x.test/product/deck?utm_source=x')).toBe(
      `${siteConfig.url}/product/deck`
    );
    expect(c('https://x.test/product/deck?variant=abc')).toBe(
      `${siteConfig.url}/product/deck`
    );
    expect(c('https://x.test/shop/all?brands=A&onSale=true')).toBe(
      `${siteConfig.url}/shop/all`
    );
    expect(c('https://x.test/news?tags=event&sort=oldest&view=list')).toBe(
      `${siteConfig.url}/news`
    );
  });

  it('keeps ?page=N on paginated news listings, only for N > 1', () => {
    expect(c('https://x.test/news?page=2')).toBe(
      `${siteConfig.url}/news?page=2`
    );
    expect(c('https://x.test/news/tag/events?page=3&utm=x')).toBe(
      `${siteConfig.url}/news/tag/events?page=3`
    );
    expect(c('https://x.test/news?page=1')).toBe(`${siteConfig.url}/news`);
    expect(c('https://x.test/news?page=abc')).toBe(`${siteConfig.url}/news`);
  });

  it('does not keep ?page on pages that do not paginate', () => {
    expect(c('https://x.test/product/deck?page=2')).toBe(
      `${siteConfig.url}/product/deck`
    );
  });
});

describe('isCanonicalHost / robotsTagFor', () => {
  it('treats only the configured host as canonical', () => {
    expect(isCanonicalHost('www.elcaminoskateshop.com')).toBe(true);
    expect(isCanonicalHost('elcaminoskateshop.netlify.app')).toBe(false);
    expect(
      isCanonicalHost('deploy-preview-3--elcaminoskateshop.netlify.app')
    ).toBe(false);
    expect(isCanonicalHost('localhost')).toBe(false);
    expect(isCanonicalHost('elcaminoskateshop.com')).toBe(false);
  });

  it('asks for noindex everywhere except the canonical host', () => {
    expect(robotsTagFor('www.elcaminoskateshop.com')).toBeNull();
    expect(robotsTagFor('elcaminoskateshop.netlify.app')).toBe(
      'noindex, nofollow'
    );
  });
});
