import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// A stand-in for one Netlify Blobs store, honoring onlyIfNew the way the real
// one does: an onlyIfNew write is skipped if the key exists, an onlyIfMatch
// write is skipped unless the stored etag is the one given. Skipped writes
// report modified: false.
const blobs = new Map<string, { raw: string; etag: string }>();
let etagCounter = 0;
const fakeStore = {
  setJSON: vi.fn(
    async (
      key: string,
      value: unknown,
      opts?: { onlyIfNew?: boolean; onlyIfMatch?: string }
    ) => {
      const current = blobs.get(key);
      if (opts?.onlyIfNew && current) return { modified: false };
      if (opts?.onlyIfMatch && current?.etag !== opts.onlyIfMatch) {
        return { modified: false };
      }
      blobs.set(key, { raw: JSON.stringify(value), etag: `e${++etagCounter}` });
      return { modified: true };
    }
  ),
  getWithMetadata: vi.fn(async (key: string) => {
    const current = blobs.get(key);
    return current
      ? { data: JSON.parse(current.raw), etag: current.etag, metadata: {} }
      : null;
  }),
  delete: vi.fn(async (key: string) => {
    blobs.delete(key);
  }),
};

vi.mock('@netlify/blobs', () => ({
  getStore: vi.fn(() => fakeStore),
}));

import {
  claimOrderEmail,
  completeOrderEmailClaim,
  releaseOrderEmailClaim,
} from './pendingOrders';

const ORDER = 'ORDER_1';

beforeEach(() => {
  blobs.clear();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-16T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('claimOrderEmail', () => {
  it('lets the first caller through and turns the second away', async () => {
    expect(await claimOrderEmail(ORDER)).toBe(true);
    expect(await claimOrderEmail(ORDER)).toBe(false);
  });

  it('lets exactly one of two simultaneous callers through', async () => {
    const results = await Promise.all([
      claimOrderEmail(ORDER),
      claimOrderEmail(ORDER),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('keeps separate orders separate', async () => {
    expect(await claimOrderEmail('A')).toBe(true);
    expect(await claimOrderEmail('B')).toBe(true);
  });

  it('can be claimed again after a release', async () => {
    await claimOrderEmail(ORDER);
    await releaseOrderEmailClaim(ORDER);
    expect(await claimOrderEmail(ORDER)).toBe(true);
  });

  it('stays closed once completed, however long ago', async () => {
    await claimOrderEmail(ORDER);
    await completeOrderEmailClaim(ORDER);
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(await claimOrderEmail(ORDER)).toBe(false);
  });

  it('holds an unfinished claim for two minutes', async () => {
    await claimOrderEmail(ORDER);
    vi.advanceTimersByTime(119 * 1000);
    expect(await claimOrderEmail(ORDER)).toBe(false);
  });

  it('lets an abandoned claim be taken over after two minutes', async () => {
    await claimOrderEmail(ORDER);
    vi.advanceTimersByTime(121 * 1000);
    expect(await claimOrderEmail(ORDER)).toBe(true);
    // ...and the takeover is itself a normal claim.
    expect(await claimOrderEmail(ORDER)).toBe(false);
  });

  it('lets only one of two callers take over an abandoned claim', async () => {
    await claimOrderEmail(ORDER);
    vi.advanceTimersByTime(121 * 1000);
    const results = await Promise.all([
      claimOrderEmail(ORDER),
      claimOrderEmail(ORDER),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('refuses a takeover if someone else replaced the claim first', async () => {
    await claimOrderEmail(ORDER);
    vi.advanceTimersByTime(121 * 1000);
    // Another delivery takes over between this caller's read and its write.
    fakeStore.getWithMetadata.mockImplementationOnce(async (key: string) => {
      const seen = blobs.get(key)!;
      const stale = { data: JSON.parse(seen.raw), etag: seen.etag };
      blobs.set(key, {
        raw: JSON.stringify({ at: Date.now(), done: false }),
        etag: 'someone-else',
      });
      return { ...stale, metadata: {} };
    });
    expect(await claimOrderEmail(ORDER)).toBe(false);
  });

  it('claims a key that was released between its two calls', async () => {
    fakeStore.setJSON.mockResolvedValueOnce({ modified: false });
    expect(await claimOrderEmail(ORDER)).toBe(true);
  });

  it('says yes when the store is broken, so the customer still gets an email', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fakeStore.setJSON.mockRejectedValueOnce(new Error('blobs down'));
    expect(await claimOrderEmail(ORDER)).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('without a blob store (local development)', () => {
  beforeEach(() => {
    vi.stubEnv('ASTRO_NODE_ENV', 'development');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('claims, refuses, releases and completes in memory', async () => {
    const order = 'LOCAL_1';
    expect(await claimOrderEmail(order)).toBe(true);
    expect(await claimOrderEmail(order)).toBe(false);
    await releaseOrderEmailClaim(order);
    expect(await claimOrderEmail(order)).toBe(true);
    await completeOrderEmailClaim(order);
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(await claimOrderEmail(order)).toBe(false);
    expect(fakeStore.setJSON).not.toHaveBeenCalled();
  });
});
