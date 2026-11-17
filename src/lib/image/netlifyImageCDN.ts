// src/lib/image/netlifyImageCDN.ts
//
// The one place an image CDN URL is built. Every component, script and
// server-side optimizer routes through toNetlifyImageCDN, so quality, fit and
// the endpoint are decided once (plan 161). It has no imports, so client
// scripts can use it without pulling in the optimizer.
//
// Exempt, on purpose: the static srcset attributes in pages/the-shop (relative
// paths, which the guard below would pass through) and the WordPress content
// builder (its own parameter shape). A test fails if another file spells the
// endpoint.
export const IMAGE_CDN_PREFIX = '/.netlify/images';

/**
 * Route an absolute http(s) image URL through the Netlify Image CDN.
 * Anything else (relative paths, data URIs, empty input) is returned as is.
 *
 * Parameter order is fixed (url, w, q, fit, h, fm) so the same inputs always
 * give the same URL, which is also the CDN cache key.
 *
 * @param width  Desired output width in pixels
 * @param opts   height; quality (default 80); fit (default "cover", null to
 *               omit and keep the aspect ratio); format (the `fm` param)
 */
export function toNetlifyImageCDN(
  src: string,
  width: number,
  opts: {
    height?: number;
    quality?: number;
    fit?: string | null;
    format?: string;
  } = {}
): string {
  if (!src?.startsWith('http')) return src ?? '';
  const { height, quality = 80, fit = 'cover', format } = opts;
  const params = new URLSearchParams({
    url: src,
    w: String(width),
    q: String(quality),
  });
  if (fit) params.set('fit', fit);
  if (height) params.set('h', String(height));
  if (format) params.set('fm', format);
  return `${IMAGE_CDN_PREFIX}?${params.toString()}`;
}
