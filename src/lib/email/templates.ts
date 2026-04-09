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

// Email-specific logo: path-only, cream fill (#fdf8ee), no white background rect.
// Renders at 54×50px on the dark #0f1918 header. Derived from EL_CAMINO_LOGO_DATA_URI.
const EMAIL_LOGO_DATA_URI =
  "data:image/svg+xml,%3Csvg%20width%3D%2272%22%20height%3D%2266%22%20viewBox%3D%220%200%2048%2044%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M12.904%2039.9998L12.827%2040C10.7973%2040%209.28558%2039.5717%208.98823%2039.4875C7.2466%2038.9908%206.24507%2038.0664%206.05024%2037.8868C5.85673%2037.7041%204.86739%2036.7717%204.32907%2035.0827C3.79098%2033.393%204.06438%2031.424%204.10835%2031.1083C4.41789%2028.8789%205.18323%2027.5482%205.34541%2027.2665C6.28447%2025.6546%207.48735%2024.7851%207.72026%2024.617C7.95644%2024.4461%209.16912%2023.5682%2011.049%2023.0713C11.3683%2022.9875%2012.9403%2022.5746%2015.1546%2022.5746C16.5158%2022.5746%2017.3886%2022.6832%2017.5815%2022.7072C18.6588%2022.8396%2019.3555%2023.0028%2019.5075%2023.0382C20.3568%2023.2372%2020.8753%2023.4448%2020.9903%2023.4909L22.1355%2023.9657C21.9004%2025.6583%2021.6653%2027.3511%2021.4303%2029.0439H17.9585C17.4809%2028.2493%2016.9223%2027.9384%2016.8061%2027.8736C16.1433%2027.4983%2015.5003%2027.4983%2015.3821%2027.4983C15.2767%2027.4983%2014.7362%2027.4983%2014.0913%2027.7413C13.9885%2027.7807%2013.4576%2027.9843%2012.9203%2028.4478C12.8311%2028.5247%2012.3829%2028.9116%2012.0013%2029.5847C11.9369%2029.6968%2011.6208%2030.2474%2011.5013%2031.1083C11.478%2031.2752%2011.3041%2032.5284%2011.4628%2033.2133C11.6213%2033.8974%2011.9737%2034.2651%2012.0446%2034.3393C12.1158%2034.4118%2012.4791%2034.7808%2013.1537%2034.9906L13.9563%2035.1554L15.2175%2035.1904C15.4058%2035.1835%2016.431%2035.1461%2017.5641%2035.0065C22.2646%2034.2029%2023.3571%2029.7977%2023.9069%2028.6215L24.0171%2028.3595C24.5561%2027.1344%2025.2245%2026.3417%2025.3573%2026.1846L25.3606%2026.1806C25.5954%2025.8873%2026.8158%2024.3632%2029.2838%2023.4893L29.4298%2023.4357C29.6279%2023.3638%2030.6452%2022.994%2031.9888%2022.7844C32.2096%2022.7503%2033.3443%2022.5746%2034.7747%2022.5746H34.786C36.2098%2022.5754%2037.2871%2022.7496%2037.5022%2022.7844C38.7998%2022.9942%2039.7083%2023.3617%2039.8914%2023.4357C40.9837%2023.8774%2041.6851%2024.4495%2041.8228%2024.5618C41.9576%2024.6701%2042.6738%2025.2462%2043.2108%2026.1956C43.7088%2027.0762%2043.8808%2028.1905%2043.9086%2028.3705C43.9426%2028.5869%2044.1002%2029.5933%2043.9014%2031.1083C43.5843%2033.5256%2042.7306%2034.9081%2042.5479%2035.204C41.5044%2036.9042%2040.1994%2037.8105%2039.9469%2037.986C39.6973%2038.1595%2038.3898%2039.0678%2036.4452%2039.5317C36.1249%2039.6062%2034.4344%2040%2032.3546%2040C32.1384%2040%2031.0728%2040%2029.6578%2039.8188C28.3773%2039.6531%2027.4671%2039.2752%2027.2868%2039.2004C26.2078%2038.7479%2025.4973%2038.1557%2025.3599%2038.0412L24.6875%2037.3722C21.3547%2039.3369%2016.4519%2039.7748%2015.7077%2039.8414C15.4848%2039.8619%2014.0673%2039.9923%2012.9147%2039.9998H12.904ZM32.8021%2027.8074C32.2814%2027.9843%2031.9688%2028.2322%2031.9057%2028.2822C31.5413%2028.5803%2031.3528%2028.8947%2031.3163%2028.9555L30.9453%2029.7173L30.7488%2030.4681L30.6482%2031.1083L30.5709%2031.7486L30.5574%2032.5103L30.7153%2033.2832C30.7339%2033.3441%2030.8345%2033.6693%2031.1147%2033.9787C31.1649%2034.0297%2031.4077%2034.2766%2031.8776%2034.4643C31.9693%2034.4999%2032.3589%2034.652%2033.0973%2034.652C33.8354%2034.652%2034.2618%2034.4987%2034.3574%2034.4643C34.8907%2034.2768%2035.2028%2034.0295%2035.2671%2033.9787C35.6443%2033.6695%2035.8341%2033.3461%2035.8711%2033.2832C36.1097%2032.8959%2036.2213%2032.5748%2036.2438%2032.5103L36.4418%2031.7486L36.5538%2031.1083L36.6197%2030.4681L36.6317%2029.7173C36.6273%2029.6553%2036.6047%2029.3318%2036.4721%2028.9555C36.4528%2028.8957%2036.3511%2028.5801%2036.0581%2028.2822C36.0076%2028.2307%2035.7647%2027.984%2035.2818%2027.8074C35.1915%2027.7713%2034.8119%2027.6198%2034.074%2027.6198C33.3356%2027.6198%2032.8988%2027.7734%2032.8021%2027.8074ZM16.2243%2018.0371C19.1879%2018.0371%2020.8618%2017.0233%2021.2023%2016.5018H23.1817C22.9538%2018.1432%2022.7258%2019.7843%2022.4979%2021.4254H6.6506C6.87851%2019.7843%207.10642%2018.1432%207.33433%2016.5018L8.89093%2016.2182C9.2144%2013.8888%209.53787%2011.5593%209.86133%209.23003L8.38374%208.94627C8.61252%207.29765%208.84152%205.64882%209.07052%204H24.9178C24.6899%205.64133%2024.462%207.28244%2024.2341%208.92377H22.3258C22.0638%208.48625%2020.3852%207.38828%2017.7032%207.38828C17.5148%208.74334%2017.3268%2010.0984%2017.1385%2011.4535C18.3579%2011.2076%2019.5773%2010.962%2020.7968%2010.7161C20.6108%2012.0547%2020.425%2013.3934%2020.2391%2014.7322C19.088%2014.4863%2017.9368%2014.2404%2016.7857%2013.9947C16.5984%2015.3422%2016.4113%2016.6898%2016.2243%2018.0371ZM34.4142%2017.164C34.9358%2017.171%2039.3738%2017.2315%2040.7318%2015.617H42.7278C42.4589%2017.5531%2042.1901%2019.4892%2041.9213%2021.4254H23.6953C23.9233%2019.7843%2024.1512%2018.1432%2024.3791%2016.5018L25.9357%2016.2182C26.2592%2013.8888%2026.5826%2011.5593%2026.9061%209.23003L25.4316%208.92356C25.6594%207.28244%2025.8873%205.64133%2026.1153%204H37.7597C37.5318%205.64133%2037.3038%207.28244%2037.0759%208.92356L35.5161%209.23003C35.1488%2011.8745%2034.7814%2014.5192%2034.4142%2017.164Z%22%20fill%3D%22%23fdf8ee%22%2F%3E%3C%2Fsvg%3E";

function emailHeader(): string {
  return `
  <!-- Header -->
  <tr>
    <td style="background-color:#0f1918;border-radius:8px 8px 0 0;padding:28px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;">
            <img src="${EMAIL_LOGO_DATA_URI}"
                 width="54" height="50"
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
        Pick Up Details
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
  order: import("square/legacy").Order;
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
      <a href="${siteConfig.url}/shop"
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
}

export function buildPickupReminderHtml({
  customerName,
  orderId,
  items,
  pickupAt,
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
        Store hours: Wed&ndash;Fri 11am&ndash;7pm &middot; Sat 11am&ndash;7pm &middot; Sun 11am&ndash;5pm
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
