// src/lib/email/templates.ts
//
// Plain HTML email templates with inline styles.
// Inline styles are required for broad email client compatibility.
//
// Brand color hex approximations of the oklch palette:
//   black-pearl-900 → #0f1918  (header background)
//   beeswax-900     → #2b2215  (body text)
//   beeswax-800     → #4f3d22  (muted text)
//   honey-cream-50  → #fdf8ee  (page background)
//   honey-cream-100 → #f5edda  (card background)
//   honey-cream-200 → #e8ddc4  (divider / border)
//   fig-leaf-500    → #4d7a2e  (CTA button / accent)
//   fig-leaf-600    → #3a5e22  (CTA hover — used for border)

import type { Order } from "square/legacy";
import type { PendingOrderContact } from "./pendingOrders";
import { siteConfig } from "@/lib/site-config";

interface TemplatePayload {
  order: Order;
  contact: PendingOrderContact;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMoney(amount: bigint | number | undefined | null): string {
  if (amount == null) return "$0.00";
  const cents = typeof amount === "bigint" ? Number(amount) : amount;
  return `$${(cents / 100).toFixed(2)}`;
}

function shortOrderId(orderId: string): string {
  // Show last 8 chars of the Square order ID as a human-friendly reference
  return orderId.slice(-8).toUpperCase();
}

// ─── Shared layout wrappers ───────────────────────────────────────────────────

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>El Camino Skate Shop</title>
</head>
<body style="margin:0;padding:0;background-color:#fdf8ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fdf8ee;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
          ${content}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function emailHeader(): string {
  return `
  <!-- Header -->
  <tr>
    <td style="background-color:#0f1918;border-radius:8px 8px 0 0;padding:28px 32px;text-align:center;">
      <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:0.06em;color:#fdf8ee;text-transform:uppercase;">
        El Camino Skate Shop
      </p>
      <p style="margin:6px 0 0;font-size:12px;color:#a89f8c;letter-spacing:0.08em;text-transform:uppercase;">
        100% Skater Owned &middot; 100% Skater Operated
      </p>
    </td>
  </tr>`;
}

function emailFooter(): string {
  return `
  <!-- Footer -->
  <tr>
    <td style="background-color:#0f1918;border-radius:0 0 8px 8px;padding:24px 32px;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;color:#a89f8c;">
        ${siteConfig.contact.address.display}
      </p>
      <p style="margin:0 0 4px;font-size:13px;color:#a89f8c;">
        <a href="tel:${siteConfig.contact.phone.number}" style="color:#a89f8c;text-decoration:none;">${siteConfig.contact.phone.display}</a>
        &nbsp;&middot;&nbsp;
        <a href="mailto:${siteConfig.contact.email}" style="color:#a89f8c;text-decoration:none;">${siteConfig.contact.email}</a>
      </p>
      <p style="margin:12px 0 0;font-size:11px;color:#6b6256;">
        &copy; ${new Date().getFullYear()} El Camino Skate Shop. All rights reserved.
      </p>
    </td>
  </tr>`;
}

function divider(): string {
  return `<tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e8ddc4;margin:0;"></td></tr>`;
}

// ─── Line items table ─────────────────────────────────────────────────────────

function lineItemsTable(order: Order): string {
  const items = order.lineItems ?? [];

  const rows = items
    .map((item) => {
      const qty = item.quantity ?? "1";
      const name = item.name ?? "Item";
      const total = formatMoney(item.totalMoney?.amount);
      return `
        <tr>
          <td style="padding:10px 0;font-size:14px;color:#2b2215;vertical-align:top;">
            ${name}
            ${Number(qty) > 1 ? `<span style="color:#4f3d22;font-size:13px;"> &times; ${qty}</span>` : ""}
          </td>
          <td style="padding:10px 0;font-size:14px;color:#2b2215;text-align:right;vertical-align:top;white-space:nowrap;">
            ${total}
          </td>
        </tr>`;
    })
    .join("");

  const total = formatMoney(order.totalMoney?.amount);

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${rows}
    <tr>
      <td colspan="2" style="padding:8px 0 0;"><hr style="border:none;border-top:1px solid #e8ddc4;margin:0;"></td>
    </tr>
    <tr>
      <td style="padding:12px 0 0;font-size:15px;font-weight:700;color:#2b2215;">Total</td>
      <td style="padding:12px 0 0;font-size:15px;font-weight:700;color:#2b2215;text-align:right;">${total}</td>
    </tr>
  </table>`;
}

// ─── Customer Order Confirmation ──────────────────────────────────────────────

export function buildOrderConfirmationHtml({
  order,
  contact,
}: TemplatePayload): string {
  const orderId = order.id ?? "";
  const isPickup = contact.fulfillmentMethod === "pickup";

  const fulfillmentSection = isPickup
    ? pickupDetailsSection(order)
    : shippingDetailsSection(order, contact);

  const content = `
  ${emailHeader()}

  <!-- Body card -->
  <tr>
    <td style="background-color:#ffffff;padding:32px 32px 0;">
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#2b2215;">
        Order Confirmed
      </h1>
      <p style="margin:0 0 20px;font-size:15px;color:#4f3d22;">
        Thanks, ${contact.name.split(" ")[0]}! We've got your order.
      </p>
      <p style="margin:0 0 24px;font-size:13px;color:#6b6256;">
        Order reference: <strong style="color:#2b2215;">#${shortOrderId(orderId)}</strong>
      </p>
    </td>
  </tr>

  ${divider()}

  <!-- Order items -->
  <tr>
    <td style="background-color:#ffffff;padding:24px 32px;">
      <p style="margin:0 0 16px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4f3d22;">
        Your Order
      </p>
      ${lineItemsTable(order)}
    </td>
  </tr>

  ${divider()}

  <!-- Fulfillment details -->
  ${fulfillmentSection}

  <!-- CTA -->
  <tr>
    <td style="background-color:#ffffff;padding:24px 32px 32px;text-align:center;">
      <a href="${siteConfig.url}/shop"
         style="display:inline-block;background-color:#4d7a2e;color:#ffffff;font-size:14px;font-weight:600;letter-spacing:0.04em;text-decoration:none;padding:12px 28px;border-radius:6px;border:2px solid #3a5e22;">
        Continue Shopping
      </a>
    </td>
  </tr>

  ${emailFooter()}`;

  return emailWrapper(content);
}

function shippingDetailsSection(
  order: Order,
  contact: PendingOrderContact
): string {
  const fulfillment = order.fulfillments?.find((f) => f.type === "SHIPMENT");
  const recipient = fulfillment?.shipmentDetails?.recipient;
  const address = recipient?.address;

  const addressLines = [
    address?.addressLine1,
    address?.addressLine2,
    address
      ? `${address.locality}, ${address.administrativeDistrictLevel1} ${address.postalCode}`
      : null,
  ]
    .filter(Boolean)
    .join("<br>");

  return `
  <tr>
    <td style="background-color:#ffffff;padding:24px 32px;">
      <p style="margin:0 0 16px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4f3d22;">
        Shipping To
      </p>
      <p style="margin:0;font-size:14px;color:#2b2215;line-height:1.6;">
        <strong>${contact.name}</strong><br>
        ${addressLines || "Address on file"}
      </p>
      <p style="margin:12px 0 0;font-size:13px;color:#4f3d22;">
        We'll email you when your order ships.
      </p>
    </td>
  </tr>`;
}

function pickupDetailsSection(order: Order): string {
  const fulfillment = order.fulfillments?.find((f) => f.type === "PICKUP");
  const pickupAt = fulfillment?.pickupDetails?.pickupAt;

  let readyText = "We'll reach out when your order is ready.";
  if (pickupAt) {
    const date = new Date(pickupAt);
    readyText = `Ready for pickup by approximately ${date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    })}.`;
  }

  return `
  <tr>
    <td style="background-color:#ffffff;padding:24px 32px;">
      <p style="margin:0 0 16px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4f3d22;">
        Pickup Details
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:#2b2215;line-height:1.6;">
        <strong>${siteConfig.contact.address.display}</strong>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#4f3d22;">${readyText}</p>
      <p style="margin:0;font-size:13px;color:#4f3d22;">
        Store hours: Wed&ndash;Fri 11am&ndash;7pm &middot; Sat 11am&ndash;7pm &middot; Sun 11am&ndash;5pm
      </p>
    </td>
  </tr>`;
}

// ─── Tyler Pickup Notification ────────────────────────────────────────────────

export function buildPickupNotificationHtml({
  order,
  contact,
}: TemplatePayload): string {
  const orderId = order.id ?? "";
  const fulfillment = order.fulfillments?.find((f) => f.type === "PICKUP");
  const notes = fulfillment?.pickupDetails?.note ?? "";
  const total = formatMoney(order.totalMoney?.amount);

  // Extract customer notes from the pickup note field (appended by create-checkout)
  const customerNotesMatch = notes.match(/Customer Notes:\s*(.+)$/s);
  const customerNotes = customerNotesMatch?.[1]?.trim() ?? null;

  const content = `
  ${emailHeader()}

  <!-- Body card -->
  <tr>
    <td style="background-color:#ffffff;padding:32px 32px 0;">
      <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#2b2215;">
        New Pickup Order
      </h1>
      <p style="margin:0 0 20px;font-size:15px;color:#4f3d22;">
        A customer is coming to pick up their order.
      </p>
    </td>
  </tr>

  ${divider()}

  <!-- Customer info -->
  <tr>
    <td style="background-color:#ffffff;padding:24px 32px;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4f3d22;">
        Customer
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:14px;color:#4f3d22;padding-bottom:4px;width:100px;">Name</td>
          <td style="font-size:14px;color:#2b2215;font-weight:600;padding-bottom:4px;">${contact.name}</td>
        </tr>
        <tr>
          <td style="font-size:14px;color:#4f3d22;padding-bottom:4px;">Email</td>
          <td style="font-size:14px;color:#2b2215;padding-bottom:4px;">
            <a href="mailto:${contact.email}" style="color:#4d7a2e;text-decoration:none;">${contact.email}</a>
          </td>
        </tr>
        <tr>
          <td style="font-size:14px;color:#4f3d22;">Order Ref</td>
          <td style="font-size:14px;color:#2b2215;font-family:monospace;">#${shortOrderId(orderId)}</td>
        </tr>
      </table>
      ${customerNotes
        ? `<div style="margin-top:12px;padding:10px 14px;background-color:#f5edda;border-left:3px solid #4d7a2e;border-radius:0 4px 4px 0;">
             <p style="margin:0;font-size:13px;color:#2b2215;"><strong>Customer note:</strong> ${customerNotes}</p>
           </div>`
        : ""}
    </td>
  </tr>

  ${divider()}

  <!-- Order items -->
  <tr>
    <td style="background-color:#ffffff;padding:24px 32px 32px;">
      <p style="margin:0 0 16px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4f3d22;">
        Items &mdash; ${total}
      </p>
      ${lineItemsTable(order)}
    </td>
  </tr>

  ${emailFooter()}`;

  return emailWrapper(content);
}
