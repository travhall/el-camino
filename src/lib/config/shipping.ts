/**
 * Centralized shipping configuration
 * Update rates here without touching API logic
 */

import { getContactInfo } from "../contactInfo";

export interface ShippingRate {
  id: string;
  name: string;
  description: string;
  rate: number;
  estimatedDays: string;
  freeThreshold?: number;
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
 * Pickup location name and note, from live admin-managed contact data.
 */
export async function getPickupLocation(): Promise<{
  name: string;
  instructions: string;
}> {
  const contact = await getContactInfo();

  return {
    name: contact.name,
    instructions: "Pick up only available during store hours.",
  };
}

/**
 * Calculate shipping rate (in dollars) based on subtotal
 */
export function calculateShippingRate(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD_DOLLARS
    ? 0
    : FLAT_RATE_SHIPPING_DOLLARS;
}

