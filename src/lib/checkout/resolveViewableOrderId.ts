import { timingSafeEqual } from 'node:crypto';

// Same constant-time comparison shape as src/lib/admin/auth.ts's safeEqual.
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Decides which order (if any) the current visitor is allowed to view on
 * the order-confirmation page. An order is only viewable when the resolved
 * id (from the URL param, the cookie itself, or a transactionId lookup)
 * matches the purchaser's own `square-pending-orderId` cookie — this is
 * what stops anyone holding a bare order id from reading someone else's
 * order details.
 */
export function resolveViewableOrderId({
  paramId,
  cookieId,
  transactionOrderId,
}: {
  paramId: string | null;
  cookieId: string | null;
  transactionOrderId: string | null;
}): string | null {
  if (!cookieId) return null;

  const candidateId = paramId || transactionOrderId || cookieId || null;
  if (!candidateId) return null;

  return safeEqual(candidateId, cookieId) ? candidateId : null;
}
