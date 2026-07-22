// src/lib/email/sender.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock resend before any imports that use it.
// sender.ts calls `new Resend(...)` inside getResend() on each send call,
// so we mock the constructor to control what emails.send returns.
vi.mock("resend", () => ({
  Resend: vi.fn(),
}));

// Mock shopHours — formatHoursForEmail is called inside sendOrderConfirmation
// for pickup orders and inside sendPickupReminderEmail.
vi.mock("@/lib/shopHours", () => ({
  formatHoursForEmail: vi.fn().mockResolvedValue("Mon–Sat 10am–6pm"),
}));

import { Resend } from "resend";
import {
  sendOrderConfirmation,
  sendBackInStockNotification,
} from "./sender";

const mockSend = vi.fn();

// Before each test, reset mocks and configure Resend constructor to return
// an object with the mocked emails.send function.
// NOTE: mockImplementation must use a regular function (not an arrow function)
// because sender.ts calls `new Resend(...)` — arrow functions are not constructors.
beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue({ data: { id: "test-email-id" }, error: null });
  (Resend as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
    return { emails: { send: mockSend } };
  });
  process.env.EMAIL_FROM = "noreply@elcaminoskateshop.com";
  process.env.RESEND_API_KEY = "test-key";
  process.env.TYLER_EMAIL = "tyler@elcaminoskateshop.com";
});

const mockPickupOrder = {
  id: "ORDER123456789012",
  totalMoney: { amount: 1999n, currency: "USD" },
  lineItems: [],
} as any;

const mockPickupContact = {
  name: "Test User",
  email: "test@example.com",
  fulfillmentMethod: "pickup" as const,
  phone: "",
  notes: "",
} as any;

const mockShippingContact = {
  name: "Test User",
  email: "test@example.com",
  fulfillmentMethod: "shipping" as const,
  phone: "",
  notes: "",
} as any;

describe("sendOrderConfirmation", () => {
  it("calls Resend emails.send with the correct recipient email", async () => {
    await sendOrderConfirmation({ order: mockPickupOrder, contact: mockPickupContact });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "test@example.com" })
    );
  });

  it("uses a pickup-specific subject for pickup orders", async () => {
    await sendOrderConfirmation({ order: mockPickupOrder, contact: mockPickupContact });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining("pickup") })
    );
  });

  it("uses a generic confirmed subject for shipping orders", async () => {
    await sendOrderConfirmation({ order: mockPickupOrder, contact: mockShippingContact });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Your El Camino order is confirmed" })
    );
  });

  it("throws when Resend returns an error object", async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: "API error", name: "validation_error" } });

    await expect(
      sendOrderConfirmation({ order: mockPickupOrder, contact: mockPickupContact })
    ).rejects.toThrow("Resend failed");
  });

  it("sends an HTML email (html field is a non-empty string)", async () => {
    await sendOrderConfirmation({ order: mockPickupOrder, contact: mockPickupContact });

    const callArg = mockSend.mock.calls[0][0];
    expect(typeof callArg.html).toBe("string");
    expect(callArg.html.length).toBeGreaterThan(0);
  });
});

describe("sendBackInStockNotification", () => {
  it("calls Resend emails.send with the subscriber email as the recipient", async () => {
    await sendBackInStockNotification({
      email: "subscriber@example.com",
      productName: "Test Deck",
      productUrl: "https://elcaminoskateshop.com/product/test-deck",
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "subscriber@example.com" })
    );
  });

  it("includes the product name in the subject line", async () => {
    await sendBackInStockNotification({
      email: "subscriber@example.com",
      productName: "Polar Bear Deck",
      productUrl: "https://elcaminoskateshop.com/product/polar-bear-deck",
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining("Polar Bear Deck") })
    );
  });

  it("throws when Resend returns an error", async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: "rate limited" } });

    await expect(
      sendBackInStockNotification({
        email: "subscriber@example.com",
        productName: "Test Deck",
        productUrl: "https://elcaminoskateshop.com/product/test-deck",
      })
    ).rejects.toThrow("Resend failed");
  });
});
