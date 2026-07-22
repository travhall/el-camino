import { describe, it, expect } from "vitest";
import { escHtml } from "./templates";

describe("escHtml", () => {
  it("escapes all five HTML metacharacters", () => {
    expect(escHtml('<script>alert("xss")&nbsp;</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&amp;nbsp;&lt;/script&gt;"
    );
  });
  it("returns empty string for null", () => {
    expect(escHtml(null)).toBe("");
  });
  it("returns empty string for undefined", () => {
    expect(escHtml(undefined)).toBe("");
  });
  it("returns empty string for empty string", () => {
    expect(escHtml("")).toBe("");
  });
  it("leaves safe text unchanged", () => {
    expect(escHtml("Hello World")).toBe("Hello World");
  });
  it("escapes & before < so double-encoding does not occur", () => {
    expect(escHtml("a&b")).toBe("a&amp;b");
    expect(escHtml("a&lt;b")).toBe("a&amp;lt;b");
  });
});
