// src/lib/square/serverErrorUtils.ts
import { ApiError } from "square/legacy";
import {
  type AppError,
  ErrorType,
  createError,
  processClientError,
} from "./errorUtils";

/**
 * Map Square error codes to our standardized types
 */
export function getErrorTypeFromSquare(error: ApiError): ErrorType {
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

  return processClientError(error, source);
}
