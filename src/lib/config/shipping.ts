/**
 * Centralized shipping configuration
 * Update rates here without touching API logic
 */

import { siteConfig } from "../site-config";

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

// Build pickup location from site config
export const PICKUP_LOCATION: PickupLocation = {
  id: "main-store",
  name: siteConfig.name,
  address: {
    street1: siteConfig.contact.address.street,
    city: siteConfig.contact.address.city,
    state: siteConfig.contact.address.state,
    zip: siteConfig.contact.address.zip,
  },
  phone: siteConfig.contact.phone.display,
  hours: Object.fromEntries(siteConfig.hours.map((h) => [h.day, h.hours])),
  instructions: "Pickup only available during store hours.",
};

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

/**
 * Get available fulfillment methods
 */
export function getAvailableFulfillmentMethods() {
  return {
    shipping: SHIPPING_RATES,
    pickup: PICKUP_LOCATION,
  };
}
