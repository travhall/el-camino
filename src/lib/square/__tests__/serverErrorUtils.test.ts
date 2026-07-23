import { describe, it, expect, vi, afterEach } from "vitest";
import { SquareError } from "square-legacy";
import { getErrorTypeFromSquare, processSquareError } from "../serverErrorUtils";
import { ErrorType } from "../errorUtils";

const squareError = (statusCode?: number) =>
  new SquareError({ message: "Square failed", statusCode });

describe("getErrorTypeFromSquare", () => {
  it.each([
    [401, ErrorType.AUTH_ERROR],
    [403, ErrorType.AUTH_ERROR],
    [404, ErrorType.DATA_NOT_FOUND],
    [422, ErrorType.DATA_VALIDATION],
    [429, ErrorType.API_RATE_LIMIT],
    [500, ErrorType.API_UNAVAILABLE],
    [502, ErrorType.API_UNAVAILABLE],
    [503, ErrorType.API_UNAVAILABLE],
    [504, ErrorType.API_UNAVAILABLE],
  ])("maps status %i to %s", (statusCode, expected) => {
    expect(getErrorTypeFromSquare(squareError(statusCode))).toBe(expected);
  });

  it("maps an unrecognized status code to API_RESPONSE_ERROR", () => {
    expect(getErrorTypeFromSquare(squareError(418))).toBe(ErrorType.API_RESPONSE_ERROR);
  });

  it("maps a missing status code to API_RESPONSE_ERROR", () => {
    expect(getErrorTypeFromSquare(squareError(undefined))).toBe(ErrorType.API_RESPONSE_ERROR);
  });
});

describe("processSquareError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds an AppError from a SquareError, including statusCode and errors in data", () => {
    const err = squareError(404);
    const appError = processSquareError(err, "fetchProduct");
    expect(appError.type).toBe(ErrorType.DATA_NOT_FOUND);
    expect(appError.source).toBe("fetchProduct");
    expect(appError.originalError).toBe(err);
    expect(appError.data).toEqual({ statusCode: 404, errors: err.errors });
  });

  it("falls back to processClientError for non-SquareError values", () => {
    const appError = processSquareError(new Error("plain error"), "src");
    expect(appError.type).toBe(ErrorType.UNKNOWN);
    expect(appError.message).toBe("plain error");
  });
});
