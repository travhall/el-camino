// src/lib/checkout/validate.ts
// Validates the untrusted /api/create-checkout request body at the route
// boundary. Downstream modules (fulfillmentBuilders.ts, lineItems.ts) trust
// their inputs — this is the only place that should distrust them.
import type { CartItem } from '@/lib/cart/types';
import type { ShippingAddress, PickupContact } from './types';

// Matches calculate-cart.ts's MAX_CART_ITEMS — keep the two in sync.
export const MAX_CART_ITEMS = 50;
const MAX_ITEM_QUANTITY = 100;
const MAX_STRING_LENGTH = 200;
const MAX_NOTES_LENGTH = 1000;
const MAX_EMAIL_LENGTH = 254;

// Same pattern as back-in-stock.ts — loose on purpose, just rejects garbage.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ValidatedCheckoutBody {
  items: CartItem[];
  fulfillmentMethod: 'shipping' | 'pickup';
  shippingAddress?: ShippingAddress;
  pickupContact?: PickupContact;
  checkoutKey?: string;
}

export type ValidationResult =
  { ok: true; value: ValidatedCheckoutBody } | { ok: false; errors: string[] };

function isBoundedString(v: unknown, maxLength: number): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= maxLength;
}

function isBoundedOptionalString(v: unknown, maxLength: number): boolean {
  return v === undefined || (typeof v === 'string' && v.length <= maxLength);
}

function isValidEmail(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    v.length <= MAX_EMAIL_LENGTH &&
    EMAIL_PATTERN.test(v)
  );
}

function validateItem(item: unknown, index: number, errors: string[]): void {
  if (typeof item !== 'object' || item === null) {
    errors.push(`items[${index}]: not an object`);
    return;
  }
  const it = item as Record<string, unknown>;

  if (!isBoundedString(it.variationId, MAX_STRING_LENGTH)) {
    errors.push(`items[${index}].variationId: invalid`);
  }
  if (
    typeof it.quantity !== 'number' ||
    !Number.isInteger(it.quantity) ||
    it.quantity < 1 ||
    it.quantity > MAX_ITEM_QUANTITY
  ) {
    errors.push(`items[${index}].quantity: invalid`);
  }
  if (
    typeof it.price !== 'number' ||
    !Number.isFinite(it.price) ||
    it.price < 0
  ) {
    errors.push(`items[${index}].price: invalid`);
  }
}

function validateShippingAddress(
  addr: unknown,
  errors: string[]
): ShippingAddress | undefined {
  if (typeof addr !== 'object' || addr === null) {
    errors.push('shippingAddress: missing or invalid');
    return undefined;
  }
  const a = addr as Record<string, unknown>;

  if (!isBoundedString(a.name, MAX_STRING_LENGTH))
    errors.push('shippingAddress.name: invalid');
  if (!isValidEmail(a.email)) errors.push('shippingAddress.email: invalid');
  if (!isBoundedString(a.phone, MAX_STRING_LENGTH))
    errors.push('shippingAddress.phone: invalid');
  if (!isBoundedString(a.street1, MAX_STRING_LENGTH))
    errors.push('shippingAddress.street1: invalid');
  if (!isBoundedOptionalString(a.street2, MAX_STRING_LENGTH))
    errors.push('shippingAddress.street2: invalid');
  if (!isBoundedString(a.city, MAX_STRING_LENGTH))
    errors.push('shippingAddress.city: invalid');
  if (!isBoundedString(a.state, MAX_STRING_LENGTH))
    errors.push('shippingAddress.state: invalid');
  if (!isBoundedString(a.zip, MAX_STRING_LENGTH))
    errors.push('shippingAddress.zip: invalid');
  if (!isBoundedOptionalString(a.instructions, MAX_NOTES_LENGTH))
    errors.push('shippingAddress.instructions: invalid');

  return a as unknown as ShippingAddress;
}

function validatePickupContact(
  contact: unknown,
  errors: string[]
): PickupContact | undefined {
  if (typeof contact !== 'object' || contact === null) {
    errors.push('pickupContact: missing or invalid');
    return undefined;
  }
  const c = contact as Record<string, unknown>;

  if (!isBoundedString(c.name, MAX_STRING_LENGTH))
    errors.push('pickupContact.name: invalid');
  if (!isValidEmail(c.email)) errors.push('pickupContact.email: invalid');
  if (!isBoundedString(c.phone, MAX_STRING_LENGTH))
    errors.push('pickupContact.phone: invalid');
  if (!isBoundedOptionalString(c.notes, MAX_NOTES_LENGTH))
    errors.push('pickupContact.notes: invalid');

  return c as unknown as PickupContact;
}

export function validateCheckoutBody(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: ['body: not an object'] };
  }
  const b = body as Record<string, unknown>;

  const items = Array.isArray(b.items) ? b.items : null;
  if (!items || items.length < 1 || items.length > MAX_CART_ITEMS) {
    errors.push(`items: must contain 1 to ${MAX_CART_ITEMS} entries`);
  } else {
    items.forEach((item, i) => validateItem(item, i, errors));
  }

  const fulfillmentMethod =
    b.fulfillmentMethod === undefined ? 'shipping' : b.fulfillmentMethod;
  if (fulfillmentMethod !== 'shipping' && fulfillmentMethod !== 'pickup') {
    errors.push('fulfillmentMethod: must be "shipping" or "pickup"');
  }

  let shippingAddress: ShippingAddress | undefined;
  let pickupContact: PickupContact | undefined;

  if (fulfillmentMethod === 'shipping') {
    shippingAddress = validateShippingAddress(b.shippingAddress, errors);
  } else if (fulfillmentMethod === 'pickup') {
    pickupContact = validatePickupContact(b.pickupContact, errors);
  }

  if (
    b.checkoutKey !== undefined &&
    (typeof b.checkoutKey !== 'string' || !UUID_PATTERN.test(b.checkoutKey))
  ) {
    errors.push('checkoutKey: must be a UUID');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      items: items as CartItem[],
      fulfillmentMethod: fulfillmentMethod as 'shipping' | 'pickup',
      shippingAddress,
      pickupContact,
      checkoutKey: b.checkoutKey as string | undefined,
    },
  };
}
