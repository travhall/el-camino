import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ShippingAddress, PickupContact } from '../types';

vi.mock('../pickupScheduling', () => ({
  nextPickupTime: vi.fn(),
}));

vi.mock('@/lib/config/shipping', () => ({
  getPickupLocation: vi.fn(),
}));

import {
  buildShippingFulfillment,
  buildPickupFulfillment,
} from '../fulfillmentBuilders';
import { nextPickupTime } from '../pickupScheduling';
import { getPickupLocation } from '@/lib/config/shipping';

const fullAddress: ShippingAddress = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '4155551234',
  street1: '123 Main St',
  street2: 'Apt 4B',
  city: 'San Francisco',
  state: 'CA',
  zip: '94105',
  instructions: 'Leave at door',
};

describe('buildShippingFulfillment', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('assembles a full Fulfillment object from a complete address', () => {
    const result = buildShippingFulfillment(fullAddress);

    expect(result).toEqual({
      type: 'SHIPMENT',
      state: 'PROPOSED',
      shipmentDetails: {
        recipient: {
          displayName: 'Jane Doe',
          emailAddress: 'jane@example.com',
          phoneNumber: '+14155551234',
          address: {
            addressLine1: '123 Main St',
            addressLine2: 'Apt 4B',
            locality: 'San Francisco',
            administrativeDistrictLevel1: 'CA',
            postalCode: '94105',
            country: 'US',
          },
        },
        expectedShippedAt: '2026-01-03T00:00:00.000Z',
        shippingNote: 'Delivery Instructions: Leave at door',
      },
    });
  });

  it('expectedShippedAt is exactly +2 days from a frozen clock, with no business-day logic', () => {
    const result = buildShippingFulfillment(fullAddress);
    // Characterizes fulfillmentBuilders.ts:11-12: a flat +2 calendar days,
    // regardless of weekends/holidays. Not asserted against Date.now() at
    // assertion time — the clock is frozen above.
    expect(result.shipmentDetails!.expectedShippedAt).toBe(
      '2026-01-03T00:00:00.000Z'
    );
  });

  // FINDING (reported, not fixed — see plans/165 STOP conditions):
  // fulfillmentBuilders.ts:29 is `shippingAddress.street2 || undefined`. When
  // street2 is absent, this sets the object KEY `addressLine2` to the value
  // `undefined` rather than omitting the key. `toHaveProperty` (and `in`)
  // see the key regardless of its value, so it IS present here — only a
  // JSON-serializing transport (e.g. `JSON.stringify`) would drop it later.
  // If Square's SDK sends this object as-is without JSON-stringifying first,
  // an explicit `addressLine2: undefined` could behave differently downstream
  // than a genuinely absent key. Characterizing current behavior, not fixing it.
  it('sets addressLine2 to undefined (key present, not omitted) when street2 is absent', () => {
    const withoutStreet2 = { ...fullAddress };
    delete withoutStreet2.street2;
    const result = buildShippingFulfillment(withoutStreet2 as ShippingAddress);

    const address = result.shipmentDetails!.recipient!.address!;
    expect(address).toHaveProperty('addressLine2');
    expect(address.addressLine2).toBeUndefined();
  });

  it('omits shippingNote when instructions are absent', () => {
    const withoutInstructions = { ...fullAddress };
    delete withoutInstructions.instructions;
    const result = buildShippingFulfillment(
      withoutInstructions as ShippingAddress
    );

    expect(result.shipmentDetails!.shippingNote).toBeUndefined();
  });

  it('omits shippingNote when instructions are only whitespace', () => {
    const result = buildShippingFulfillment({
      ...fullAddress,
      instructions: '   ',
    });

    expect(result.shipmentDetails!.shippingNote).toBeUndefined();
  });

  it('preserves special characters in the recipient name', () => {
    const result = buildShippingFulfillment({
      ...fullAddress,
      name: "José O'Brien-Núñez 李",
    });

    expect(result.shipmentDetails!.recipient!.displayName).toBe(
      "José O'Brien-Núñez 李"
    );
  });
});

describe('buildPickupFulfillment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPickupLocation).mockResolvedValue({
      name: 'El Camino Shop',
      instructions: 'Pick up only available during store hours.',
    });
    vi.mocked(nextPickupTime).mockResolvedValue(
      new Date('2026-01-01T14:00:00.000Z')
    );
  });

  const contact: PickupContact = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '4155551234',
  };

  it('uses the fetched pickup location in the note and pickupAt from nextPickupTime', async () => {
    const result = await buildPickupFulfillment(contact);

    expect(result).toEqual({
      type: 'PICKUP',
      state: 'PROPOSED',
      pickupDetails: {
        recipient: {
          displayName: 'Jane Doe',
          emailAddress: 'jane@example.com',
          phoneNumber: '+14155551234',
        },
        pickupAt: '2026-01-01T14:00:00.000Z',
        note: 'Pick up at El Camino Shop. Pick up only available during store hours.',
      },
    });
  });

  it('appends customer notes to the pickup note when present', async () => {
    const result = await buildPickupFulfillment({
      ...contact,
      notes: 'Ring the bell',
    });

    expect(result.pickupDetails!.note).toBe(
      'Pick up at El Camino Shop. Pick up only available during store hours.\n\nCustomer Notes: Ring the bell'
    );
  });

  it('does not append a Customer Notes section when notes are absent', async () => {
    const result = await buildPickupFulfillment(contact);

    expect(result.pickupDetails!.note).not.toContain('Customer Notes');
  });

  it('does not append a Customer Notes section when notes are only whitespace', async () => {
    const result = await buildPickupFulfillment({ ...contact, notes: '   ' });

    expect(result.pickupDetails!.note).not.toContain('Customer Notes');
  });
});
