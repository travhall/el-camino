// src/lib/square/errorUtils.ts

/**
 * Standard error types for the application
 */
export enum ErrorType {
  // API Errors
  API_UNAVAILABLE = "api_unavailable",
  API_RATE_LIMIT = "api_rate_limit",
  API_RESPONSE_ERROR = "api_response_error",

  // Data Errors
  DATA_NOT_FOUND = "data_not_found",
  DATA_VALIDATION = "data_validation",
  DATA_PARSING = "data_parsing",

  // Authentication Errors
  AUTH_ERROR = "auth_error",
  PERMISSION_ERROR = "permission_error",

  // Client Errors
  NETWORK_ERROR = "network_error",
  TIMEOUT_ERROR = "timeout_error",

  // Other
  UNKNOWN = "unknown_error",
}

/**
 * Standardized error structure
 */
export interface AppError {
  type: ErrorType;
  message: string;
  source?: string;
  originalError?: unknown;
  data?: Record<string, unknown>;
}

/**
 * Create a standardized error object
 */
export function createError(
  type: ErrorType,
  message: string,
  options?: {
    source?: string;
    originalError?: unknown;
    data?: Record<string, unknown>;
  }
): AppError {
  return {
    type,
    message,
    source: options?.source,
    originalError: options?.originalError,
    data: options?.data,
  };
}

/**
 * Log error with standard format and context
 */
export function logError(error: AppError): void {
  console.error(
    `[ERROR:${error.type}] ${error.source ? `(${error.source})` : ""} ${
      error.message
    }`,
    {
      type: error.type,
      source: error.source,
      data: error.data,
      originalError:
        error.originalError instanceof Error
          ? {
              name: error.originalError.name,
              message: error.originalError.message,
              stack: error.originalError.stack?.split("\n").slice(0, 5),
            }
          : error.originalError,
    }
  );
}

/**
 * Process client-side errors into standardized format
 */
export function processClientError(error: unknown, source: string): AppError {
  if (error instanceof Error) {
    if (
      error.message.includes("timeout") ||
      error.message.includes("ETIMEDOUT")
    ) {
      return createError(ErrorType.TIMEOUT_ERROR, "Request timed out", {
        source,
        originalError: error,
      });
    }

    if (
      error.message.includes("network") ||
      error.message.includes("ENOTFOUND")
    ) {
      return createError(ErrorType.NETWORK_ERROR, "Network error", {
        source,
        originalError: error,
      });
    }

    return createError(ErrorType.UNKNOWN, error.message, {
      source,
      originalError: error,
    });
  }

  return createError(ErrorType.UNKNOWN, "Unknown error occurred", {
    source,
    originalError: error,
  });
}

/**
 * Log an error and return a fallback value, or re-throw if none is given.
 */
export function handleError<T>(error: AppError, fallbackValue?: T): T {
  logError(error);

  if (fallbackValue !== undefined) {
    return fallbackValue;
  }

  throw error;
}
