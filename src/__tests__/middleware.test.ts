import { describe, it, expect, vi } from 'vitest';

vi.mock('astro:middleware', () => ({
  defineMiddleware: (fn: unknown) => fn,
}));

import { onRequest } from '@/middleware';

type Handler = (
  ctx: Record<string, unknown>,
  next: () => Promise<Response>
) => Promise<Response>;

async function run(url: string) {
  const ctx = {
    url: new URL(url),
    cookies: { get: () => undefined },
    redirect: (to: string) => new Response(null, { status: 302, headers: { location: to } }),
    locals: {} as Record<string, unknown>,
  };
  return (onRequest as unknown as Handler)(ctx, async () => new Response('ok'));
}

describe('middleware X-Robots-Tag', () => {
  it('sends noindex on the staging host', async () => {
    const res = await run('https://elcaminoskateshop.netlify.app/shop/all');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('sends noindex on a deploy preview host', async () => {
    const res = await run('https://deploy-preview-4--elcaminoskateshop.netlify.app/');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('sends no robots header on the canonical host', async () => {
    const res = await run('https://www.elcaminoskateshop.com/shop/all');
    expect(res.headers.get('X-Robots-Tag')).toBeNull();
  });

  it('still sets the CSP header', async () => {
    const res = await run('https://www.elcaminoskateshop.com/');
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
  });
});
