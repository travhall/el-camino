// src/pages/api/admin/shop-status.ts
// Admin-only endpoint for managing the shop open-status override.
// Handles three actions: save-override, add-holiday, remove-holiday.

import type { APIRoute } from "astro";
import { isAdminAuthenticated, parseAdminFormData } from "@/lib/admin/auth";
import type { HolidayEntry } from "@/lib/shopStatus";
import { getShopStatusConfig, saveShopStatusConfig } from "@/lib/shopStatus";

const REDIRECT_BASE = "/admin/notifications/shop-status";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!isAdminAuthenticated(request, cookies)) {
    return redirect(`/admin/login?from=${REDIRECT_BASE}`);
  }

  const body = await parseAdminFormData(request);
  if (!body) return new Response("Invalid form data", { status: 400 });

  const action = (body.get("action") as string)?.trim();
  const config = await getShopStatusConfig();

  // ── save-override ──────────────────────────────────────────────────────────
  if (action === "save-override") {
    const mode = body.get("mode") as string;
    if (!["auto", "open", "closed"].includes(mode)) {
      return new Response("Invalid mode", { status: 400 });
    }
    const until = (body.get("until") as string | null)?.trim() || undefined;

    config.mode = mode as "auto" | "open" | "closed";
    // Clear until when reverting to auto so stale data doesn't linger
    config.until = mode === "auto" ? undefined : until;

    await saveShopStatusConfig(config);
    return redirect(`${REDIRECT_BASE}?saved=override`);
  }

  // ── add-holiday ────────────────────────────────────────────────────────────
  if (action === "add-holiday") {
    const label = (body.get("label") as string)?.trim();
    const type = (body.get("type") as string)?.trim();
    const dateVal = (body.get("date") as string)?.trim();
    const recurringVal = (body.get("recurring") as string)?.trim();

    if (!label) {
      return redirect(`${REDIRECT_BASE}?error=missing-label`);
    }

    const entry: HolidayEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label,
    };

    if (type === "recurring") {
      if (!recurringVal || !/^\d{2}-\d{2}$/.test(recurringVal)) {
        return redirect(`${REDIRECT_BASE}?error=invalid-date`);
      }
      entry.recurring = recurringVal;
    } else {
      if (!dateVal || !/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
        return redirect(`${REDIRECT_BASE}?error=invalid-date`);
      }
      entry.date = dateVal;
    }

    config.holidays.push(entry);
    await saveShopStatusConfig(config);
    return redirect(`${REDIRECT_BASE}?saved=holiday`);
  }

  // ── remove-holiday ─────────────────────────────────────────────────────────
  if (action === "remove-holiday") {
    const id = (body.get("id") as string)?.trim();
    if (!id) return new Response("Missing id", { status: 400 });
    config.holidays = config.holidays.filter((h) => h.id !== id);
    await saveShopStatusConfig(config);
    return redirect(`${REDIRECT_BASE}?removed=holiday`);
  }

  return new Response("Unknown action", { status: 400 });
};
