// src/lib/events.ts
// Cross-component CustomEvent names — use these constants at all dispatch and listen sites.
export const EVENTS = {
  SHOW_NOTIFICATION: "elco:show-notification",
  SHOW_POLICY_MODAL: "elco:show-policy-modal",
  SHOW_LOCATION_MODAL: "elco:show-location-modal",
  SHOW_SECURE_CHECKOUT_MODAL: "elco:show-secure-checkout-modal",
} as const;

// Payload types
export type NotificationActionDetail =
  | { label: string; href: string }
  | { label: string; onClick: () => void };

export interface ShowNotificationDetail {
  message: string;
  type?: "success" | "error";
  duration?: number;
  action?: NotificationActionDetail;
}
export interface ShowPolicyModalDetail {
  slug: string;
}
// showLocationModal and showSecureCheckoutModal have no payload

// Convenience dispatchers — every call site should use these instead of
// constructing `new CustomEvent(...)` by hand, so the detail shape can only
// drift in one place.
export function showNotification(
  message: string,
  type?: ShowNotificationDetail["type"],
  duration?: number,
  action?: NotificationActionDetail,
): void {
  document.dispatchEvent(
    new CustomEvent<ShowNotificationDetail>(EVENTS.SHOW_NOTIFICATION, {
      detail: { message, type, duration, action },
    }),
  );
}

export function showPolicyModal(slug: string): void {
  document.dispatchEvent(
    new CustomEvent<ShowPolicyModalDetail>(EVENTS.SHOW_POLICY_MODAL, { detail: { slug } }),
  );
}

export function showLocationModal(): void {
  document.dispatchEvent(new CustomEvent(EVENTS.SHOW_LOCATION_MODAL));
}

export function showSecureCheckoutModal(): void {
  document.dispatchEvent(new CustomEvent(EVENTS.SHOW_SECURE_CHECKOUT_MODAL));
}
