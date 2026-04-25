import { defineMiddleware } from "astro:middleware";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/admin/auth";

// Matches /admin and /admin/* but NOT /admin/login or /admin/login/*
const ADMIN_PATH = /^\/admin($|\/(?!login($|\/))).*/;

export const onRequest = defineMiddleware(({ url, cookies, redirect }, next) => {
  if (!ADMIN_PATH.test(url.pathname)) {
    return next();
  }

  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    console.error("[admin-auth] ADMIN_SECRET env var is not set");
    return new Response("Admin not configured", { status: 503 });
  }

  const token = cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (verifySessionToken(secret, token)) {
    return next();
  }

  const loginUrl = new URL("/admin/login", url);
  loginUrl.searchParams.set("from", url.pathname);
  return redirect(loginUrl.toString());
});
