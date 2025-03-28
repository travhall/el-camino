// src/lib/square/errorUtils.ts
import { ApiError } from "square";

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
 * Process Square API errors into standardized format
 */
export function processSquareError(error: unknown, source: string): AppError {
  if (error instanceof ApiError) {
    const type = getErrorTypeFromSquare(error);
    return createError(type, error.message, {
      source,
      originalError: error,
      data: {
        statusCode: error.statusCode,
        errors: error.errors,
      },
    });
  }

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
 * Map Square error codes to our standardized types
 */
function getErrorTypeFromSquare(error: ApiError): ErrorType {
  // Square's status codes
  switch (error.statusCode) {
    case 401:
    case 403:
      return ErrorType.AUTH_ERROR;
    case 404:
      return ErrorType.DATA_NOT_FOUND;
    case 422:
      return ErrorType.DATA_VALIDATION;
    case 429:
      return ErrorType.API_RATE_LIMIT;
    case 500:
    case 502:
    case 503:
    case 504:
      return ErrorType.API_UNAVAILABLE;
    default:
      return ErrorType.API_RESPONSE_ERROR;
  }
}

/**
 * Handle error with appropriate recovery strategy
 */
export function handleError<T>(
  error: AppError,
  fallbackValue?: T,
  retryFn?: () => Promise<T>
): Promise<T> | T {
  logError(error);

  // Implement specific recovery strategies based on error type
  switch (error.type) {
    case ErrorType.API_RATE_LIMIT:
      // Could implement exponential backoff and retry
      if (retryFn) {
        console.log(`Rate limit hit, retrying with delay`);
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(retryFn());
          }, 2000);
        });
      }
      break;

    case ErrorType.NETWORK_ERROR:
    case ErrorType.TIMEOUT_ERROR:
      // Could attempt immediate retry for transient issues
      if (retryFn) {
        console.log(`Network/timeout error, retrying once`);
        return retryFn();
      }
      break;

    // Other error types...
  }

  // If no recovery or retry logic matched, return fallback
  if (fallbackValue !== undefined) {
    return fallbackValue;
  }

  // Re-throw if no fallback provided
  throw error;
}
