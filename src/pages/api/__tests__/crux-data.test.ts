import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GET as GETType } from '../crux-data';

vi.mock('@/lib/site-config', () => ({
  siteConfig: { url: 'https://example.com' },
}));

global.fetch = vi.fn();
const mockFetch = global.fetch as unknown as ReturnType<typeof vi.fn>;

// The route caches CrUX responses in a module-level Map keyed by origin, so
// each test needs a fresh module instance to avoid one test's cache entry
// leaking into the next.
async function freshGET(): Promise<typeof GETType> {
  vi.resetModules();
  return (await import('../crux-data')).GET;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/crux-data', () => {
  it('returns status "no_key" without calling fetch when CRUX_API_KEY is unset', async () => {
    vi.stubEnv('CRUX_API_KEY', '');
    const GET = await freshGET();
    const res = await GET({} as unknown as Parameters<typeof GET>[0]);
    const body = await res.json();
    expect(body).toEqual({ status: 'no_key', origin: 'https://example.com' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns status "ok" with extracted p75 metrics on a successful response', async () => {
    vi.stubEnv('CRUX_API_KEY', 'test-key');
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        record: {
          metrics: {
            largest_contentful_paint: {
              percentiles: { p75: 2000 },
              histogram: [{ density: 0.8 }],
            },
          },
        },
      }),
    });

    const GET = await freshGET();
    const res = await GET({} as unknown as Parameters<typeof GET>[0]);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.lcp).toBe(2000);
    expect(body.lcpGoodPercent).toBe(0.8);
    expect(body.inp).toBeNull();
  });

  it('returns status "no_data" on a 404 (not enough traffic for this origin)', async () => {
    vi.stubEnv('CRUX_API_KEY', 'test-key');
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    const GET = await freshGET();
    const res = await GET({} as unknown as Parameters<typeof GET>[0]);
    const body = await res.json();
    expect(body).toEqual({ status: 'no_data', origin: 'https://example.com' });
  });

  it('returns status "no_key" on a 401/403 (invalid API key)', async () => {
    vi.stubEnv('CRUX_API_KEY', 'bad-key');
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    const GET = await freshGET();
    const res = await GET({} as unknown as Parameters<typeof GET>[0]);
    const body = await res.json();
    expect(body).toEqual({ status: 'no_key', origin: 'https://example.com' });
  });

  it('returns 502 crux_api_error on other non-ok statuses', async () => {
    vi.stubEnv('CRUX_API_KEY', 'test-key');
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const GET = await freshGET();
    const res = await GET({} as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ error: 'crux_api_error', status: 500 });
  });

  it('returns 502 fetch_failed when the network request itself throws', async () => {
    vi.stubEnv('CRUX_API_KEY', 'test-key');
    mockFetch.mockRejectedValue(new Error('network down'));
    const GET = await freshGET();
    const res = await GET({} as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ error: 'fetch_failed' });
  });

  it('serves the second request from the in-memory cache without calling fetch again', async () => {
    vi.stubEnv('CRUX_API_KEY', 'test-key');
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    const GET = await freshGET();
    await GET({} as unknown as Parameters<typeof GET>[0]);
    await GET({} as unknown as Parameters<typeof GET>[0]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
