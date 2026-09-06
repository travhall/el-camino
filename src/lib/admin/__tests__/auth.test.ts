import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AstroCookies } from 'astro';
import {
  ADMIN_COOKIE_NAME,
  issueSessionToken,
  verifySessionToken,
  assertSameOrigin,
  isAuthenticated,
  isAdminAuthenticated,
  parseAdminFormData,
  unauthorizedResponse,
} from '../auth';

// happy-dom's `Request` constructor silently drops forbidden header names
// (Origin, Referer) per the Fetch spec, even though real request objects in
// Astro/Node carry them. Build a minimal Request-shaped object instead so
// these headers actually reach `request.headers.get(...)`.
function makeRequest(opts: {
  method?: string;
  url?: string;
  origin?: string;
  referer?: string;
}): Request {
  const headers = new Headers();
  if (opts.origin) headers.append('origin', opts.origin);
  if (opts.referer) headers.append('referer', opts.referer);
  return {
    url: opts.url ?? 'https://example.com/admin',
    method: opts.method ?? 'GET',
    headers,
  } as unknown as Request;
}

describe('issueSessionToken / verifySessionToken', () => {
  it('round-trips: a freshly issued token verifies true with the same secret', () => {
    const token = issueSessionToken('test-secret');
    expect(verifySessionToken('test-secret', token)).toBe(true);
  });

  it('rejects a missing token', () => {
    expect(verifySessionToken('test-secret', undefined)).toBe(false);
  });

  it('rejects a malformed token (wrong number of parts)', () => {
    expect(verifySessionToken('test-secret', 'only.two')).toBe(false);
    expect(verifySessionToken('test-secret', 'one')).toBe(false);
  });

  it('rejects a tampered signature', () => {
    const token = issueSessionToken('test-secret');
    const [iat, exp, sig] = token.split('.');
    const tamperedChar = sig[0] === 'a' ? 'b' : 'a';
    const tampered = `${iat}.${exp}.${tamperedChar}${sig.slice(1)}`;
    expect(verifySessionToken('test-secret', tampered)).toBe(false);
  });

  it('rejects an expired token', () => {
    vi.useFakeTimers();
    try {
      const token = issueSessionToken('test-secret', 60); // 60s TTL
      vi.setSystemTime(Date.now() + 61_000);
      expect(verifySessionToken('test-secret', token)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects verification with a different secret than it was issued with', () => {
    const token = issueSessionToken('secret-a');
    expect(verifySessionToken('secret-b', token)).toBe(false);
  });
});

describe('session revocation via ADMIN_PASSWORD generation binding', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects a token issued under one ADMIN_PASSWORD once ADMIN_PASSWORD changes', () => {
    vi.stubEnv('ADMIN_PASSWORD', 'generation-a');
    const token = issueSessionToken('test-secret');
    expect(verifySessionToken('test-secret', token)).toBe(true);

    vi.stubEnv('ADMIN_PASSWORD', 'generation-b');
    expect(verifySessionToken('test-secret', token)).toBe(false);
  });

  it('accepts a token issued and verified under the same ADMIN_PASSWORD', () => {
    vi.stubEnv('ADMIN_PASSWORD', 'stable-generation');
    const token = issueSessionToken('test-secret');
    expect(verifySessionToken('test-secret', token)).toBe(true);
  });

  it('an expired token still fails even under the same generation (exp check survives)', () => {
    vi.stubEnv('ADMIN_PASSWORD', 'generation-a');
    vi.useFakeTimers();
    try {
      const token = issueSessionToken('test-secret', 60);
      vi.setSystemTime(Date.now() + 61_000);
      expect(verifySessionToken('test-secret', token)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('still uses constant-time comparison (length-mismatch early return)', () => {
    vi.stubEnv('ADMIN_PASSWORD', 'generation-a');
    const token = issueSessionToken('test-secret');
    const [iat, exp] = token.split('.');
    // Shorter signature triggers safeEqual's length guard before timingSafeEqual.
    expect(verifySessionToken('test-secret', `${iat}.${exp}.abc`)).toBe(false);
  });
});

describe('assertSameOrigin', () => {
  it('returns true for a same-host Origin header', () => {
    const request = makeRequest({
      url: 'https://example.com/api/admin-auth',
      origin: 'https://example.com',
    });
    expect(assertSameOrigin(request)).toBe(true);
  });

  it('returns false for a mismatched-host Origin header', () => {
    const request = makeRequest({
      url: 'https://example.com/api/admin-auth',
      origin: 'https://evil.com',
    });
    expect(assertSameOrigin(request)).toBe(false);
  });

  it('returns true when there is no Origin header but Referer matches the host', () => {
    const request = makeRequest({
      url: 'https://example.com/api/admin-auth',
      referer: 'https://example.com/admin/login',
    });
    expect(assertSameOrigin(request)).toBe(true);
  });

  it('returns false when neither Origin nor Referer is present', () => {
    const request = makeRequest({ url: 'https://example.com/api/admin-auth' });
    expect(assertSameOrigin(request)).toBe(false);
  });
});

describe('isAuthenticated', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_SECRET', 'test-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns false when ADMIN_SECRET is not configured', () => {
    vi.unstubAllEnvs();
    const token = issueSessionToken('test-secret');
    const request = makeRequest({ method: 'GET' });
    expect(isAuthenticated(request, token)).toBe(false);
  });

  it('returns false for an invalid token', () => {
    const request = makeRequest({ method: 'GET' });
    expect(isAuthenticated(request, 'not-a-real-token')).toBe(false);
  });

  it('GET request skips the origin check (valid token + bad origin still passes)', () => {
    const token = issueSessionToken('test-secret');
    const request = makeRequest({ method: 'GET', origin: 'https://evil.com' });
    expect(isAuthenticated(request, token)).toBe(true);
  });

  it('POST request with a bad origin fails even with a valid token', () => {
    const token = issueSessionToken('test-secret');
    const request = makeRequest({ method: 'POST', origin: 'https://evil.com' });
    expect(isAuthenticated(request, token)).toBe(false);
  });

  it('POST request with a matching origin and valid token succeeds', () => {
    const token = issueSessionToken('test-secret');
    const request = makeRequest({
      method: 'POST',
      origin: 'https://example.com',
    });
    expect(isAuthenticated(request, token)).toBe(true);
  });
});

describe('ADMIN_COOKIE_NAME', () => {
  it('is the expected constant', () => {
    expect(ADMIN_COOKIE_NAME).toBe('admin_session');
  });
});

describe('isAdminAuthenticated', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_SECRET', 'test-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads the session cookie and delegates to isAuthenticated', () => {
    const token = issueSessionToken('test-secret');
    const request = makeRequest({ method: 'GET' });
    const cookies = {
      get: (name: string) =>
        name === ADMIN_COOKIE_NAME ? { value: token } : undefined,
    } as unknown as AstroCookies;
    expect(isAdminAuthenticated(request, cookies)).toBe(true);
  });

  it('returns false when the session cookie is absent', () => {
    const request = makeRequest({ method: 'GET' });
    const cookies = { get: () => undefined } as unknown as AstroCookies;
    expect(isAdminAuthenticated(request, cookies)).toBe(false);
  });
});

describe('parseAdminFormData', () => {
  it('returns the parsed FormData on success', async () => {
    const formData = new FormData();
    formData.set('foo', 'bar');
    const request = new Request('https://example.com/admin', {
      method: 'POST',
      body: formData,
    });
    const result = await parseAdminFormData(request);
    expect(result?.get('foo')).toBe('bar');
  });

  it('returns null when the body cannot be parsed as FormData', async () => {
    const request = {
      formData: async () => {
        throw new Error('bad body');
      },
    } as unknown as Request;
    expect(await parseAdminFormData(request)).toBeNull();
  });
});

describe('unauthorizedResponse', () => {
  it('returns a 401 JSON response with an Unauthorized error', async () => {
    const res = unauthorizedResponse();
    expect(res.status).toBe(401);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });
});
