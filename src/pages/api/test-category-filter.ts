// src/pages/api/test-category-filter.ts - Test endpoint for category filtering

import type { APIRoute } from "astro";
import { getCategoryStatusReport, refreshCategoryCache } from "@/lib/square/categoryAdmin";

export const GET: APIRoute = async ({ url }) => {
  const action = url.searchParams.get('action') || 'status';
  
  try {
    if (action === 'refresh') {
      const result = await refreshCategoryCache();
      return new Response(JSON.stringify(result, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Default: return status report
    const report = await getCategoryStatusReport();
    return new Response(JSON.stringify(report, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: `Failed to generate report: ${error}` 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
