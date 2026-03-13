import { defineMiddleware } from "astro:middleware";
import { createHmac } from "node:crypto";

const COOKIE_NAME = "admin_session";

// Matches /admin and /admin/* but NOT /admin/login or /admin/login/*
const ADMIN_PATH = /^\/admin($|\/(?!login($|\/))).*/;

function expectedToken(secret: string): string {
  return createHmac("sha256", secret).update("admin:authenticated").digest("hex");
}

export const onRequest = defineMiddleware(({ url, cookies, redirect }, next) => {
  if (!ADMIN_PATH.test(url.pathname)) {
    return next();
  }

  const secret = import.meta.env.ADMIN_SECRET;

  if (!secret) {
    console.error("[admin-auth] ADMIN_SECRET env var is not set");
    return new Response("Admin not configured", { status: 503 });
  }

  const token = cookies.get(COOKIE_NAME)?.value;

  if (token && token === expectedToken(secret)) {
    return next();
  }

  const loginUrl = new URL("/admin/login", url);
  loginUrl.searchParams.set("from", url.pathname);
  return redirect(loginUrl.toString());
});
