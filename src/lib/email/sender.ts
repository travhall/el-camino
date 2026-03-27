// src/lib/email/sender.ts
import { Resend } from "resend";
import type { Order } from "square/legacy";
import type { PendingOrderContact } from "./pendingOrders";
import {
  buildOrderConfirmationHtml,
  buildPickupNotificationHtml,
  buildShippingOrderNotificationHtml,
  buildShippingConfirmationHtml,
  type ShippingConfirmationPayload,
} from "./templates";

interface EmailPayload {
  order: Order;
  contact: PendingOrderContact;
}

// Lazy getter — Resend constructor throws if the key is missing, so we
// instantiate inside each send function rather than at module load time.
function getResend() {
  return new Resend(import.meta.env.RESEND_API_KEY);
}

export async function sendOrderConfirmation({
  order,
  contact,
}: EmailPayload): Promise<void> {
  const subject =
    contact.fulfillmentMethod === "pickup"
      ? `Your El Camino pickup order is confirmed`
      : `Your El Camino order is confirmed`;

  const html = buildOrderConfirmationHtml({ order, contact });

  const { error } = await getResend().emails.send({
    from: import.meta.env.EMAIL_FROM,
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
    from: import.meta.env.EMAIL_FROM,
    to: import.meta.env.TYLER_EMAIL,
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
    from: import.meta.env.EMAIL_FROM,
    to: contact.email,
    subject: `Your El Camino order has shipped`,
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
    from: import.meta.env.EMAIL_FROM,
    to: import.meta.env.TYLER_EMAIL,
    subject: `New pickup order from ${contact.name}`,
    html,
  });

  if (error) {
    // Don't throw — Tyler not receiving a notification shouldn't block the customer confirmation
    console.error("[sender] Failed to send pickup notification:", error);
  }
}
