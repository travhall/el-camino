import type { APIRoute } from "astro";
import { ADMIN_COOKIE_NAME } from "@/lib/admin/auth";

export const POST: APIRoute = ({ cookies, redirect }) => {
  cookies.delete(ADMIN_COOKIE_NAME, { path: "/" });
  return redirect("/admin/login");
};
