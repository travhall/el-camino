import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/admin/auth', () => ({
  isAdminAuthenticated: vi.fn().mockReturnValue(true),
  parseAdminFormData: vi.fn(async (request: Request) => {
    try {
      return await request.formData();
    } catch {
      return null;
    }
  }),
}));

vi.mock('@/lib/socialLinks', () => ({
  KNOWN_PLATFORMS: { instagram: 'uil:instagram', twitter: 'uil:twitter' },
  getSocialLinks: vi.fn(),
  saveSocialLinks: vi.fn(),
}));

import { POST } from '../social';
import { isAdminAuthenticated } from '@/lib/admin/auth';
import {
  getSocialLinks,
  saveSocialLinks,
  type SocialLink,
} from '@/lib/socialLinks';

const URL_BASE = 'https://example.com/api/admin/social';

type Context = Parameters<typeof POST>[0];

function makeContext(fields: Record<string, string>): Context {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  const request = new Request(URL_BASE, { method: 'POST', body: formData });
  return {
    request,
    cookies: {},
    redirect: (url: string) =>
      new Response(null, { status: 302, headers: { Location: url } }),
  } as unknown as Context;
}

const existingLinks: SocialLink[] = [
  {
    platform: 'instagram',
    url: 'https://instagram.com/shop',
    icon: 'uil:instagram',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAdminAuthenticated).mockReturnValue(true);
  vi.mocked(getSocialLinks).mockResolvedValue(existingLinks);
  vi.mocked(saveSocialLinks).mockResolvedValue(undefined);
});

describe('POST /api/admin/social', () => {
  it('redirects to login when not authenticated', async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);
    const res = await POST(
      makeContext({
        action: 'add',
        platform: 'twitter',
        url: 'https://twitter.com/shop',
      })
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('/admin/login');
  });

  it('returns 400 for an unknown action', async () => {
    const res = await POST(makeContext({ action: 'unknown' }));
    expect(res.status).toBe(400);
  });

  describe('action=add', () => {
    it('redirects with error=missing-fields when platform or url is absent', async () => {
      const res = await POST(
        makeContext({ action: 'add', platform: 'twitter' })
      );
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toContain('error=missing-fields');
    });

    it('redirects with error=invalid-url when the url has a disallowed scheme', async () => {
      const res = await POST(
        makeContext({
          action: 'add',
          platform: 'twitter',
          url: 'javascript:alert(1)',
        })
      );
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toContain('error=invalid-url');
    });

    it('redirects with error=duplicate when platform already exists', async () => {
      const res = await POST(
        makeContext({
          action: 'add',
          platform: 'instagram',
          url: 'https://instagram.com/other',
        })
      );
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toContain('error=duplicate');
    });

    it('saves the new link and redirects with saved=1 on success', async () => {
      const res = await POST(
        makeContext({
          action: 'add',
          platform: 'twitter',
          url: 'https://twitter.com/shop',
        })
      );
      expect(saveSocialLinks).toHaveBeenCalledWith([
        ...existingLinks,
        expect.objectContaining({
          platform: 'twitter',
          url: 'https://twitter.com/shop',
        }),
      ]);
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toContain('saved=1');
    });
  });

  describe('action=remove', () => {
    it('removes the platform and redirects with saved=1', async () => {
      const res = await POST(
        makeContext({ action: 'remove', platform: 'instagram' })
      );
      expect(saveSocialLinks).toHaveBeenCalledWith([]);
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toContain('saved=1');
    });
  });

  describe('action=update-url', () => {
    it('redirects with error=invalid-url for a bad scheme', async () => {
      const res = await POST(
        makeContext({
          action: 'update-url',
          platform: 'instagram',
          url: 'ftp://bad.com',
        })
      );
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toContain('error=invalid-url');
    });

    it('updates the url for the matching platform and redirects with saved=1', async () => {
      const res = await POST(
        makeContext({
          action: 'update-url',
          platform: 'instagram',
          url: 'https://instagram.com/new',
        })
      );
      expect(saveSocialLinks).toHaveBeenCalledWith([
        expect.objectContaining({
          platform: 'instagram',
          url: 'https://instagram.com/new',
        }),
      ]);
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toContain('saved=1');
    });
  });
});
