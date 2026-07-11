// src/lib/wordpress/content-utils.ts
// Utility functions for processing WordPress content

/**
 * Minimal XSS hardening for HTML coming out of WordPress before it reaches
 * `set:html`. WordPress is admin-controlled but a CMS-side compromise (or a
 * misbehaving plugin) shouldn't immediately mean script execution on the
 * storefront.
 *
 * We strip three classes of injection without touching legitimate markup:
 *   - <script>...</script>, <style> on* attributes, etc.
 *   - inline event handlers (onclick=, onerror=, ...)
 *   - javascript: / vbscript: / data:text/html URIs in href/src/etc.
 *
 * We do NOT remove iframes here — the pipeline relies on iframe embeds
 * (YouTube, Calendly, etc.) and reduces YouTube to a facade downstream.
 */
export function stripUnsafeHtml(html: string): string {
  if (!html) return html;
  return (
    html
      // Drop <script>...</script> and standalone <script ... />
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
      .replace(/<script\b[^>]*\/?>/gi, "")
      // Drop inline event handler attributes: on*="..." | on*='...' | on*=value
      .replace(/\s+on[a-z]+\s*=\s*"(?:[^"]*)"/gi, "")
      .replace(/\s+on[a-z]+\s*=\s*'(?:[^']*)'/gi, "")
      .replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, "")
      // Neutralize javascript:/vbscript:/data:(html|javascript) URIs in any attribute
      .replace(/(href|src|xlink:href|formaction|action|poster)\s*=\s*"\s*(?:(?:javascript|vbscript):|data:(?:text\/html|application\/javascript))[^"]*"/gi, '$1="#"')
      .replace(/(href|src|xlink:href|formaction|action|poster)\s*=\s*'\s*(?:(?:javascript|vbscript):|data:(?:text\/html|application\/javascript))[^']*'/gi, "$1='#'")
  );
}

/**
 * Clean and sanitize WordPress content for display
 */
export function sanitizeWordPressContent(content: string): string {
  if (!content) return "";

  // Remove WordPress's automatic p tags around images
  return (
    content
      .replace(/<p>(\s*<img[^>]*>\s*)<\/p>/gi, "$1")
      .replace(/<p>(\s*<figure[^>]*>[\s\S]*?<\/figure>\s*)<\/p>/gi, "$1")
      .replace(/<p>(\s*<iframe[^>]*>[\s\S]*?<\/iframe>\s*)<\/p>/gi, "$1")
      // Fix WordPress's sometimes broken figure captions
      .replace(/<figcaption class="wp-element-caption">/gi, "<figcaption>")
      // Ensure proper spacing around blocks
      .replace(
        /(<\/figure>|<\/blockquote>|<\/div>)(\s*)(<h[1-6])/gi,
        "$1\n\n$3"
      )
      // Clean up extra whitespace
      .replace(/\n\s*\n\s*\n/g, "\n\n")
      .trim()
  );
}

/**
 * Get WordPress image URLs with optimization parameters
 */
export function optimizeWordPressImage(
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    crop?: boolean;
  } = {}
): string {
  if (!url || !url.includes("wordpress.com")) {
    return url;
  }

  const urlObj = new URL(url);
  const params = new URLSearchParams(urlObj.search);

  if (options.width) {
    params.set("w", options.width.toString());
  }

  if (options.height) {
    params.set("h", options.height.toString());
  }

  if (options.quality) {
    params.set("quality", options.quality.toString());
  }

  if (options.crop) {
    params.set("crop", "1");
  }

  // Default optimization
  if (!params.has("quality")) {
    params.set("quality", "85");
  }

  urlObj.search = params.toString();
  return urlObj.toString();
}

/**
 * Generate responsive image srcset for WordPress images
 */
export function generateWordPressSrcSet(
  url: string,
  baseWidth: number = 800
): string {
  if (!url || !url.includes("wordpress.com")) {
    return "";
  }

  const sizes = [
    Math.round(baseWidth * 0.5),
    Math.round(baseWidth * 0.75),
    baseWidth,
    Math.round(baseWidth * 1.5),
    Math.round(baseWidth * 2),
  ];

  return sizes
    .map((width) => `${optimizeWordPressImage(url, { width })} ${width}w`)
    .join(", ");
}

/**
 * Post-process raw WordPress HTML before set:html rendering.
 *
 * Prevents CLS by injecting width/height on unsized <img> tags.
 * Also routes WordPress image URLs through Netlify Image CDN and
 * adds lazy loading for below-fold content.
 *
 * Use on all set:html={block.html} fallback paths in WordPressBlockParser.
 */
export function processRawWordPressHTML(
  html: string,
  options: {
    defaultWidth?: number;
    defaultHeight?: number;
    isAboveFold?: boolean;
  } = {}
): string {
  if (!html) return html;

  const { defaultWidth = 800, defaultHeight = 600, isAboveFold = false } =
    options;

  let processed = html;

  // Step 0: Replace YouTube iframes with a lightweight facade.
  // The live YouTube player is the LCP element and takes 8-9s to load.
  // A static thumbnail from img.youtube.com loads in ~200ms, improving LCP
  // dramatically. The player loads only when the user clicks to play.
  // Also switches to youtube-nocookie.com to eliminate SameSite cookie warnings.
  //
  // Handles two WordPress patterns:
  //   A) <span class="embed-youtube"><iframe src="...youtube.com/embed/ID..."></iframe></span>
  //   B) <iframe src="...youtube.com/embed/ID..."></iframe>  (raw embed)

  function youtubeFacadeHtml(videoId: string): string {
    const thumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    return (
      `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:1.5rem 0;background:var(--surface-secondary);border-radius:0.5rem;" class="youtube-facade" data-videoid="${videoId}">` +
      `<img src="${thumb}" alt="YouTube video thumbnail" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;" width="480" height="360" loading="lazy" decoding="async" />` +
      `<button class="youtube-play-btn" data-videoid="${videoId}" aria-label="Play YouTube video" style="position:absolute;inset:0;width:100%;height:100%;background:transparent;border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;">` +
      `<span style="width:4rem;height:4rem;border-radius:9999px;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;transition:background-color 0.2s;" aria-hidden="true">` +
      `<svg style="width:2rem;height:2rem;fill:white;margin-left:0.25rem;" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>` +
      `</span></button></div>`
    );
  }

  // Pattern A: span.embed-youtube wrapper containing a YouTube iframe
  processed = processed.replace(
    /<span[^>]*class="[^"]*embed-youtube[^"]*"[^>]*>[\s\S]*?<iframe[^>]*src=["']https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([^"'?&\s/]+)[^"']*["'][^>]*>(?:<\/iframe>)?[\s\S]*?<\/span>/gi,
    (_match: string, videoId: string) => youtubeFacadeHtml(videoId)
  );

  // Pattern B: standalone YouTube iframe not inside an embed-youtube span
  processed = processed.replace(
    /<iframe[^>]*src=["']https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([^"'?&\s/]+)[^"']*["'][^>]*>(?:<\/iframe>)?/gi,
    (_match: string, videoId: string) => youtubeFacadeHtml(videoId)
  );

  // Step 1: Make iframe embeds responsive to prevent CLS.
  // WordPress outputs: <span class="embed-youtube" style="..."><iframe width="640" height="360" ...>
  // The fixed pixel dimensions cause layout shift when CSS constrains the width.
  // Fix: wrap the span with a padding-bottom aspect-ratio container and strip
  // the fixed width/height from the iframe so CSS takes full control.
  processed = processed.replace(
    /(<span[^>]*class="[^"]*embed-(?:youtube|vimeo|responsive)[^"]*"[^>]*>)([\s\S]*?)(<\/span>)/gi,
    (_match, openTag, inner, closeTag) => {
      // Strip fixed width/height from any iframes inside the wrapper
      const cleanedInner = inner.replace(
        /<iframe([^>]*)>/gi,
        (_iMatch: string, attrs: string) => {
          const cleaned = attrs
            .replace(/\s*width=["']?\d+["']?/gi, "")
            .replace(/\s*height=["']?\d+["']?/gi, "");
          return `<iframe${cleaned}>`;
        }
      );
      // Wrap in a responsive aspect-ratio container using inline styles
      // (inline styles are more reliable than CSS classes for WordPress-rendered HTML
      // since the class selector depends on DOM ancestry matching)
      return `<div style="position:relative;width:100%;padding-bottom:56.25%;height:0;overflow:hidden;margin:1.5rem 0;">${openTag.replace(/style="[^"]*"/i, 'style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"')}${cleanedInner}${closeTag}</div>`;
    }
  );

  // Step 2: Inject title attributes on <iframe> tags that lack one.
  // WCAG 4.1.2 / Lighthouse frame-title: every iframe must have a descriptive title
  // for screen readers. WordPress post content may contain raw iframes (e.g. from
  // shortcodes or classic editor embeds) that were never processed by WPEmbed.astro.
  processed = processed.replace(/<iframe([^>]*)>/gi, (_match, attrs: string) => {
    // Already has a title — leave it alone
    if (/\btitle\s*=/i.test(attrs)) {
      return `<iframe${attrs}>`;
    }

    // Derive a meaningful title from the src URL when possible
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    const src = srcMatch ? srcMatch[1] : "";

    let title = "Embedded content";
    if (src.includes("youtube.com") || src.includes("youtu.be")) {
      title = "YouTube video player";
    } else if (src.includes("vimeo.com")) {
      title = "Vimeo video player";
    } else if (src.includes("spotify.com")) {
      title = "Spotify player";
    } else if (src.includes("soundcloud.com")) {
      title = "SoundCloud player";
    } else if (src.includes("google.com/maps")) {
      title = "Google Maps";
    } else if (src.includes("twitter.com") || src.includes("x.com")) {
      title = "Twitter / X post";
    } else if (src.includes("instagram.com")) {
      title = "Instagram post";
    }

    return `<iframe${attrs} title="${title}">`;
  });

  // Step 4: Process <img> tags — inject dimensions and CDN routing.
  processed = processed.replace(/<img([^>]*)>/gi, (_match, attrs: string) => {
    const widthMatch = attrs.match(/width=["']?(\d+)["']?/i);
    const heightMatch = attrs.match(/height=["']?(\d+)["']?/i);
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);

    const existingWidth = widthMatch ? parseInt(widthMatch[1]) : null;
    const existingHeight = heightMatch ? parseInt(heightMatch[1]) : null;
    const src = srcMatch ? srcMatch[1] : null;

    const imgWidth = existingWidth || defaultWidth;
    const imgHeight = existingHeight || defaultHeight;

    let newAttrs = attrs;

    // Inject width/height if missing — browser can reserve space before image loads.
    if (!existingWidth) newAttrs += ` width="${imgWidth}"`;
    if (!existingHeight) newAttrs += ` height="${imgHeight}"`;

    // Route WordPress images through Netlify Image CDN.
    if (
      src &&
      (src.includes("wordpress.com") || src.includes("wp.com")) &&
      !src.startsWith("/.netlify/images")
    ) {
      const cdnUrl = buildNetlifyImageCDNUrl(src, imgWidth);
      newAttrs = newAttrs.replace(src, cdnUrl);
    }

    // Lazy load below-fold images.
    if (!isAboveFold && !attrs.includes("loading=")) {
      newAttrs += ' loading="lazy"';
    }

    // Async decoding reduces main-thread blocking.
    if (!attrs.includes("decoding=")) {
      newAttrs += ' decoding="async"';
    }

    // Ensure all images have at least an empty alt attribute for accessibility
    if (!/alt=["']/i.test(attrs)) {
      newAttrs += ' alt=""';
    }

    return `<img${newAttrs}>`;
  });

  return stripUnsafeHtml(processed);
}

/**
 * Build a Netlify Image CDN URL for a WordPress image source.
 * Width-only (no height) preserves aspect ratio for arbitrary content images.
 */
function buildNetlifyImageCDNUrl(src: string, width: number): string {
  try {
    const params = new URLSearchParams({
      url: src,
      w: Math.min(width, 1200).toString(),
      q: "75",
    });
    return `/.netlify/images?${params.toString()}`;
  } catch {
    return src;
  }
}
