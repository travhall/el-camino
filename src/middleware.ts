import { defineMiddleware } from "astro:middleware";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/admin/auth";
import { randomBytes } from "node:crypto";

// Matches /admin and /admin/* but NOT /admin/login or /admin/login/*
const ADMIN_PATH = /^\/admin($|\/(?!login($|\/))).*/;

export const onRequest = defineMiddleware(async ({ url, cookies, redirect, locals }, next) => {
  // Generate a per-request nonce for CSP — must happen before next() so
  // layouts can read it from Astro.locals when rendering inline scripts.
  locals.nonce = randomBytes(16).toString("base64");

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

  const response = await next();

  const nonce = locals.nonce;
  response.headers.set(
    "Content-Security-Policy",
    `default-src 'self'; img-src 'self' https: data: *.wordpress.com; script-src 'self' 'nonce-${nonce}' https://sandbox.web.squarecdn.com https://web.squarecdn.com; style-src 'self' 'nonce-${nonce}'; font-src 'self' https:; connect-src 'self' https: wss:; frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com; object-src 'none'; base-uri 'self'; form-action 'self'`
  );

  return response;
});
