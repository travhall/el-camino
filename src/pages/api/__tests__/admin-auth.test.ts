import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '../admin-auth';
import { ADMIN_COOKIE_NAME } from '@/lib/admin/auth';

// happy-dom's `Request` constructor silently drops forbidden header names
// (Origin) per the Fetch spec, even though real request objects in Astro/Node
// carry them. Build a minimal Request-shaped object instead so the header
// actually reaches `request.headers.get('origin')`.
function makeRequest(formData?: Record<string, string>, origin?: string, ip?: string): Request {
  const headers = new Headers();
  if (origin) headers.append('origin', origin);
  if (ip) headers.append('x-forwarded-for', ip);
  const body = new URLSearchParams(formData ?? {});
  return {
    url: 'https://example.com/api/admin-auth',
    method: 'POST',
    headers,
    formData: async () => {
      const fd = new FormData();
      for (const [key, value] of body.entries()) fd.append(key, value);
      return fd;
    },
  } as unknown as Request;
}

// The route's rate limiter is a module-level singleton keyed by client IP, so
// give each test its own IP to avoid cross-test bucket contamination — except
// the dedicated rate-limit test below, which deliberately reuses one IP.
let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.0.0.${ipCounter}`;
}

function makeContext(opts: { formData?: Record<string, string>; origin?: string; ip?: string }) {
  const request = makeRequest(opts.formData, opts.origin, opts.ip ?? nextIp());
  const cookieStore = new Map<string, { value: string }>();
  const cookies = {
    set: (name: string, value: string, _opts: unknown) => cookieStore.set(name, { value }),
    get: (name: string) => cookieStore.get(name),
  };
  const redirect = (location: string) =>
    new Response(null, { status: 302, headers: { Location: location } });
  return { request, cookies, redirect, _cookieStore: cookieStore } as any;
}

const ORIGIN = 'https://example.com';

describe('POST /api/admin-auth', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_SECRET', 'test-secret');
    vi.stubEnv('ADMIN_PASSWORD', 'correct-password');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 503 when ADMIN_SECRET is missing', async () => {
    // Stub to '' rather than relying on unstubAllEnvs() to produce
    // `undefined` — CI sets a real ADMIN_SECRET at the job-env level (for
    // other tests' module-load checks), and unstubAllEnvs() restores to
    // that ambient value rather than clearing it.
    vi.stubEnv('ADMIN_SECRET', '');
    vi.stubEnv('ADMIN_PASSWORD', 'correct-password');
    const ctx = makeContext({ formData: { password: 'x' }, origin: ORIGIN });
    const res = await POST(ctx);
    expect(res.status).toBe(503);
  });

  it('returns 503 when ADMIN_PASSWORD is missing', async () => {
    vi.stubEnv('ADMIN_SECRET', 'test-secret');
    vi.stubEnv('ADMIN_PASSWORD', '');
    const ctx = makeContext({ formData: { password: 'x' }, origin: ORIGIN });
    const res = await POST(ctx);
    expect(res.status).toBe(503);
  });

  it('returns 403 for a bad origin', async () => {
    const ctx = makeContext({ formData: { password: 'correct-password' }, origin: 'https://evil.com' });
    const res = await POST(ctx);
    expect(res.status).toBe(403);
  });

  it('redirects to login with error=1 on wrong password', async () => {
    const ctx = makeContext({ formData: { password: 'wrong' }, origin: ORIGIN });
    const res = await POST(ctx);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('/admin/login');
    expect(res.headers.get('Location')).toContain('error=1');
  });

  it('redirects to `from` and sets the session cookie on correct password', async () => {
    const ctx = makeContext({
      formData: { password: 'correct-password', from: '/admin/settings' },
      origin: ORIGIN,
    });
    const res = await POST(ctx);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/admin/settings');
    expect(ctx._cookieStore.has(ADMIN_COOKIE_NAME)).toBe(true);
  });

  it('falls back to /admin when `from` does not start with /admin (open-redirect guard)', async () => {
    const ctx = makeContext({
      formData: { password: 'correct-password', from: 'https://evil.com' },
      origin: ORIGIN,
    });
    const res = await POST(ctx);
    expect(res.headers.get('Location')).toBe('/admin');
  });

  it('rate-limits after 8 failed attempts from the same IP, returning 429 on the 9th', async () => {
    const ip = '203.0.113.99';
    let lastRes: Response | undefined;
    for (let i = 0; i < 9; i++) {
      const ctx = makeContext({ formData: { password: 'wrong' }, origin: ORIGIN, ip });
      lastRes = await POST(ctx);
    }
    expect(lastRes!.status).toBe(429);
  });
});
