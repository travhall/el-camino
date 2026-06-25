import type { APIRoute } from "astro";
import { timingSafeEqual } from "node:crypto";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  assertSameOrigin,
  issueSessionToken,
} from "@/lib/admin/auth";
import { createRateLimiter, clientIp } from "@/lib/rateLimit";

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// 8 attempts per 15 min per IP. Per-instance only.
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 8 });

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const secret = process.env.ADMIN_SECRET;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!secret || !adminPassword) {
    console.error("[admin-auth] ADMIN_SECRET or ADMIN_PASSWORD env var is not set");
    return new Response("Admin not configured", { status: 503 });
  }

  if (!assertSameOrigin(request)) {
    return new Response("Bad origin", { status: 403 });
  }

  if (loginLimiter.check(clientIp(request))) {
    return new Response("Too many attempts. Try again later.", { status: 429 });
  }

  let from = "/admin";

  try {
    const formData = await request.formData();
    const submitted = (formData.get("password") as string) ?? "";
    from = (formData.get("from") as string) || "/admin";

    // Validate `from` to prevent open redirect
    if (!from.startsWith("/admin")) {
      from = "/admin";
    }

    if (!safeCompare(submitted, adminPassword)) {
      return redirect(`/admin/login?from=${encodeURIComponent(from)}&error=1`);
    }

    cookies.set(ADMIN_COOKIE_NAME, issueSessionToken(secret), {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: ADMIN_SESSION_TTL_SECONDS,
    });

    return redirect(from);
  } catch {
    return redirect(`/admin/login?from=${encodeURIComponent(from)}&error=1`);
  }
};
