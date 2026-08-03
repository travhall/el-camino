// src/lib/square/apiUtils.ts

/**
 * Standard error logging with structured data
 */
export function logApiError(context: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(`[API:${context}] Error:`, {
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      data:
        (error as { data?: unknown; response?: { data?: unknown } }).data ||
        (error as { data?: unknown; response?: { data?: unknown } }).response
          ?.data,
    });
  } else {
    console.error(`[API:${context}] Unknown error:`, error);
  }
}
