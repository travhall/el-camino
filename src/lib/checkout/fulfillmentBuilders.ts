import type { Fulfillment } from 'square-legacy';
import { getPickupLocation } from '@/lib/config/shipping';
import { nextPickupTime } from './pickupScheduling';
import { normalizePhoneE164 } from './phone';
import type { ShippingAddress, PickupContact } from './types';

export function buildShippingFulfillment(
  shippingAddress: ShippingAddress
): Fulfillment {
  // Calculate expected ship date (2 business days from now)
  const shipDate = new Date();
  shipDate.setDate(shipDate.getDate() + 2);

  // Build shipment note — stores delivery instructions so the admin page can surface them
  const shipmentNote = shippingAddress.instructions?.trim()
    ? `Delivery Instructions: ${shippingAddress.instructions.trim()}`
    : undefined;

  return {
    type: 'SHIPMENT',
    state: 'PROPOSED',
    shipmentDetails: {
      recipient: {
        displayName: shippingAddress.name,
        emailAddress: shippingAddress.email,
        phoneNumber: normalizePhoneE164(shippingAddress.phone),
        address: {
          addressLine1: shippingAddress.street1,
          addressLine2: shippingAddress.street2 || undefined,
          locality: shippingAddress.city,
          administrativeDistrictLevel1: shippingAddress.state,
          postalCode: shippingAddress.zip,
          country: 'US',
        },
      },
      expectedShippedAt: shipDate.toISOString(),
      shippingNote: shipmentNote,
    },
  };
}

export async function buildPickupFulfillment(
  pickupContact: PickupContact
): Promise<Fulfillment> {
  // Fetch live pickup location and calculate ready time concurrently
  const [pickupLocation, pickupTime] = await Promise.all([
    getPickupLocation(),
    nextPickupTime(new Date()),
  ]);

  // Build pickup note with location details and customer instructions
  let pickupNote = `Pick up at ${pickupLocation.name}. ${pickupLocation.instructions}`;
  if (pickupContact.notes?.trim()) {
    pickupNote += `\n\nCustomer Notes: ${pickupContact.notes.trim()}`;
  }

  return {
    type: 'PICKUP',
    state: 'PROPOSED',
    pickupDetails: {
      recipient: {
        displayName: pickupContact.name,
        emailAddress: pickupContact.email,
        phoneNumber: normalizePhoneE164(pickupContact.phone),
      },
      pickupAt: pickupTime.toISOString(),
      note: pickupNote,
    },
  };
}
