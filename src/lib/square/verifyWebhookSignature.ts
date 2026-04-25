// Native replacement for `WebhooksHelper.verifySignature` from the `square`
// SDK. Letting us drop the entire 15MB modern SDK from the SSR bundle —
// it was only being imported for this one function.
//
// Square's webhook signature is documented here:
//   https://developer.squareup.com/docs/webhooks/step3validate
//
// The signature header value is:
//   base64( HMAC-SHA256( signatureKey, notificationUrl + rawRequestBody ) )

import { createHmac, timingSafeEqual } from "node:crypto";

export interface VerifyArgs {
  /** Raw request body bytes, exactly as Square sent them. */
  requestBody: string;
  /** Value of the `x-square-hmacsha256-signature` header. */
  signatureHeader: string;
  /** Webhook subscription's signing key from the Square dashboard. */
  signatureKey: string;
  /** Full URL Square delivered the webhook to (must match the subscription). */
  notificationUrl: string;
}

export function verifySquareWebhookSignature(args: VerifyArgs): boolean {
  const { requestBody, signatureHeader, signatureKey, notificationUrl } = args;
  if (!signatureHeader || !signatureKey) return false;

  const expected = createHmac("sha256", signatureKey)
    .update(notificationUrl + requestBody)
    .digest("base64");

  // timingSafeEqual requires equal-length buffers. Reject mismatched lengths
  // explicitly rather than letting the comparison throw.
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
