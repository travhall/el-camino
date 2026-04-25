import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifySquareWebhookSignature } from "../verifyWebhookSignature";

const SIGNING_KEY = "test-signing-key-do-not-use-in-prod";
const URL = "https://example.com/api/webhooks/square";
const BODY = JSON.stringify({ type: "inventory.count.updated", data: {} });

function sign(url: string, body: string, key = SIGNING_KEY): string {
  return createHmac("sha256", key).update(url + body).digest("base64");
}

describe("verifySquareWebhookSignature", () => {
  it("accepts a correctly signed request", () => {
    const result = verifySquareWebhookSignature({
      requestBody: BODY,
      notificationUrl: URL,
      signatureKey: SIGNING_KEY,
      signatureHeader: sign(URL, BODY),
    });
    expect(result).toBe(true);
  });

  it("rejects an empty signature header", () => {
    const result = verifySquareWebhookSignature({
      requestBody: BODY,
      notificationUrl: URL,
      signatureKey: SIGNING_KEY,
      signatureHeader: "",
    });
    expect(result).toBe(false);
  });

  it("rejects an empty signing key", () => {
    const result = verifySquareWebhookSignature({
      requestBody: BODY,
      notificationUrl: URL,
      signatureKey: "",
      signatureHeader: sign(URL, BODY),
    });
    expect(result).toBe(false);
  });

  it("rejects when the body has been tampered with", () => {
    const tamperedBody = BODY.replace("inventory", "payment");
    const result = verifySquareWebhookSignature({
      requestBody: tamperedBody,
      notificationUrl: URL,
      signatureKey: SIGNING_KEY,
      signatureHeader: sign(URL, BODY), // signed against original body
    });
    expect(result).toBe(false);
  });

  it("rejects when the URL doesn't match (cross-tenant replay defense)", () => {
    const result = verifySquareWebhookSignature({
      requestBody: BODY,
      notificationUrl: "https://attacker.example/api/webhooks/square",
      signatureKey: SIGNING_KEY,
      signatureHeader: sign(URL, BODY),
    });
    expect(result).toBe(false);
  });

  it("rejects a signature signed with a different key", () => {
    const result = verifySquareWebhookSignature({
      requestBody: BODY,
      notificationUrl: URL,
      signatureKey: SIGNING_KEY,
      signatureHeader: sign(URL, BODY, "wrong-key"),
    });
    expect(result).toBe(false);
  });

  it("rejects junk in the signature header without throwing", () => {
    const result = verifySquareWebhookSignature({
      requestBody: BODY,
      notificationUrl: URL,
      signatureKey: SIGNING_KEY,
      signatureHeader: "not-base64-and-wrong-length",
    });
    expect(result).toBe(false);
  });
});
