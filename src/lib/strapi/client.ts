// src/lib/strapi/client.ts
import type { StrapiResponse } from "../types/strapi";

const STRAPI_URL = import.meta.env.STRAPI_URL;
const STRAPI_API_TOKEN = import.meta.env.STRAPI_API_TOKEN;

interface FetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  params?: Record<string, string>;
}

export async function fetchAPI<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<StrapiResponse<T>> {
  const { method = "GET", params } = options;

  const url = new URL(`${STRAPI_URL}/api/${endpoint}`);

  // Add query parameters
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  console.log("Fetching:", url.toString());

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    body: method !== "GET" ? JSON.stringify(options) : undefined,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    console.error("API Error:", {
      status: res.status,
      statusText: res.statusText,
      error: errorData,
    });
    throw new Error(
      `API Error ${res.status}: ${errorData?.error?.message || res.statusText}`
    );
  }

  const data = await res.json();
  return data;
}
