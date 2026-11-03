// src/pages/api/cache-tag-probe.ts
//
// TEMPORARY. Exists only to find out why purging `product-*` / `variation-*`
// tags does not clear the cached PDP on the deployed site. Delete once
// answered; never merge to master.
//
// Same cache headers as the PDP (`mode=swr`) and a plain durable variant
// (`mode=durable`), both tagged `probe`. Purge the tag with the Netlify API,
// then check Cache-Status: if the entry misses, tags work and the PDP's own
// tags or headers are the problem; if it still hits, tags are not applied on
// this site at all. The body carries a timestamp so a fresh render is visible.
import type { APIRoute } from 'astro';

const CDN_CACHE_CONTROL = {
  durable: 'public, s-maxage=300, durable',
  swr: 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600, durable',
} as const;

export const GET: APIRoute = ({ url }) => {
  const mode = url.searchParams.get('mode') === 'swr' ? 'swr' : 'durable';

  return new Response(
    JSON.stringify({ mode, generatedAt: new Date().toISOString() }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Netlify-CDN-Cache-Control': CDN_CACHE_CONTROL[mode],
        'Netlify-Cache-Tag': `probe,probe-${mode}`,
      },
    }
  );
};
