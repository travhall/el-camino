import { defineMiddleware } from "astro:middleware";
import { randomBytes } from "node:crypto";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/admin/auth";

// Matches /admin and /admin/* but NOT /admin/login or /admin/login/*
const ADMIN_PATH = /^\/admin($|\/(?!login($|\/))).*/;

/**
 * Build a strict Content-Security-Policy header using the per-request nonce.
 *
 * - `'nonce-…'` + `'strict-dynamic'` lets us drop `'unsafe-inline'`. Astro's
 *   own runtime scripts (view transitions, hydration) are loaded by trusted
 *   nonce'd scripts, so strict-dynamic propagates trust to them.
 * - Square Web Payments SDK script hosts are allowlisted explicitly because
 *   strict-dynamic only covers scripts loaded by other scripts, not declared
 *   <script src> tags rendered server-side.
 * - `'unsafe-inline'` for styles is preserved — Tailwind v4 and view
 *   transitions still inject inline <style>, and inline-style XSS is far
 *   less dangerous than inline-script XSS. Tightening this is a separate task.
 */
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    "img-src 'self' https: data: *.wordpress.com",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://sandbox.web.squarecdn.com https://web.squarecdn.com`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' https:",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect, locals } = context;

  // 1) Generate a per-request nonce. Inline <script> tags pick this up via
  //    `nonce={Astro.locals.nonce}` so they pass the strict CSP below.
  locals.nonce = randomBytes(16).toString("base64");

  // 2) Admin auth gate (unchanged behavior — just checks the session cookie).
  if (ADMIN_PATH.test(url.pathname)) {
    const secret = process.env.ADMIN_SECRET;
    if (!secret) {
      console.error("[admin-auth] ADMIN_SECRET env var is not set");
      return new Response("Admin not configured", { status: 503 });
    }
    const token = cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!verifySessionToken(secret, token)) {
      const loginUrl = new URL("/admin/login", url);
      loginUrl.searchParams.set("from", url.pathname);
      return redirect(loginUrl.toString());
    }
  }

  // 3) Run the route handler, then attach CSP to HTML responses.
  const response = await next();
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    response.headers.set("Content-Security-Policy", buildCsp(locals.nonce));
  }
  return response;
});
