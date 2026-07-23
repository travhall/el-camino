import { describe, it, expect, vi, afterEach } from "vitest";
import { createError, logError, processClientError, handleError, ErrorType } from "../errorUtils";

describe("createError", () => {
  it("builds an AppError with the given type and message", () => {
    const err = createError(ErrorType.DATA_NOT_FOUND, "Not found");
    expect(err).toEqual({
      type: ErrorType.DATA_NOT_FOUND,
      message: "Not found",
      source: undefined,
      originalError: undefined,
      data: undefined,
    });
  });

  it("includes optional source, originalError, and data when provided", () => {
    const original = new Error("boom");
    const err = createError(ErrorType.UNKNOWN, "Something broke", {
      source: "testSource",
      originalError: original,
      data: { foo: "bar" },
    });
    expect(err.source).toBe("testSource");
    expect(err.originalError).toBe(original);
    expect(err.data).toEqual({ foo: "bar" });
  });
});

describe("logError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs the error type and message via console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError(createError(ErrorType.AUTH_ERROR, "Not authorized", { source: "auth" }));
    expect(spy).toHaveBeenCalledTimes(1);
    const [message] = spy.mock.calls[0];
    expect(message).toContain(ErrorType.AUTH_ERROR);
    expect(message).toContain("auth");
    expect(message).toContain("Not authorized");
  });

  it("summarizes an Error originalError instead of dumping the raw object", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const original = new Error("root cause");
    logError(createError(ErrorType.UNKNOWN, "wrapped", { originalError: original }));
    const [, details] = spy.mock.calls[0];
    expect(details.originalError).toMatchObject({ name: "Error", message: "root cause" });
  });
});

describe("processClientError", () => {
  it("classifies timeout errors", () => {
    const err = processClientError(new Error("ETIMEDOUT while fetching"), "fetchProduct");
    expect(err.type).toBe(ErrorType.TIMEOUT_ERROR);
    expect(err.source).toBe("fetchProduct");
  });

  it("classifies network errors", () => {
    const err = processClientError(new Error("ENOTFOUND api.square.com"), "fetchProduct");
    expect(err.type).toBe(ErrorType.NETWORK_ERROR);
  });

  it("classifies other Error instances as UNKNOWN, preserving the message", () => {
    const err = processClientError(new Error("something else"), "src");
    expect(err.type).toBe(ErrorType.UNKNOWN);
    expect(err.message).toBe("something else");
  });

  it("classifies non-Error values as UNKNOWN with a generic message", () => {
    const err = processClientError("a string was thrown", "src");
    expect(err.type).toBe(ErrorType.UNKNOWN);
    expect(err.message).toBe("Unknown error occurred");
  });
});

describe("handleError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the fallback value without throwing when one is provided", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = createError(ErrorType.DATA_NOT_FOUND, "missing");
    expect(handleError(err, [])).toEqual([]);
  });

  it("returns a falsy fallback value (0) without treating it as absent", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = createError(ErrorType.DATA_NOT_FOUND, "missing");
    expect(handleError(err, 0)).toBe(0);
  });

  it("throws the error when no fallback value is given", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = createError(ErrorType.DATA_NOT_FOUND, "missing");
    expect(() => handleError(err)).toThrow();
  });
});
