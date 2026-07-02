/**
 * Centralized shipping configuration
 * Update rates here without touching API logic
 */

import { siteConfig } from "../site-config";
import { getContactInfo } from "../contactInfo";
import { getShopHoursRaw } from "../shopHours";

export interface ShippingRate {
  id: string;
  name: string;
  description: string;
  rate: number;
  estimatedDays: string;
  freeThreshold?: number;
}

export interface PickupLocation {
  id: string;
  name: string;
  address: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
  };
  phone: string;
  hours: {
    [day: string]: string;
  };
  instructions?: string;
}

export const SHIPPING_RATES: ShippingRate[] = [
  {
    id: "standard",
    name: "Standard Shipping",
    description: "5-7 business days",
    rate: 5.99,
    estimatedDays: "5-7",
  },
  {
    id: "free",
    name: "Free Standard Shipping",
    description: "5-7 business days",
    rate: 0,
    estimatedDays: "5-7",
    freeThreshold: 75.0,
  },
];

export const FREE_SHIPPING_THRESHOLD_DOLLARS =
  SHIPPING_RATES.find((r) => r.id === "free")!.freeThreshold!;
export const FLAT_RATE_SHIPPING_DOLLARS =
  SHIPPING_RATES.find((r) => r.id === "standard")!.rate;

/**
 * Build pickup location from live admin-managed contact and hours data.
 * Falls back to siteConfig values if Blobs are unavailable.
 */
export async function getPickupLocation(): Promise<PickupLocation> {
  const [contact, hoursData] = await Promise.all([
    getContactInfo(),
    getShopHoursRaw(),
  ]);

  return {
    id: "main-store",
    name: contact.name,
    address: {
      street1: contact.street,
      city: contact.city,
      state: contact.state,
      zip: contact.zip,
    },
    phone: contact.phone,
    hours: Object.fromEntries(
      hoursData.map((h) => [
        h.day,
        h.isOpen ? `${h.open} - ${h.close}` : "Closed",
      ])
    ),
    instructions: "Pick up only available during store hours.",
  };
}

/**
 * Calculate shipping rate based on subtotal
 */
export function calculateShippingRate(subtotal: number): ShippingRate {
  // Check for free shipping eligibility
  const freeShipping = SHIPPING_RATES.find(
    (rate) => rate.id === "free" && subtotal >= (rate.freeThreshold || 0)
  );

  if (freeShipping) {
    return freeShipping;
  }

  // Return standard rate
  return SHIPPING_RATES.find((rate) => rate.id === "standard")!;
}

