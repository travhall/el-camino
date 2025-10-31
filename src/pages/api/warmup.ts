/**
 * Function Warmup Endpoint
 * PHASE 3: Eliminate cold start penalties
 * 
 * Pinged every 5 minutes by GitHub Actions to keep functions warm
 * Expected: 0% cold starts, consistent response times (no 200-500ms spikes)
 */

import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  return new Response(
    JSON.stringify({ 
      status: 'warm',
      timestamp: Date.now(),
      message: 'Function is warm and ready'
    }), 
    {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    }
  );
};
