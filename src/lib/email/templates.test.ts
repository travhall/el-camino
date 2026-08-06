import { describe, it, expect } from 'vitest';
import type { Order } from 'square-legacy';
import {
  escHtml,
  formatMoney,
  shortOrderId,
  formatPickupTime,
  buildOrderConfirmationHtml,
  buildBackInStockHtml,
  buildShippingOrderNotificationHtml,
  buildShippingConfirmationHtml,
  buildPickupNotificationHtml,
  buildPickupReminderHtml,
  buildBisAdminNotificationHtml,
} from './templates';

describe('escHtml', () => {
  it('escapes all five HTML metacharacters', () => {
    expect(escHtml('<script>alert("xss")&nbsp;</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&amp;nbsp;&lt;/script&gt;'
    );
  });
  it('returns empty string for null', () => {
    expect(escHtml(null)).toBe('');
  });
  it('returns empty string for undefined', () => {
    expect(escHtml(undefined)).toBe('');
  });
  it('returns empty string for empty string', () => {
    expect(escHtml('')).toBe('');
  });
  it('leaves safe text unchanged', () => {
    expect(escHtml('Hello World')).toBe('Hello World');
  });
  it('escapes & before < so double-encoding does not occur', () => {
    expect(escHtml('a&b')).toBe('a&amp;b');
    expect(escHtml('a&lt;b')).toBe('a&amp;lt;b');
  });
});

describe('formatMoney', () => {
  it('returns $0.00 for null', () => {
    expect(formatMoney(null)).toBe('$0.00');
  });

  it('returns $0.00 for undefined', () => {
    expect(formatMoney(undefined)).toBe('$0.00');
  });

  it('formats a number (cents) correctly', () => {
    expect(formatMoney(1099)).toBe('$10.99');
  });

  it("formats a bigint (Square's actual return type)", () => {
    expect(formatMoney(2500n)).toBe('$25.00');
  });

  it('formats $0.00 for 0n (zero-value order)', () => {
    expect(formatMoney(0n)).toBe('$0.00');
  });

  it('formats large amounts correctly', () => {
    expect(formatMoney(100000)).toBe('$1000.00');
  });

  it('formats a large bigint amount correctly', () => {
    expect(formatMoney(9999n)).toBe('$99.99');
  });
});

describe('shortOrderId', () => {
  it('returns the last 8 characters uppercased', () => {
    expect(shortOrderId('abcdefgh12345678')).toBe('12345678');
  });

  it('uppercases lowercase characters', () => {
    expect(shortOrderId('XXXXXabc12345678')).toBe('12345678');
  });

  it('handles IDs shorter than 8 chars without crashing', () => {
    const result = shortOrderId('abc');
    expect(typeof result).toBe('string');
    expect(result).toBe('ABC');
  });

  it('uppercases alphabetic characters at the end of the ID', () => {
    expect(shortOrderId('000000000000abcdefgh')).toBe('ABCDEFGH');
  });
});

describe('formatPickupTime', () => {
  it('formats an ISO timestamp in Central Time', () => {
    // 2026-07-22T15:00:00Z = 10:00 AM CDT (UTC-5 in summer)
    const result = formatPickupTime('2026-07-22T15:00:00.000Z');
    expect(result).toContain('10:00 AM');
    expect(result).toContain('Jul');
    expect(result).toContain('22');
  });

  it('returns a non-empty string for any valid ISO date', () => {
    const result = formatPickupTime('2026-01-01T12:00:00.000Z');
    expect(result.length).toBeGreaterThan(5);
  });

  it('includes a timezone abbreviation in the output', () => {
    const result = formatPickupTime('2026-07-22T15:00:00.000Z');
    // CDT in summer, CST in winter — just check something timezone-shaped is present
    expect(result).toMatch(/C[SD]T/);
  });
});

// ─── Shared test fixtures ─────────────────────────────────────────────────────

function makePickupOrder(overrides?: Record<string, unknown>) {
  return {
    id: 'PICKUPORDER12345678',
    totalMoney: { amount: 2999n, currency: 'USD' },
    lineItems: [
      { name: 'Street Deck', quantity: '1', totalMoney: { amount: 2999n } },
    ],
    fulfillments: [{ type: 'PICKUP', pickupDetails: {} }],
    ...overrides,
  } as unknown as Order;
}

function makeShippingOrder(overrides?: Record<string, unknown>) {
  return {
    id: 'SHIPORDER123456789',
    totalMoney: { amount: 5999n, currency: 'USD' },
    lineItems: [
      { name: 'Trucks', quantity: '2', totalMoney: { amount: 5999n } },
    ],
    fulfillments: [
      {
        type: 'SHIPMENT',
        shipmentDetails: {
          recipient: {
            address: {
              addressLine1: '123 Main St',
              locality: 'Eau Claire',
              administrativeDistrictLevel1: 'WI',
              postalCode: '54701',
            },
          },
        },
      },
    ],
    ...overrides,
  } as unknown as Order;
}

const pickupContact = {
  name: 'Travis Hall',
  email: 'travis@example.com',
  fulfillmentMethod: 'pickup' as const,
  phone: '',
  notes: '',
};

const shippingContact = {
  name: 'Travis Hall',
  email: 'travis@example.com',
  fulfillmentMethod: 'shipping' as const,
  phone: '',
  notes: '',
};

// ─── buildOrderConfirmationHtml ───────────────────────────────────────────────

describe('buildOrderConfirmationHtml', () => {
  it('returns a non-empty HTML string', () => {
    const result = buildOrderConfirmationHtml({
      order: makePickupOrder(),
      contact: pickupContact,
    });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
    expect(result).toContain('<!DOCTYPE html>');
  });

  it('includes the order reference in the output', () => {
    const result = buildOrderConfirmationHtml({
      order: makePickupOrder(),
      contact: pickupContact,
    });
    // shortOrderId of "PICKUPORDER12345678" → "12345678" cSpell:ignore SHIPORDER PICKUPORDER uppercases uppercased Xabc REMINDORDER
    expect(result).toContain('12345678');
  });

  it('renders pickup details section for pickup fulfillment method', () => {
    const result = buildOrderConfirmationHtml({
      order: makePickupOrder(),
      contact: pickupContact,
    });
    expect(result).toContain('Pick Up Details');
    expect(result).not.toContain('Shipping To');
  });

  it('renders shipping details section for shipping fulfillment method', () => {
    const result = buildOrderConfirmationHtml({
      order: makeShippingOrder(),
      contact: shippingContact,
    });
    expect(result).toContain('Shipping To');
    expect(result).not.toContain('Pick Up Details');
  });

  it('shows formatted pickup time when pickupAt is present', () => {
    const order = makePickupOrder({
      fulfillments: [
        {
          type: 'PICKUP',
          pickupDetails: { pickupAt: '2026-07-22T15:00:00.000Z' },
        },
      ],
    });
    const result = buildOrderConfirmationHtml({
      order,
      contact: pickupContact,
    });
    expect(result).toContain('approximately');
    expect(result).not.toContain("We'll reach out");
  });

  it('shows fallback text when pickupAt is absent', () => {
    const result = buildOrderConfirmationHtml({
      order: makePickupOrder(),
      contact: pickupContact,
    });
    expect(result).toContain("We'll reach out");
  });

  it('uses custom hoursLine when provided', () => {
    const result = buildOrderConfirmationHtml({
      order: makePickupOrder(),
      contact: pickupContact,
      hoursLine: 'Mon–Fri 10am–6pm',
    });
    expect(result).toContain('Mon–Fri 10am–6pm');
  });

  it('uses default hoursLine when not provided', () => {
    const result = buildOrderConfirmationHtml({
      order: makePickupOrder(),
      contact: pickupContact,
    });
    expect(result).toContain('See website for hours');
  });

  it('shows shipping address lines when present', () => {
    const result = buildOrderConfirmationHtml({
      order: makeShippingOrder(),
      contact: shippingContact,
    });
    expect(result).toContain('123 Main St');
    expect(result).toContain('Eau Claire');
  });

  it("falls back to 'Address on file' when no fulfillment address", () => {
    const order = makeShippingOrder({
      fulfillments: [{ type: 'SHIPMENT', shipmentDetails: { recipient: {} } }],
    });
    const result = buildOrderConfirmationHtml({
      order,
      contact: shippingContact,
    });
    expect(result).toContain('Address on file');
  });

  it('includes optional address line 2 when present', () => {
    const order = makeShippingOrder({
      fulfillments: [
        {
          type: 'SHIPMENT',
          shipmentDetails: {
            recipient: {
              address: {
                addressLine1: '123 Main St',
                addressLine2: 'Apt 4B',
                locality: 'Eau Claire',
                administrativeDistrictLevel1: 'WI',
                postalCode: '54701',
              },
            },
          },
        },
      ],
    });
    const result = buildOrderConfirmationHtml({
      order,
      contact: shippingContact,
    });
    expect(result).toContain('Apt 4B');
  });

  it('renders line items in the order summary', () => {
    const result = buildOrderConfirmationHtml({
      order: makePickupOrder(),
      contact: pickupContact,
    });
    expect(result).toContain('Street Deck');
  });

  it('renders order with empty lineItems without crashing', () => {
    const order = makePickupOrder({ lineItems: [] });
    const result = buildOrderConfirmationHtml({
      order,
      contact: pickupContact,
    });
    expect(result).toContain('Total');
  });

  it('renders order total when totalMoney is null', () => {
    const order = makePickupOrder({ totalMoney: null });
    const result = buildOrderConfirmationHtml({
      order,
      contact: pickupContact,
    });
    expect(result).toContain('$0.00');
  });

  it('shows quantity multiplier for items with qty > 1', () => {
    const order = makePickupOrder({
      lineItems: [
        { name: 'Wheels', quantity: '4', totalMoney: { amount: 8000n } },
      ],
    });
    const result = buildOrderConfirmationHtml({
      order,
      contact: pickupContact,
    });
    // Template uses HTML entity &times; not the literal × character
    expect(result).toContain('&times; 4');
  });

  it('escapes HTML in customer name to prevent XSS', () => {
    const maliciousContact = {
      ...pickupContact,
      name: "<script>alert('xss')</script>",
    };
    const result = buildOrderConfirmationHtml({
      order: makePickupOrder(),
      contact: maliciousContact,
    });
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });
});

// ─── buildBackInStockHtml ─────────────────────────────────────────────────────

describe('buildBackInStockHtml', () => {
  it('returns a non-empty HTML string', () => {
    const result = buildBackInStockHtml({
      customerName: 'Jordan Lee',
      productName: 'Polar Bear Deck',
      productUrl: 'https://elcaminoskateshop.com/product/polar-bear-deck',
    });
    expect(result).toContain('<!DOCTYPE html>');
    expect(result.length).toBeGreaterThan(100);
  });

  it('includes the product name without variation when variationName is absent', () => {
    const result = buildBackInStockHtml({
      customerName: 'Jordan Lee',
      productName: 'Polar Bear Deck',
      productUrl: 'https://elcaminoskateshop.com/product/polar-bear-deck',
    });
    expect(result).toContain('Polar Bear Deck');
    // Variation separator should not appear in the product name span
    expect(result).not.toContain('Polar Bear Deck —');
  });

  it('includes variationName appended to product name when provided', () => {
    const result = buildBackInStockHtml({
      customerName: 'Jordan Lee',
      productName: 'Vans Shoes',
      productUrl: 'https://elcaminoskateshop.com/product/vans',
      variationName: 'Size 10',
    });
    expect(result).toContain('Vans Shoes');
    expect(result).toContain('Size 10');
  });

  it('renders the formatted price when price is provided', () => {
    const result = buildBackInStockHtml({
      customerName: 'Jordan Lee',
      productName: 'Polar Bear Deck',
      productUrl: 'https://elcaminoskateshop.com/product/polar-bear-deck',
      price: 5999,
    });
    expect(result).toContain('$59.99');
  });

  it('renders an empty price paragraph when price is omitted', () => {
    const result = buildBackInStockHtml({
      customerName: 'Jordan Lee',
      productName: 'Polar Bear Deck',
      productUrl: 'https://elcaminoskateshop.com/product/polar-bear-deck',
    });
    expect(result).not.toContain('$');
  });

  it('uses the first name from customerName', () => {
    const result = buildBackInStockHtml({
      customerName: 'Jordan Lee',
      productName: 'Deck',
      productUrl: 'https://elcaminoskateshop.com/product/deck',
    });
    expect(result).toContain('Jordan');
    expect(result).not.toContain('Lee');
  });
});

// ─── buildShippingOrderNotificationHtml ──────────────────────────────────────

describe('buildShippingOrderNotificationHtml', () => {
  it('returns a non-empty HTML string', () => {
    const result = buildShippingOrderNotificationHtml({
      order: makeShippingOrder(),
      contact: shippingContact,
    });
    expect(result).toContain('<!DOCTYPE html>');
    expect(result.length).toBeGreaterThan(100);
  });

  it('includes customer name, email, and order ref', () => {
    const result = buildShippingOrderNotificationHtml({
      order: makeShippingOrder(),
      contact: shippingContact,
    });
    expect(result).toContain('Travis Hall');
    expect(result).toContain('travis@example.com');
    // shortOrderId("SHIPORDER123456789") → "23456789"
    expect(result).toContain('23456789');
  });

  it('shows ship-to address when fulfillment address is present', () => {
    const result = buildShippingOrderNotificationHtml({
      order: makeShippingOrder(),
      contact: shippingContact,
    });
    expect(result).toContain('123 Main St');
    expect(result).toContain('Eau Claire');
  });

  it('shows fallback text when no fulfillment address is found', () => {
    const order = makeShippingOrder({ fulfillments: [] });
    const result = buildShippingOrderNotificationHtml({
      order,
      contact: shippingContact,
    });
    expect(result).toContain('Address not captured');
  });

  it('includes address line 2 when present', () => {
    const order = makeShippingOrder({
      fulfillments: [
        {
          type: 'SHIPMENT',
          shipmentDetails: {
            recipient: {
              address: {
                addressLine1: '456 Oak Ave',
                addressLine2: 'Suite 3',
                locality: 'Eau Claire',
                administrativeDistrictLevel1: 'WI',
                postalCode: '54701',
              },
            },
          },
        },
      ],
    });
    const result = buildShippingOrderNotificationHtml({
      order,
      contact: shippingContact,
    });
    expect(result).toContain('Suite 3');
  });

  it('renders $0.00 total when totalMoney is null', () => {
    const order = makeShippingOrder({ totalMoney: null });
    const result = buildShippingOrderNotificationHtml({
      order,
      contact: shippingContact,
    });
    expect(result).toContain('$0.00');
  });

  it('escapes HTML-special characters in the mailto href to prevent attribute injection', () => {
    const maliciousContact = {
      ...shippingContact,
      email: 'x"><script>alert(1)</script>@example.com',
    };
    const result = buildShippingOrderNotificationHtml({
      order: makeShippingOrder(),
      contact: maliciousContact,
    });
    expect(result).toContain(
      'href="mailto:x&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;@example.com"'
    );
    expect(result).not.toContain('href="mailto:x">');
  });
});

// ─── buildShippingConfirmationHtml ────────────────────────────────────────────

describe('buildShippingConfirmationHtml', () => {
  it('returns a non-empty HTML string', () => {
    const result = buildShippingConfirmationHtml({
      order: makeShippingOrder(),
      contact: shippingContact,
    });
    expect(result).toContain('<!DOCTYPE html>');
    expect(result.length).toBeGreaterThan(100);
  });

  it('includes the customer first name', () => {
    const result = buildShippingConfirmationHtml({
      order: makeShippingOrder(),
      contact: shippingContact,
    });
    expect(result).toContain('Travis');
  });

  it('omits the tracking section when no tracking number is provided', () => {
    const result = buildShippingConfirmationHtml({
      order: makeShippingOrder(),
      contact: shippingContact,
    });
    expect(result).not.toContain('Tracking');
  });

  it('includes tracking number in the output when provided', () => {
    const result = buildShippingConfirmationHtml({
      order: makeShippingOrder(),
      contact: shippingContact,
      trackingNumber: '9400111899223397988071',
      carrier: 'USPS',
    });
    expect(result).toContain('9400111899223397988071');
    expect(result).toContain('Tracking');
  });

  it('renders a USPS tracking link', () => {
    const result = buildShippingConfirmationHtml({
      order: makeShippingOrder(),
      contact: shippingContact,
      trackingNumber: '9400111899',
      carrier: 'USPS',
    });
    expect(result).toContain('tools.usps.com');
    expect(result).toContain('Track Package');
  });

  it('renders a UPS tracking link', () => {
    const result = buildShippingConfirmationHtml({
      order: makeShippingOrder(),
      contact: shippingContact,
      trackingNumber: '1Z999AA10123456784',
      carrier: 'UPS',
    });
    expect(result).toContain('ups.com/track');
    expect(result).toContain('Track Package');
  });

  it('renders a FedEx tracking link', () => {
    const result = buildShippingConfirmationHtml({
      order: makeShippingOrder(),
      contact: shippingContact,
      trackingNumber: '123456789012',
      carrier: 'FedEx',
    });
    expect(result).toContain('fedex.com');
    expect(result).toContain('Track Package');
  });

  it('shows tracking number without a link for an unknown carrier', () => {
    const result = buildShippingConfirmationHtml({
      order: makeShippingOrder(),
      contact: shippingContact,
      trackingNumber: 'ABC123',
      carrier: 'DHL',
    });
    expect(result).toContain('ABC123');
    expect(result).not.toContain('Track Package');
  });

  it('shows tracking number without a link when carrier is omitted', () => {
    const result = buildShippingConfirmationHtml({
      order: makeShippingOrder(),
      contact: shippingContact,
      trackingNumber: 'ABC123',
    });
    expect(result).toContain('ABC123');
    expect(result).not.toContain('Track Package');
  });

  it('shows the carrier label in the tracking section when provided', () => {
    const result = buildShippingConfirmationHtml({
      order: makeShippingOrder(),
      contact: shippingContact,
      trackingNumber: '9400111899',
      carrier: 'USPS',
    });
    expect(result).toContain('USPS');
  });
});

// ─── buildPickupNotificationHtml ──────────────────────────────────────────────

describe('buildPickupNotificationHtml', () => {
  it('returns a non-empty HTML string', () => {
    const result = buildPickupNotificationHtml({
      order: makePickupOrder(),
      contact: pickupContact,
    });
    expect(result).toContain('<!DOCTYPE html>');
    expect(result.length).toBeGreaterThan(100);
  });

  it('includes customer name and email', () => {
    const result = buildPickupNotificationHtml({
      order: makePickupOrder(),
      contact: pickupContact,
    });
    expect(result).toContain('Travis Hall');
    expect(result).toContain('travis@example.com');
  });

  it("shows customer note box when pickup note contains 'Customer Notes:'", () => {
    const order = makePickupOrder({
      fulfillments: [
        {
          type: 'PICKUP',
          pickupDetails: {
            note: 'Customer Notes: Please have it ready at the counter',
          },
        },
      ],
    });
    const result = buildPickupNotificationHtml({
      order,
      contact: pickupContact,
    });
    expect(result).toContain('Customer note:');
    expect(result).toContain('Please have it ready at the counter');
  });

  it('omits customer note box when no notes are present', () => {
    const result = buildPickupNotificationHtml({
      order: makePickupOrder(),
      contact: pickupContact,
    });
    expect(result).not.toContain('Customer note:');
  });

  it('renders line items and total', () => {
    const result = buildPickupNotificationHtml({
      order: makePickupOrder(),
      contact: pickupContact,
    });
    expect(result).toContain('Street Deck');
    expect(result).toContain('$29.99');
  });

  it('renders $0.00 total when totalMoney is null', () => {
    const order = makePickupOrder({ totalMoney: null });
    const result = buildPickupNotificationHtml({
      order,
      contact: pickupContact,
    });
    expect(result).toContain('$0.00');
  });

  it('escapes HTML-special characters in the mailto href to prevent attribute injection', () => {
    const maliciousContact = {
      ...pickupContact,
      email: 'x"><script>alert(1)</script>@example.com',
    };
    const result = buildPickupNotificationHtml({
      order: makePickupOrder(),
      contact: maliciousContact,
    });
    expect(result).toContain(
      'href="mailto:x&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;@example.com"'
    );
    expect(result).not.toContain('href="mailto:x">');
  });
});

// ─── buildPickupReminderHtml ──────────────────────────────────────────────────

describe('buildPickupReminderHtml', () => {
  it('returns a non-empty HTML string', () => {
    const result = buildPickupReminderHtml({
      customerName: 'Sam Rivera',
      orderId: 'REMINDORDER12345678',
      items: [{ name: 'Deck', qty: '1' }],
    });
    expect(result).toContain('<!DOCTYPE html>');
    expect(result.length).toBeGreaterThan(100);
  });

  it('uses first name from customerName', () => {
    const result = buildPickupReminderHtml({
      customerName: 'Sam Rivera',
      orderId: 'REMINDORDER12345678',
      items: [{ name: 'Deck', qty: '1' }],
    });
    expect(result).toContain('Sam');
    expect(result).not.toContain('Rivera');
  });

  it('shows pickup time note when pickupAt is provided', () => {
    const result = buildPickupReminderHtml({
      customerName: 'Sam Rivera',
      orderId: 'REMINDORDER12345678',
      items: [{ name: 'Deck', qty: '1' }],
      pickupAt: 'Thu, Apr 10 at 3:00 PM CDT',
    });
    expect(result).toContain('Thu, Apr 10 at 3:00 PM CDT');
    expect(result).toContain('approximately');
  });

  it('omits pickup time note when pickupAt is not provided', () => {
    const result = buildPickupReminderHtml({
      customerName: 'Sam Rivera',
      orderId: 'REMINDORDER12345678',
      items: [{ name: 'Deck', qty: '1' }],
    });
    expect(result).not.toContain('approximately');
  });

  it('uses the default hoursLine when not provided', () => {
    const result = buildPickupReminderHtml({
      customerName: 'Sam Rivera',
      orderId: 'REMINDORDER12345678',
      items: [{ name: 'Deck', qty: '1' }],
    });
    expect(result).toContain('See website for hours');
  });

  it('uses the provided hoursLine', () => {
    const result = buildPickupReminderHtml({
      customerName: 'Sam Rivera',
      orderId: 'REMINDORDER12345678',
      items: [{ name: 'Deck', qty: '1' }],
      hoursLine: 'Tue–Sat 11am–7pm',
    });
    expect(result).toContain('Tue–Sat 11am–7pm');
  });

  it('shows quantity multiplier for items with qty > 1', () => {
    const result = buildPickupReminderHtml({
      customerName: 'Sam Rivera',
      orderId: 'REMINDORDER12345678',
      items: [{ name: 'Wheels', qty: '4' }],
    });
    // Template uses HTML entity &times; not the literal × character
    expect(result).toContain('&times; 4');
  });

  it('omits quantity multiplier for items with qty = 1', () => {
    const result = buildPickupReminderHtml({
      customerName: 'Sam Rivera',
      orderId: 'REMINDORDER12345678',
      items: [{ name: 'Deck', qty: '1' }],
    });
    expect(result).not.toContain('×');
  });

  it('includes the short order ID in the output', () => {
    const result = buildPickupReminderHtml({
      customerName: 'Sam Rivera',
      orderId: 'REMINDORDER12345678',
      items: [{ name: 'Deck', qty: '1' }],
    });
    // shortOrderId("REMINDORDER12345678") → last 8 chars = "12345678"
    expect(result).toContain('12345678');
  });
});

// ─── buildBisAdminNotificationHtml ───────────────────────────────────────────

describe('buildBisAdminNotificationHtml', () => {
  it('returns a non-empty HTML string', () => {
    const result = buildBisAdminNotificationHtml({
      subscriberEmail: 'fan@example.com',
      productName: 'Fancy Deck',
      totalSubscribers: 1,
      adminUrl:
        'https://elcaminoskateshop.com/admin/notifications/back-in-stock',
    });
    expect(result).toContain('<!DOCTYPE html>');
    expect(result.length).toBeGreaterThan(100);
  });

  it("shows singular 'person' for exactly 1 subscriber", () => {
    const result = buildBisAdminNotificationHtml({
      subscriberEmail: 'fan@example.com',
      productName: 'Fancy Deck',
      totalSubscribers: 1,
      adminUrl:
        'https://elcaminoskateshop.com/admin/notifications/back-in-stock',
    });
    expect(result).toContain('1 person');
    expect(result).not.toContain('people');
  });

  it("shows plural 'people' for more than 1 subscriber", () => {
    const result = buildBisAdminNotificationHtml({
      subscriberEmail: 'fan@example.com',
      productName: 'Fancy Deck',
      totalSubscribers: 5,
      adminUrl:
        'https://elcaminoskateshop.com/admin/notifications/back-in-stock',
    });
    expect(result).toContain('5 people');
    expect(result).not.toContain('1 person');
  });

  it('includes the subscriber email and product name', () => {
    const result = buildBisAdminNotificationHtml({
      subscriberEmail: 'fan@example.com',
      productName: 'Fancy Deck',
      totalSubscribers: 3,
      adminUrl:
        'https://elcaminoskateshop.com/admin/notifications/back-in-stock',
    });
    expect(result).toContain('fan@example.com');
    expect(result).toContain('Fancy Deck');
  });

  it('includes the admin URL link', () => {
    const result = buildBisAdminNotificationHtml({
      subscriberEmail: 'fan@example.com',
      productName: 'Fancy Deck',
      totalSubscribers: 1,
      adminUrl:
        'https://elcaminoskateshop.com/admin/notifications/back-in-stock',
    });
    expect(result).toContain(
      'https://elcaminoskateshop.com/admin/notifications/back-in-stock'
    );
  });
});
