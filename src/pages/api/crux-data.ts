import type { APIRoute } from "astro";
import { siteConfig } from "@/lib/site-config";

const CRUX_API_URL =
  "https://chromeuxreport.googleapis.com/v1/records:queryRecord";

// Cache CrUX responses for 1 hour to avoid hammering the API
const cache = new Map<string, { data: unknown; expires: number }>();

export const GET: APIRoute = async () => {
  const apiKey = process.env.CRUX_API_KEY;
  const origin = siteConfig.url;
  const cacheKey = origin;

  // Serve from cache if fresh
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expires) {
    return new Response(JSON.stringify(cached.data), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  const url = apiKey
    ? `${CRUX_API_URL}?key=${apiKey}`
    : CRUX_API_URL;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin }),
    });
  } catch (err) {
    console.error("[crux-data] fetch error:", err);
    return new Response(JSON.stringify({ error: "fetch_failed" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 404 means no CrUX data for this origin yet (not enough traffic)
  if (res.status === 404) {
    const payload = { status: "no_data", origin };
    cache.set(cacheKey, { data: payload, expires: Date.now() + 3600_000 });
    return new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // 401/403 means no valid API key configured
  if (res.status === 401 || res.status === 403) {
    const payload = { status: "no_key", origin };
    return new Response(JSON.stringify(payload), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!res.ok) {
    console.error(`[crux-data] CrUX API error ${res.status}`);
    return new Response(JSON.stringify({ error: "crux_api_error", status: res.status }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const raw = await res.json();
  const metrics = raw?.record?.metrics ?? {};

  const extract = (key: string) => {
    const p75 = metrics[key]?.percentiles?.p75;
    return p75 !== undefined ? p75 : null;
  };

  const payload = {
    status: "ok",
    origin,
    // p75 field data from real Chrome users
    lcp: extract("largest_contentful_paint"),       // milliseconds
    inp: extract("interaction_to_next_paint"),       // milliseconds
    cls: extract("cumulative_layout_shift"),         // unitless score (×100 in API, but comes as float)
    fcp: extract("first_contentful_paint"),          // milliseconds
    ttfb: extract("experimental_time_to_first_byte"),// milliseconds
    // fraction of URLs passing "good" threshold
    lcpGoodPercent: metrics["largest_contentful_paint"]?.histogram
      ? metrics["largest_contentful_paint"].histogram[0]?.density ?? null
      : null,
    inpGoodPercent: metrics["interaction_to_next_paint"]?.histogram
      ? metrics["interaction_to_next_paint"].histogram[0]?.density ?? null
      : null,
    clsGoodPercent: metrics["cumulative_layout_shift"]?.histogram
      ? metrics["cumulative_layout_shift"].histogram[0]?.density ?? null
      : null,
  };

  cache.set(cacheKey, { data: payload, expires: Date.now() + 3600_000 });

  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
