import type { APIRoute } from "astro";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "admin_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function makeToken(secret: string): string {
  return createHmac("sha256", secret).update("admin:authenticated").digest("hex");
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const secret = process.env.ADMIN_SECRET;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!secret || !adminPassword) {
    console.error("[admin-auth] ADMIN_SECRET or ADMIN_PASSWORD env var is not set");
    return new Response("Admin not configured", { status: 503 });
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

    cookies.set(COOKIE_NAME, makeToken(secret), {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: "strict",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });

    return redirect(from);
  } catch {
    return redirect(`/admin/login?from=${encodeURIComponent(from)}&error=1`);
  }
};
