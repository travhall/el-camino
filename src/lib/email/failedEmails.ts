// src/lib/email/failedEmails.ts
// Stores failed webhook email delivery records in Netlify Blobs
// so the shop owner can surface and retry them from the admin UI.
import { getStore } from "@netlify/blobs";
import type { Order } from "square-legacy";
import type { PendingOrderContact } from "./pendingOrders";

export interface FailedEmailRecord {
  orderId: string;
  order: Order;
  contact: PendingOrderContact;
  failedAt: string; // ISO timestamp
  error: string;    // error message (no stack traces)
  emailType?: "order-confirmation" | "shipping-confirmation"; // defaults to "order-confirmation" when absent, for backward compatibility with records stored before this field existed
  trackingNumber?: string;
  carrier?: string;
}

function getFailedEmailsStore() {
  return getStore({ name: "failed-emails", consistency: "strong" });
}

export async function storeFailedEmail(
  orderId: string,
  order: Order,
  contact: PendingOrderContact,
  error: unknown,
  options?: {
    emailType?: "order-confirmation" | "shipping-confirmation";
    trackingNumber?: string;
    carrier?: string;
  }
): Promise<void> {
  const store = getFailedEmailsStore();
  const record: FailedEmailRecord = {
    orderId,
    order,
    contact,
    failedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    emailType: options?.emailType ?? "order-confirmation",
    trackingNumber: options?.trackingNumber,
    carrier: options?.carrier,
  };
  await store.setJSON(orderId, record);
}

export async function getFailedEmail(orderId: string): Promise<FailedEmailRecord | null> {
  const store = getFailedEmailsStore();
  return await store.get(orderId, { type: "json" });
}

export async function listFailedEmails(): Promise<FailedEmailRecord[]> {
  const store = getFailedEmailsStore();
  const { blobs } = await store.list();
  const records = await Promise.all(
    blobs.map((b) => store.get(b.key, { type: "json" }) as Promise<FailedEmailRecord>)
  );
  return records.filter(Boolean);
}

export async function deleteFailedEmail(orderId: string): Promise<void> {
  const store = getFailedEmailsStore();
  await store.delete(orderId);
}
