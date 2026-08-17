import { describe, it, expect, vi } from 'vitest';
import { POST } from '../admin-logout';

// happy-dom's `Request` constructor silently drops forbidden header names
// (Origin) per the Fetch spec, even though real request objects in Astro/Node
// carry them. Build a minimal Request-shaped object instead so the header
// actually reaches `request.headers.get('origin')` (same workaround as
// admin-auth.test.ts).
function makeContext(origin?: string) {
  const headers = new Headers();
  if (origin) headers.append('origin', origin);
  const request = {
    url: 'https://example.com/api/admin-logout',
    method: 'POST',
    headers,
  } as unknown as Request;
  const cookies = { delete: vi.fn() };
  const redirect = (location: string) =>
    new Response(null, { status: 302, headers: { Location: location } });
  return { request, cookies, redirect } as unknown as Parameters<
    typeof POST
  >[0];
}

describe('POST /api/admin-logout', () => {
  it('returns 403 when the Origin header does not match the request host', async () => {
    const ctx = makeContext('https://evil.example.com');
    const res = await POST(ctx);
    expect(res.status).toBe(403);
    expect(ctx.cookies.delete).not.toHaveBeenCalled();
  });

  it('returns 403 when no Origin/Referer header is present', async () => {
    const ctx = makeContext();
    const res = await POST(ctx);
    expect(res.status).toBe(403);
  });

  it('deletes the admin cookie and redirects to /admin/login on a same-origin request', async () => {
    const ctx = makeContext('https://example.com');
    const res = await POST(ctx);
    expect(ctx.cookies.delete).toHaveBeenCalledWith('admin_session', {
      path: '/',
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/admin/login');
  });
});
