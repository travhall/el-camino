// src/lib/email/sender.ts
import { Resend } from "resend";
import type { Order } from "square-legacy";
import type { PendingOrderContact } from "./pendingOrders";
import {
  buildOrderConfirmationHtml,
  buildPickupNotificationHtml,
  buildPickupReminderHtml,
  buildShippingOrderNotificationHtml,
  buildShippingConfirmationHtml,
  buildBackInStockHtml,
  buildBisAdminNotificationHtml,
  type ShippingConfirmationPayload,
} from "./templates";
import { formatHoursForEmail } from "@/lib/shopHours";

interface EmailPayload {
  order: Order;
  contact: PendingOrderContact;
}

// Lazy getter — Resend constructor throws if the key is missing, so we
// instantiate inside each send function rather than at module load time.
// Use process.env rather than import.meta.env: sender.ts is a plain lib
// module imported by multiple API routes, and import.meta.env transforms
// are not reliably applied outside of Astro component/route files.
function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendOrderConfirmation({
  order,
  contact,
}: EmailPayload): Promise<void> {
  const subject =
    contact.fulfillmentMethod === "pickup"
      ? `Your El Camino pickup order is confirmed`
      : `Your El Camino order is confirmed`;

  const hoursLine = contact.fulfillmentMethod === "pickup"
    ? await formatHoursForEmail()
    : undefined;

  const html = buildOrderConfirmationHtml({ order, contact, hoursLine });

  const { error } = await getResend().emails.send({
    from: process.env.EMAIL_FROM!,
    to: contact.email,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend failed: ${JSON.stringify(error)}`);
  }
}

export async function sendShippingOrderNotification({
  order,
  contact,
}: EmailPayload): Promise<void> {
  const html = buildShippingOrderNotificationHtml({ order, contact });

  const { error } = await getResend().emails.send({
    from: process.env.EMAIL_FROM!,
    to: process.env.TYLER_EMAIL!,
    subject: `New shipping order from ${contact.name} — #${order.id?.slice(-8).toUpperCase()}`,
    html,
  });

  if (error) {
    // Don't throw — Tyler not receiving a notification shouldn't block the customer confirmation
    console.error("[sender] Failed to send shipping order notification:", error);
  }
}

export async function sendShippingConfirmation({
  order,
  contact,
  trackingNumber,
  carrier,
}: ShippingConfirmationPayload): Promise<void> {
  const html = buildShippingConfirmationHtml({ order, contact, trackingNumber, carrier });

  const { error } = await getResend().emails.send({
    from: process.env.EMAIL_FROM!,
    to: contact.email,
    subject: `Your El Camino order has shipped`,
    html,
  });

  if (error) {
    throw new Error(`Resend failed: ${JSON.stringify(error)}`);
  }
}

export async function sendBisAdminNotification({
  subscriberEmail,
  productName,
  totalSubscribers,
  origin,
}: {
  subscriberEmail: string;
  productName: string;
  totalSubscribers: number;
  origin: string;
}): Promise<void> {
  const html = buildBisAdminNotificationHtml({
    subscriberEmail,
    productName,
    totalSubscribers,
    adminUrl: `${origin}/admin/notifications/back-in-stock`,
  });

  const { error } = await getResend().emails.send({
    from: process.env.EMAIL_FROM!,
    to: process.env.TYLER_EMAIL!,
    subject: `Back-in-stock request: ${productName}`,
    html,
  });

  if (error) {
    // Non-blocking — Tyler not getting the alert shouldn't break the customer experience
    console.error("[sender] Failed to send BIS admin notification:", error);
  }
}

export async function sendBackInStockNotification({
  email,
  productName,
  productUrl,
}: {
  email: string;
  productName: string;
  productUrl: string;
}): Promise<void> {
  // Derive a friendly first name from the email local part
  // e.g. "travis.hall@gmail.com" → "Travis"
  const localPart = email.split("@")[0].replace(/[._+-]/g, " ").trim();
  const customerName =
    localPart.charAt(0).toUpperCase() + localPart.slice(1) || "there";

  const html = buildBackInStockHtml({
    customerName,
    productName,
    productUrl,
    // variationName intentionally omitted — productName already contains
    // the full human-readable label including any variant descriptor
  });

  const { error } = await getResend().emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    subject: `Good news — ${productName} is back in stock`,
    html,
  });

  if (error) {
    throw new Error(`Resend failed for ${email}: ${JSON.stringify(error)}`);
  }
}

export async function sendPickupReminderEmail({
  to,
  customerName,
  orderId,
  items,
  pickupAt,
}: {
  to: string;
  customerName: string;
  orderId: string;
  items: { name: string; qty: string }[];
  pickupAt?: string;
}): Promise<void> {
  const hoursLine = await formatHoursForEmail();
  const html = buildPickupReminderHtml({ customerName, orderId, items, pickupAt, hoursLine });

  const { error } = await getResend().emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: "Reminder: Your El Camino pickup order is ready",
    html,
  });

  if (error) {
    throw new Error(`Resend failed: ${JSON.stringify(error)}`);
  }
}

export async function sendPickupNotification({
  order,
  contact,
}: EmailPayload): Promise<void> {
  const html = buildPickupNotificationHtml({ order, contact });

  const { error } = await getResend().emails.send({
    from: process.env.EMAIL_FROM!,
    to: process.env.TYLER_EMAIL!,
    subject: `New pickup order from ${contact.name}`,
    html,
  });

  if (error) {
    // Don't throw — Tyler not receiving a notification shouldn't block the customer confirmation
    console.error("[sender] Failed to send pickup notification:", error);
  }
}
