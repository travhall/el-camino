// src/middleware.ts
// Async-load non-critical CSS to reduce render-blocking time.
// Applies only to full browser navigations (Sec-Fetch-Mode: navigate),
// not to Astro ClientRouter prefetch/navigation fetches.
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();

  // Only process HTML responses
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  // Only apply to full browser navigations, not ClientRouter fetches
  const fetchMode = _context.request.headers.get("sec-fetch-mode");
  if (fetchMode && fetchMode !== "navigate") {
    return response;
  }

  const html = await response.text();

  // Convert cart CSS <link> tags to non-render-blocking async loading.
  // Cart components (MiniCart, QuickView, Modal) are hidden at page load,
  // so their CSS is not needed before first paint.
  // Pattern: <link rel="stylesheet" href="/_astro/cart.*.css...">
  const modified = html.replace(
    /(<link\s[^>]*href="([^"]*\/_astro\/cart\.[^"]+\.css[^"]*)"[^>]*rel="stylesheet"[^>]*>|<link\s[^>]*rel="stylesheet"[^>]*href="([^"]*\/_astro\/cart\.[^"]+\.css[^"]*)"[^>]*>)/g,
    (match, _full, href1, href2) => {
      const href = href1 || href2;
      return [
        `<link rel="preload" as="style" href="${href}" onload="this.onload=null;this.rel='stylesheet'">`,
        `<noscript><link rel="stylesheet" href="${href}"></noscript>`,
      ].join("");
    },
  );

  // Build new headers, removing Content-Length since we modified the body
  const headers = new Headers(response.headers);
  headers.delete("content-length");

  return new Response(modified, {
    status: response.status,
    headers,
  });
});
