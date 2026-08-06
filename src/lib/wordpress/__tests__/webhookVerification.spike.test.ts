// Spike proof-of-concept for plan 121 — see
// plans/121-spike-wordpress-webhook-cache-invalidation.md.
//
// Proves receive+verify is feasible for a WordPress.com native webhook
// (publish_post/publish_page), given what Step 1/2 of that spike confirmed:
//   - body is form-urlencoded, not JSON (unlike Square's webhook)
//   - WordPress.com's native webhook config lets you set only a target URL,
//     with no HMAC/signature support — so a shared secret embedded as a URL
//     query parameter is the practical verification mechanism (the same
//     pattern Slack/Discord incoming webhooks use)
//   - payload fields are whichever ones the wp-admin webhook form selects,
//     plus `hook`; this assumes `post_name` (WordPress's internal slug
//     field) and `post_type` are selected, since Step 3's targeted
//     cache-bust needs them
//
// Disposable: not wired into src/pages/api, not a shipped endpoint. If plan
// 121's write-up leads to a real build, promote the verify function into
// src/lib/wordpress/ and add a src/pages/api/webhooks/wordpress.ts route
// modeled on src/pages/api/webhooks/square.ts.

import { describe, it, expect } from 'vitest';
import { timingSafeEqual } from 'node:crypto';

function verifyWordPressWebhookSecret(
  requestUrl: string,
  expectedSecret: string
): boolean {
  const url = new URL(requestUrl);
  const provided = url.searchParams.get('secret') ?? '';

  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expectedSecret);

  // timingSafeEqual throws on length mismatch instead of returning false
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

function parseWordPressWebhookPayload(rawBody: string) {
  const params = new URLSearchParams(rawBody);
  return {
    hook: params.get('hook'),
    postType: params.get('post_type'),
    slug: params.get('post_name'),
    title: params.get('post_title'),
  };
}

describe('WordPress.com webhook receive+verify (spike PoC — plan 121)', () => {
  const SECRET = 'test-shared-secret';
  const ENDPOINT = 'https://example.com/api/webhooks/wordpress';

  it('accepts a request with the correct secret query param', () => {
    const requestUrl = `${ENDPOINT}?secret=${SECRET}`;
    expect(verifyWordPressWebhookSecret(requestUrl, SECRET)).toBe(true);
  });

  it('rejects a request with a wrong secret', () => {
    const requestUrl = `${ENDPOINT}?secret=wrong-secret`;
    expect(verifyWordPressWebhookSecret(requestUrl, SECRET)).toBe(false);
  });

  it('rejects a request with no secret at all', () => {
    expect(verifyWordPressWebhookSecret(ENDPOINT, SECRET)).toBe(false);
  });

  it('parses a realistic WordPress.com publish_post payload (form-urlencoded)', () => {
    const rawBody =
      'hook=publish_post&post_title=Summer+Sale&post_name=summer-sale&post_type=post&post_url=https%3A%2F%2Felcaminoskateshop.wordpress.com%2F2026%2F08%2Fsummer-sale';

    const parsed = parseWordPressWebhookPayload(rawBody);

    expect(parsed).toEqual({
      hook: 'publish_post',
      postType: 'post',
      slug: 'summer-sale',
      title: 'Summer Sale',
    });
  });

  it('parses publish_page the same way, distinguishing post_type', () => {
    const rawBody =
      'hook=publish_page&post_title=Shipping+Policy&post_name=shipping-policy&post_type=page';

    const parsed = parseWordPressWebhookPayload(rawBody);

    expect(parsed.hook).toBe('publish_page');
    expect(parsed.postType).toBe('page');
    expect(parsed.slug).toBe('shipping-policy');
  });
});
