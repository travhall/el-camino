// src/lib/email/sender.ts
import { Resend } from "resend";
import type { Order } from "square/legacy";
import type { PendingOrderContact } from "./pendingOrders";
import {
  buildOrderConfirmationHtml,
  buildPickupNotificationHtml,
} from "./templates";

// Astro SSR: use import.meta.env, not process.env
const resend = new Resend(import.meta.env.RESEND_API_KEY);

interface EmailPayload {
  order: Order;
  contact: PendingOrderContact;
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

  const { error } = await resend.emails.send({
    from: import.meta.env.EMAIL_FROM,
    to: contact.email,
    subject,
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

  const { error } = await resend.emails.send({
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
