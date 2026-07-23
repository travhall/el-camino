import type { APIRoute } from "astro";
import { ADMIN_COOKIE_NAME, assertSameOrigin } from "@/lib/admin/auth";

export const POST: APIRoute = ({ request, cookies, redirect }) => {
  if (!assertSameOrigin(request)) {
    return new Response("Forbidden", { status: 403 });
  }
  cookies.delete(ADMIN_COOKIE_NAME, { path: "/" });
  return redirect("/admin/login");
};
