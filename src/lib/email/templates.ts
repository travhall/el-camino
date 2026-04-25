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

import type { Order } from "square-legacy";
import type { PendingOrderContact } from "./pendingOrders";
import { siteConfig } from "@/lib/site-config";


interface TemplatePayload {
  order: Order;
  contact: PendingOrderContact;
  hoursLine?: string;
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

/**
 * Format a pickup ISO timestamp for display in Central Time.
 * Output: "Thu, Apr 10 at 3:00 PM CDT"
 */
function formatPickupTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
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
    <td style="background-color:#0f1918;border-radius:8px 8px 0 0;padding:28px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;">
            <img src="https://www.elcaminoskateshop.com/Icon.png"
                 width="54" height="48"
                 alt="El Camino Skate Shop"
                 style="display:block;border:0;outline:none;text-decoration:none;">
          </td>
          <td style="vertical-align:middle;padding-left:16px;">
            <p style="margin:0;font-size:18px;font-weight:700;letter-spacing:0.06em;color:#fdf8ee;text-transform:uppercase;line-height:1.1;">
              El Camino
            </p>
            <p style="margin:2px 0 0;font-size:10px;color:#a89f8c;letter-spacing:0.1em;text-transform:uppercase;">
              Skate Shop &middot; Eau Claire, WI
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function emailFooter(): string {
  const year = new Date().getFullYear();
  return `
  <!-- Footer -->
  <tr>
    <td style="background-color:#0f1918;border-radius:0 0 8px 8px;padding:28px 32px;">
      <!-- Contact row -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        <tr>
          <td style="text-align:center;">
            <p style="margin:0 0 6px;font-size:13px;color:#c9c2b4;">
              Questions about your order?
            </p>
            <p style="margin:0;font-size:13px;color:#c9c2b4;">
              <a href="mailto:${siteConfig.contact.email}" style="color:#fdf8ee;text-decoration:none;font-weight:600;">${siteConfig.contact.email}</a>
              &nbsp;&middot;&nbsp;
              <a href="tel:${siteConfig.contact.phone.number}" style="color:#c9c2b4;text-decoration:none;">${siteConfig.contact.phone.display}</a>
            </p>
            <p style="margin:6px 0 0;font-size:12px;color:#8a8278;">
              ${siteConfig.contact.address.display}
            </p>
          </td>
        </tr>
      </table>

      <!-- Divider -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        <tr>
          <td style="border-top:1px solid #1e2e2c;font-size:0;line-height:0;">&nbsp;</td>
        </tr>
      </table>

      <!-- Policy links -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        <tr>
          <td style="text-align:center;">
            <a href="${siteConfig.url}/legal/privacy-policy" style="color:#8a8278;text-decoration:none;font-size:11px;letter-spacing:0.04em;">Privacy Policy</a>
            <span style="color:#3a4a48;font-size:11px;">&nbsp;&nbsp;&middot;&nbsp;&nbsp;</span>
            <a href="${siteConfig.url}/legal/return-policy" style="color:#8a8278;text-decoration:none;font-size:11px;letter-spacing:0.04em;">Return Policy</a>
            <span style="color:#3a4a48;font-size:11px;">&nbsp;&nbsp;&middot;&nbsp;&nbsp;</span>
            <a href="${siteConfig.url}/legal/shipping-policy" style="color:#8a8278;text-decoration:none;font-size:11px;letter-spacing:0.04em;">Shipping Policy</a>
            <span style="color:#3a4a48;font-size:11px;">&nbsp;&nbsp;&middot;&nbsp;&nbsp;</span>
            <a href="${siteConfig.url}/legal/terms-and-conditions" style="color:#8a8278;text-decoration:none;font-size:11px;letter-spacing:0.04em;">Terms</a>
          </td>
        </tr>
      </table>

      <!-- CAN-SPAM transactional note -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="text-align:center;">
            <p style="margin:0;font-size:11px;color:#5a6e6c;line-height:1.5;">
              You received this email because you placed an order at El Camino Skate Shop.<br>
              This is a transactional email related to your purchase &mdash; not a marketing message.
            </p>
            <p style="margin:8px 0 0;font-size:11px;color:#4a5e5c;">
              &copy; ${year} El Camino Skate Shop. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
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
  hoursLine = "See website for hours",
}: TemplatePayload): string {
  const orderId = order.id ?? "";
  const isPickup = contact.fulfillmentMethod === "pickup";

  const fulfillmentSection = isPickup
    ? pickupDetailsSection(order, hoursLine)
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
      <a href="${siteConfig.url}/shop/all"
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

function pickupDetailsSection(order: Order, hoursLine: string): string {
  const fulfillment = order.fulfillments?.find((f) => f.type === "PICKUP");
  const pickupAt = fulfillment?.pickupDetails?.pickupAt;

  let readyText = "We'll reach out when your order is ready.";
  if (pickupAt) {
    readyText = `Ready for pickup by approximately ${formatPickupTime(pickupAt)}.`;
  }

  return `
  <tr>
    <td style="background-color:#ffffff;padding:24px 32px;">
      <p style="margin:0 0 16px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4f3d22;">
        Pick Up Details
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:#2b2215;line-height:1.6;">
        <strong>${siteConfig.contact.address.display}</strong>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#4f3d22;">${readyText}</p>
      <p style="margin:0;font-size:13px;color:#4f3d22;">
        Store hours: ${hoursLine}
      </p>
    </td>
  </tr>`;
}

// ─── Back In Stock Notification ───────────────────────────────────────────────

export interface BackInStockPayload {
  customerName: string;
  productName: string;
  productUrl: string;
  variationName?: string; // e.g. "Size 10" or "Navy / Large"
  price?: number;         // cents
}

export function buildBackInStockHtml({
  customerName,
  productName,
  productUrl,
  variationName,
  price,
}: BackInStockPayload): string {
  const firstName = customerName.split(" ")[0];
  const displayName = variationName ? `${productName} — ${variationName}` : productName;
  const priceStr = price != null ? formatMoney(price) : null;

  const content = `
  ${emailHeader()}

  <!-- Body card -->
  <tr>
    <td style="background-color:#ffffff;padding:32px 32px 0;">
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#2b2215;">
        Back in Stock
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#4f3d22;">
        Hey ${firstName}, good news — something on your wishlist just came back.
      </p>
    </td>
  </tr>

  ${divider()}

  <!-- Product card -->
  <tr>
    <td style="background-color:#ffffff;padding:24px 32px;">
      <p style="margin:0 0 16px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4f3d22;">
        Now Available
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0"
             style="background-color:#f5edda;border-radius:6px;width:100%;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#2b2215;">
              ${displayName}
            </p>
            ${priceStr
              ? `<p style="margin:0 0 16px;font-size:15px;color:#4d7a2e;font-weight:600;">${priceStr}</p>`
              : `<p style="margin:0 0 16px;"></p>`
            }
            <a href="${productUrl}"
               style="display:inline-block;background-color:#4d7a2e;color:#ffffff;font-size:14px;font-weight:600;letter-spacing:0.04em;text-decoration:none;padding:10px 24px;border-radius:6px;border:2px solid #3a5e22;">
              Shop Now
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-size:13px;color:#6b6256;">
        Popular items sell out fast — grab it before it's gone again.
      </p>
    </td>
  </tr>

  ${emailFooter()}`;

  return emailWrapper(content);
}

// ─── Tyler Shipping Order Notification ───────────────────────────────────────

export function buildShippingOrderNotificationHtml({
  order,
  contact,
}: TemplatePayload): string {
  const orderId = order.id ?? "";
  const fulfillment = order.fulfillments?.find((f) => f.type === "SHIPMENT");
  const recipient = fulfillment?.shipmentDetails?.recipient;
  const address = recipient?.address;
  const total = formatMoney(order.totalMoney?.amount);

  const addressLines = [
    address?.addressLine1,
    address?.addressLine2,
    address
      ? `${address.locality}, ${address.administrativeDistrictLevel1} ${address.postalCode}`
      : null,
  ]
    .filter(Boolean)
    .join("<br>");

  const content = `
  ${emailHeader()}

  <!-- Body card -->
  <tr>
    <td style="background-color:#ffffff;padding:32px 32px 0;">
      <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#2b2215;">
        New Shipping Order
      </h1>
      <p style="margin:0 0 20px;font-size:15px;color:#4f3d22;">
        A customer placed an order for shipping. Pack it up and drop it off.
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
    </td>
  </tr>

  ${divider()}

  <!-- Ship to address -->
  <tr>
    <td style="background-color:#ffffff;padding:24px 32px;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4f3d22;">
        Ship To
      </p>
      <p style="margin:0;font-size:14px;color:#2b2215;line-height:1.7;">
        <strong>${contact.name}</strong><br>
        ${addressLines || "Address not captured"}
      </p>
    </td>
  </tr>

  ${divider()}

  <!-- Order items -->
  <tr>
    <td style="background-color:#ffffff;padding:24px 32px 24px;">
      <p style="margin:0 0 16px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4f3d22;">
        Items &mdash; ${total}
      </p>
      ${lineItemsTable(order)}
    </td>
  </tr>

  ${divider()}

  <!-- Mark shipped CTA -->
  <tr>
    <td style="background-color:#ffffff;padding:24px 32px 32px;text-align:center;">
      <a href="${siteConfig.url}/admin/orders/shipping"
         style="display:inline-block;background-color:#4d7a2e;color:#ffffff;font-size:14px;font-weight:600;letter-spacing:0.04em;text-decoration:none;padding:12px 28px;border-radius:6px;border:2px solid #3a5e22;">
        Mark as Shipped
      </a>
      <p style="margin:12px 0 0;font-size:12px;color:#6b6256;">
        Once shipped, enter the tracking number in the admin panel to notify the customer.
      </p>
    </td>
  </tr>

  ${emailFooter()}`;

  return emailWrapper(content);
}

// ─── Customer Shipping Confirmation ───────────────────────────────────────────

export interface ShippingConfirmationPayload {
  order: import("square-legacy").Order;
  contact: PendingOrderContact;
  trackingNumber?: string;
  carrier?: string; // "USPS" | "UPS" | "FedEx" | "Other"
}

function trackingUrl(carrier: string, tracking: string): string | null {
  switch (carrier.toUpperCase()) {
    case "USPS":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tracking}`;
    case "UPS":
      return `https://www.ups.com/track?tracknum=${tracking}`;
    case "FEDEX":
      return `https://www.fedex.com/fedextrack/?trknbr=${tracking}`;
    default:
      return null;
  }
}

export function buildShippingConfirmationHtml({
  order,
  contact,
  trackingNumber,
  carrier,
}: ShippingConfirmationPayload): string {
  const orderId = order.id ?? "";
  const firstName = contact.name.split(" ")[0];
  const hasTracking = !!trackingNumber;
  const trackLink =
    hasTracking && carrier ? trackingUrl(carrier, trackingNumber!) : null;

  const trackingSection = hasTracking
    ? `
  ${divider()}
  <tr>
    <td style="background-color:#ffffff;padding:24px 32px;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4f3d22;">
        Tracking
      </p>
      <div style="background-color:#f5edda;border-radius:6px;padding:16px 20px;">
        ${carrier ? `<p style="margin:0 0 4px;font-size:13px;color:#4f3d22;">${carrier}</p>` : ""}
        <p style="margin:0 0 ${trackLink ? "16px" : "0"};font-size:15px;font-weight:700;color:#2b2215;font-family:monospace;letter-spacing:0.04em;">
          ${trackingNumber}
        </p>
        ${trackLink
          ? `<a href="${trackLink}"
               style="display:inline-block;background-color:#4d7a2e;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:8px 20px;border-radius:6px;border:2px solid #3a5e22;">
               Track Package
             </a>`
          : ""}
      </div>
    </td>
  </tr>`
    : "";

  const content = `
  ${emailHeader()}

  <!-- Body card -->
  <tr>
    <td style="background-color:#ffffff;padding:32px 32px 0;">
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#2b2215;">
        Your order is on its way
      </h1>
      <p style="margin:0 0 20px;font-size:15px;color:#4f3d22;">
        Hey ${firstName}, your El Camino order has shipped!
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
        What's in the box
      </p>
      ${lineItemsTable(order)}
    </td>
  </tr>

  ${trackingSection}

  <!-- CTA -->
  <tr>
    <td style="background-color:#ffffff;padding:24px 32px 32px;text-align:center;">
      <a href="${siteConfig.url}/shop/all"
         style="display:inline-block;background-color:#4d7a2e;color:#ffffff;font-size:14px;font-weight:600;letter-spacing:0.04em;text-decoration:none;padding:12px 28px;border-radius:6px;border:2px solid #3a5e22;">
        Shop Again
      </a>
      <p style="margin:12px 0 0;font-size:12px;color:#6b6256;">
        Questions? Reply to this email or give us a call.
      </p>
    </td>
  </tr>

  ${emailFooter()}`;

  return emailWrapper(content);
}

// ─── Tyler Pick Up Notification ────────────────────────────────────────────────

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
        New Pick Up Order
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
    <td style="background-color:#ffffff;padding:24px 32px 24px;">
      <p style="margin:0 0 16px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4f3d22;">
        Items &mdash; ${total}
      </p>
      ${lineItemsTable(order)}
    </td>
  </tr>

  ${divider()}

  <!-- Mark picked up CTA -->
  <tr>
    <td style="background-color:#ffffff;padding:24px 32px 32px;text-align:center;">
      <a href="${siteConfig.url}/admin/orders/pickups"
         style="display:inline-block;background-color:#4d7a2e;color:#ffffff;font-size:14px;font-weight:600;letter-spacing:0.04em;text-decoration:none;padding:12px 28px;border-radius:6px;border:2px solid #3a5e22;">
        Mark as Picked Up
      </a>
      <p style="margin:12px 0 0;font-size:12px;color:#6b6256;">
        Once they've collected their order, mark it complete in the admin panel.
      </p>
    </td>
  </tr>

  ${emailFooter()}`;

  return emailWrapper(content);
}

// ─── Customer Pick Up Reminder ─────────────────────────────────────────────────

export interface PickupReminderPayload {
  customerName: string;
  orderId: string; // raw Square ID — short form derived internally
  items: { name: string; qty: string }[];
  pickupAt?: string; // formatted date string, e.g. "Tue, Apr 1, 2:00 PM CDT"
  hoursLine?: string; // formatted hours string, e.g. "Wed–Fri 11am–7pm · Sat 11am–7pm"
}

export function buildPickupReminderHtml({
  customerName,
  orderId,
  items,
  pickupAt,
  hoursLine = "See website for hours",
}: PickupReminderPayload): string {
  const firstName = customerName.split(" ")[0];
  const shortId = orderId.slice(-8).toUpperCase();

  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#2b2215;vertical-align:top;">
          ${item.name}
          ${Number(item.qty) > 1 ? `<span style="color:#4f3d22;font-size:13px;"> &times; ${item.qty}</span>` : ""}
        </td>
      </tr>`,
    )
    .join("");

  const pickupTimeNote = pickupAt
    ? `<p style="margin:0 0 8px;font-size:13px;color:#4f3d22;">
        This order was expected for pickup by approximately <strong>${pickupAt}</strong>. Stop by when you can — we'll hold it for you.
       </p>`
    : "";

  const content = `
  ${emailHeader()}

  <!-- Body card -->
  <tr>
    <td style="background-color:#ffffff;padding:32px 32px 0;">
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#2b2215;">
        Your order is waiting for you
      </h1>
      <p style="margin:0 0 20px;font-size:15px;color:#4f3d22;">
        Hey ${firstName}, just a reminder — your pickup order is still here and ready to collect.
      </p>
      <p style="margin:0 0 24px;font-size:13px;color:#6b6256;">
        Order reference: <strong style="color:#2b2215;">#${shortId}</strong>
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
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${itemRows}
      </table>
    </td>
  </tr>

  ${divider()}

  <!-- Pick Up details -->
  <tr>
    <td style="background-color:#ffffff;padding:24px 32px;">
      <p style="margin:0 0 16px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4f3d22;">
        Pick Up Details
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:#2b2215;line-height:1.6;">
        <strong>${siteConfig.contact.address.display}</strong>
      </p>
      ${pickupTimeNote}
      <p style="margin:0;font-size:13px;color:#4f3d22;">
        Store hours: ${hoursLine}
      </p>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td style="background-color:#ffffff;padding:24px 32px 32px;text-align:center;">
      <p style="margin:0 0 16px;font-size:14px;color:#4f3d22;">
        Questions or need to make other arrangements? Give us a call.
      </p>
      <a href="tel:${siteConfig.contact.phone.number}"
         style="display:inline-block;background-color:#4d7a2e;color:#ffffff;font-size:14px;font-weight:600;letter-spacing:0.04em;text-decoration:none;padding:12px 28px;border-radius:6px;border:2px solid #3a5e22;">
        ${siteConfig.contact.phone.display}
      </a>
    </td>
  </tr>

  ${emailFooter()}`;

  return emailWrapper(content);
}

// ─── Tyler Back-in-Stock Subscriber Notification ─────────────────────────────

export function buildBisAdminNotificationHtml({
  subscriberEmail,
  productName,
  totalSubscribers,
  adminUrl,
}: {
  subscriberEmail: string;
  productName: string;
  totalSubscribers: number;
  adminUrl: string;
}): string {
  const content = `
  ${emailHeader()}

  <tr>
    <td style="background-color:#ffffff;padding:32px 32px 0;">
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#2b2215;">
        New Back-in-Stock Request
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#4f3d22;">
        Someone wants to know when <strong>${productName}</strong> is available again.
      </p>
    </td>
  </tr>

  ${divider()}

  <tr>
    <td style="background-color:#ffffff;padding:24px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0"
             style="background-color:#f5edda;border-radius:6px;width:100%;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4f3d22;">
              Subscriber
            </p>
            <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#2b2215;">
              ${subscriberEmail}
            </p>
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4f3d22;">
              Total waiting
            </p>
            <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#2b2215;">
              ${totalSubscribers} ${totalSubscribers === 1 ? "person" : "people"}
            </p>
            <a href="${adminUrl}"
               style="display:inline-block;background-color:#4d7a2e;color:#ffffff;font-size:14px;font-weight:600;letter-spacing:0.04em;text-decoration:none;padding:10px 24px;border-radius:6px;border:2px solid #3a5e22;">
              View in Admin
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  ${emailFooter()}`;

  return emailWrapper(content);
}
