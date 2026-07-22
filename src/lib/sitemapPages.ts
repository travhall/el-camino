// Builds the list of dynamic routes (products, categories, news posts/tags)
// for @astrojs/sitemap's `customPages` option. Imported with a top-level
// `await` from astro.config.mjs, which runs in a raw Node ESM context
// *before* Vite (and this project's `@/` alias) exists — so this file and
// everything it imports must avoid the `@/` alias entirely. That's why this
// duplicates small pieces of logic (slug generation) from src/lib/square/
// instead of importing them. If either slug function changes in
// src/lib/square/slugUtils.ts or categories.ts, update the copies below too.

import { SquareClient, SquareEnvironment } from "square-legacy";

const SITE = "https://elcaminoskateshop.com"; // must match astro.config.mjs `site` exactly

const WP_BASE =
  "https://public-api.wordpress.com/rest/v1.1/sites/elcaminoskateshop.wordpress.com";

const squareEnv =
  process.env.PUBLIC_SQUARE_ENVIRONMENT === "production"
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox; // defaults to sandbox if env var is absent

const client = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN ?? "",
  environment: squareEnv,
});

// Duplicated from src/lib/square/slugUtils.ts createSlug — PRODUCT slugs only.
function createProductSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

// Duplicated from src/lib/square/categories.ts createSlug — CATEGORY slugs only.
// NOT the same algorithm as createProductSlug — do not merge them.
function createCategorySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchAllProductPages(): Promise<string[]> {
  const pages: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await client.catalog.list({ types: "ITEM", cursor });
    for (const item of page.data ?? []) {
      const title = (item as any).itemData?.name;
      if (title) pages.push(`${SITE}/product/${createProductSlug(title)}`);
    }
    cursor = (page.response as any).cursor;
  } while (cursor);
  return pages;
}

async function fetchAllCategoryPages(): Promise<string[]> {
  const page = await client.catalog.list({ types: "CATEGORY" });
  const raw = (page.data ?? []).filter((item: any) => item.type === "CATEGORY");

  type Cat = { id: string; slug: string; isTopLevel: boolean; parentId?: string };
  const categories: Cat[] = raw.map((item: any) => ({
    id: item.id,
    slug: createCategorySlug(item.categoryData?.name || ""),
    isTopLevel: item.categoryData?.isTopLevel || false,
    parentId: item.categoryData?.parentCategory?.id,
  }));
  const byId = new Map(categories.map((c) => [c.id, c]));

  const pages: string[] = [];
  for (const cat of categories) {
    if (cat.isTopLevel) {
      pages.push(`${SITE}/category/${cat.slug}`);
    } else if (cat.parentId && byId.has(cat.parentId)) {
      const parent = byId.get(cat.parentId)!;
      pages.push(`${SITE}/category/${parent.slug}/${cat.slug}`);
    }
  }
  return pages;
}

async function fetchAllNewsPages(): Promise<string[]> {
  const pages: string[] = [];
  const tagSlugs = new Set<string>();

  // WordPress.com v1.1 API: posts endpoint with slug + tags fields.
  // `number=100` is the API maximum per request; offset-based pagination
  // handles blogs with more than 100 posts.
  let offset = 0;
  const number = 100;

  while (true) {
    const url = `${WP_BASE}/posts?fields=slug,tags&type=post&status=publish&number=${number}&offset=${offset}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) break;

    const data = await res.json();
    const posts: any[] = data.posts ?? [];
    if (posts.length === 0) break;

    for (const post of posts) {
      if (post.slug) pages.push(`${SITE}/news/${post.slug}`);

      // Tags come back as an object keyed by tag name, each with a .slug field.
      if (post.tags && typeof post.tags === "object") {
        for (const tagData of Object.values(post.tags) as any[]) {
          if (tagData.slug) tagSlugs.add(tagData.slug);
        }
      }
    }

    if (posts.length < number) break; // last page
    offset += number;
  }

  for (const slug of tagSlugs) {
    pages.push(`${SITE}/news/tag/${slug}`);
  }

  return pages;
}

export async function buildSitemapPages(): Promise<string[]> {
  const [products, categories, news] = await Promise.all([
    fetchAllProductPages(),
    fetchAllCategoryPages(),
    fetchAllNewsPages(),
  ]);

  return [...products, ...categories, ...news];
}
