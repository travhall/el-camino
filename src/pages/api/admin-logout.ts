import type { APIRoute } from "astro";

const COOKIE_NAME = "admin_session";

export const POST: APIRoute = ({ cookies, redirect }) => {
  cookies.delete(COOKIE_NAME, { path: "/" });
  return redirect("/admin/login");
};
