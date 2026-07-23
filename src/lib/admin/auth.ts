// Shared admin auth helpers.
//
// Session token format: `<iat>.<exp>.<hex-hmac>` where the HMAC covers `<iat>.<exp>`.
// Including `iat` makes each issued token unique and `exp` bounds its lifetime,
// so a leaked cookie naturally expires instead of being valid forever.
//
// Cross-site form posts are already blocked by `SameSite=Strict` on the cookie;
// `assertSameOrigin` adds a second layer that rejects POSTs whose Origin/Referer
// doesn't match the request host.

import type { AstroCookies } from "astro";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE_NAME = "admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function hmac(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function issueSessionToken(secret: string, ttlSeconds = ADMIN_SESSION_TTL_SECONDS): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlSeconds;
  const payload = `${iat}.${exp}`;
  return `${payload}.${hmac(secret, payload)}`;
}

export function verifySessionToken(secret: string, token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [iatStr, expStr, sig] = parts;
  const iat = Number(iatStr);
  const exp = Number(expStr);
  if (!Number.isFinite(iat) || !Number.isFinite(exp)) return false;
  if (Math.floor(Date.now() / 1000) >= exp) return false;
  const expected = hmac(secret, `${iatStr}.${expStr}`);
  return safeEqual(sig, expected);
}

/**
 * Returns true if the request's Origin (or Referer) matches the request URL host.
 * Used as a defense-in-depth CSRF check on admin mutation routes.
 */
export function assertSameOrigin(request: Request): boolean {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === url.host;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === url.host;
    } catch {
      return false;
    }
  }
  // No Origin or Referer header on a state-changing request: reject.
  return false;
}

export function isAuthenticated(request: Request, cookieValue: string | undefined): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  if (!verifySessionToken(secret, cookieValue)) return false;
  // Same-origin check only applies to state-changing methods.
  if (request.method !== "GET" && request.method !== "HEAD") {
    if (!assertSameOrigin(request)) return false;
  }
  return true;
}

/**
 * Convenience wrapper over `isAuthenticated` for admin API routes — reads
 * the session cookie for you.
 */
export function isAdminAuthenticated(request: Request, cookies: AstroCookies): boolean {
  return isAuthenticated(request, cookies.get(ADMIN_COOKIE_NAME)?.value);
}

/**
 * Parse a request body as FormData, returning null on failure instead of
 * throwing. Shared by admin API routes that all handle malformed form
 * submissions the same way.
 */
export async function parseAdminFormData(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
