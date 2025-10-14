// src/pages/api/resolve-product.ts
import type { APIRoute } from 'astro';
import { fetchProducts } from '@/lib/square/client';
import { createSlugMapping } from '@/lib/square/slugUtils';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Missing slug parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Fetch all products and create slug mapping
    const products = await fetchProducts();
    const slugMapping = createSlugMapping(products);
    
    // Look up product ID by slug
    const productId = slugMapping.get(slug);
    
    if (!productId) {
      return new Response(JSON.stringify({ error: 'Product not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Return the product ID
    const response = new Response(JSON.stringify({ id: productId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

    // Set cache headers for edge caching
    // Browser: Don't cache slug resolution responses
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // Netlify CDN: Cache at edge for 1 hour, serve stale for 24 hours while revalidating
    // durable directive shares cache globally across all edge nodes
    response.headers.set(
      'Netlify-CDN-Cache-Control',
      'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400, durable'
    );
    
    // Add cache tag for invalidation via webhooks
    response.headers.set('Netlify-Cache-Tag', 'product-slugs,products');
    
    return response;
  } catch (error) {
    console.error('Error resolving product slug:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
