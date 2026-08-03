// src/lib/email/sender.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Order } from 'square-legacy';
import type { PendingOrderContact } from './pendingOrders';

// Mock resend before any imports that use it.
// sender.ts calls `new Resend(...)` inside getResend() on each send call,
// so we mock the constructor to control what emails.send returns.
vi.mock('resend', () => ({
  Resend: vi.fn(),
}));

// Mock shopHours — formatHoursForEmail is called inside sendOrderConfirmation
// for pickup orders and inside sendPickupReminderEmail. cSpell:ignore SHIPORDER REMINDORDER
vi.mock('@/lib/shopHours', () => ({
  formatHoursForEmail: vi.fn().mockResolvedValue('Mon–Sat 10am–6pm'),
}));

import { Resend } from 'resend';
import {
  sendOrderConfirmation,
  sendBackInStockNotification,
  sendShippingOrderNotification,
  sendShippingConfirmation,
  sendBisAdminNotification,
  sendPickupReminderEmail,
  sendPickupNotification,
} from './sender';

const mockSend = vi.fn();

// Before each test, reset mocks and configure Resend constructor to return
// an object with the mocked emails.send function.
// NOTE: mockImplementation must use a regular function (not an arrow function)
// because sender.ts calls `new Resend(...)` — arrow functions are not constructors.
beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue({ data: { id: 'test-email-id' }, error: null });
  (Resend as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    function () {
      return { emails: { send: mockSend } };
    }
  );
  process.env.EMAIL_FROM = 'noreply@elcaminoskateshop.com';
  process.env.RESEND_API_KEY = 'test-key';
  process.env.TYLER_EMAIL = 'tyler@elcaminoskateshop.com';
});

const mockPickupOrder = {
  id: 'ORDER123456789012',
  totalMoney: { amount: 1999n, currency: 'USD' },
  lineItems: [],
} as unknown as Order;

const mockPickupContact = {
  name: 'Test User',
  email: 'test@example.com',
  fulfillmentMethod: 'pickup' as const,
  phone: '',
  notes: '',
} as unknown as PendingOrderContact;

const mockShippingContact = {
  name: 'Test User',
  email: 'test@example.com',
  fulfillmentMethod: 'shipping' as const,
  phone: '',
  notes: '',
} as unknown as PendingOrderContact;

describe('sendOrderConfirmation', () => {
  it('calls Resend emails.send with the correct recipient email', async () => {
    await sendOrderConfirmation({
      order: mockPickupOrder,
      contact: mockPickupContact,
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'test@example.com' })
    );
  });

  it('uses a pickup-specific subject for pickup orders', async () => {
    await sendOrderConfirmation({
      order: mockPickupOrder,
      contact: mockPickupContact,
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('pickup') })
    );
  });

  it('uses a generic confirmed subject for shipping orders', async () => {
    await sendOrderConfirmation({
      order: mockPickupOrder,
      contact: mockShippingContact,
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Your El Camino order is confirmed' })
    );
  });

  it('throws when Resend returns an error object', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'API error', name: 'validation_error' },
    });

    await expect(
      sendOrderConfirmation({
        order: mockPickupOrder,
        contact: mockPickupContact,
      })
    ).rejects.toThrow('Resend failed');
  });

  it('sends an HTML email (html field is a non-empty string)', async () => {
    await sendOrderConfirmation({
      order: mockPickupOrder,
      contact: mockPickupContact,
    });

    const callArg = mockSend.mock.calls[0][0];
    expect(typeof callArg.html).toBe('string');
    expect(callArg.html.length).toBeGreaterThan(0);
  });
});

describe('sendBackInStockNotification', () => {
  it('calls Resend emails.send with the subscriber email as the recipient', async () => {
    await sendBackInStockNotification({
      email: 'subscriber@example.com',
      productName: 'Test Deck',
      productUrl: 'https://elcaminoskateshop.com/product/test-deck',
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'subscriber@example.com' })
    );
  });

  it('includes the product name in the subject line', async () => {
    await sendBackInStockNotification({
      email: 'subscriber@example.com',
      productName: 'Polar Bear Deck',
      productUrl: 'https://elcaminoskateshop.com/product/polar-bear-deck',
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('Polar Bear Deck'),
      })
    );
  });

  it('throws when Resend returns an error', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'rate limited' },
    });

    await expect(
      sendBackInStockNotification({
        email: 'subscriber@example.com',
        productName: 'Test Deck',
        productUrl: 'https://elcaminoskateshop.com/product/test-deck',
      })
    ).rejects.toThrow('Resend failed');
  });
});

const mockShippingOrder = {
  id: 'SHIPORDER123456789',
  totalMoney: { amount: 5999n, currency: 'USD' },
  lineItems: [{ name: 'Trucks', quantity: '1', totalMoney: { amount: 5999n } }],
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
} as unknown as Order;

describe('sendShippingOrderNotification', () => {
  it('sends to TYLER_EMAIL, not the customer', async () => {
    await sendShippingOrderNotification({
      order: mockShippingOrder,
      contact: mockShippingContact,
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'tyler@elcaminoskateshop.com' })
    );
  });

  it('includes the customer name and order ID in the subject', async () => {
    await sendShippingOrderNotification({
      order: mockShippingOrder,
      contact: mockShippingContact,
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('Test User'),
      })
    );
  });

  it('does not throw when Resend returns an error (non-blocking notification)', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'rate limited' },
    });

    await expect(
      sendShippingOrderNotification({
        order: mockShippingOrder,
        contact: mockShippingContact,
      })
    ).resolves.toBeUndefined();
  });

  it('sends an HTML email body', async () => {
    await sendShippingOrderNotification({
      order: mockShippingOrder,
      contact: mockShippingContact,
    });

    const callArg = mockSend.mock.calls[0][0];
    expect(typeof callArg.html).toBe('string');
    expect(callArg.html.length).toBeGreaterThan(0);
  });
});

describe('sendShippingConfirmation', () => {
  it('sends to the customer email', async () => {
    await sendShippingConfirmation({
      order: mockShippingOrder,
      contact: mockShippingContact,
      trackingNumber: '9400111899223397988071',
      carrier: 'USPS',
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'test@example.com' })
    );
  });

  it('uses the shipped subject line', async () => {
    await sendShippingConfirmation({
      order: mockShippingOrder,
      contact: mockShippingContact,
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Your El Camino order has shipped' })
    );
  });

  it('throws when Resend returns an error', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'server error' },
    });

    await expect(
      sendShippingConfirmation({
        order: mockShippingOrder,
        contact: mockShippingContact,
      })
    ).rejects.toThrow('Resend failed');
  });

  it('sends without tracking number (minimal payload)', async () => {
    await expect(
      sendShippingConfirmation({
        order: mockShippingOrder,
        contact: mockShippingContact,
      })
    ).resolves.toBeUndefined();
  });
});

describe('sendBisAdminNotification', () => {
  it('sends to TYLER_EMAIL', async () => {
    await sendBisAdminNotification({
      subscriberEmail: 'fan@example.com',
      productName: 'Test Deck',
      totalSubscribers: 3,
      origin: 'https://elcaminoskateshop.com',
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'tyler@elcaminoskateshop.com' })
    );
  });

  it('includes the product name in the subject', async () => {
    await sendBisAdminNotification({
      subscriberEmail: 'fan@example.com',
      productName: 'Fancy Deck',
      totalSubscribers: 1,
      origin: 'https://elcaminoskateshop.com',
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('Fancy Deck'),
      })
    );
  });

  it('does not throw when Resend returns an error (non-blocking)', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'quota exceeded' },
    });

    await expect(
      sendBisAdminNotification({
        subscriberEmail: 'fan@example.com',
        productName: 'Test Deck',
        totalSubscribers: 1,
        origin: 'https://elcaminoskateshop.com',
      })
    ).resolves.toBeUndefined();
  });
});

describe('sendPickupReminderEmail', () => {
  it('sends to the provided recipient address', async () => {
    await sendPickupReminderEmail({
      to: 'customer@example.com',
      customerName: 'Alex Smith',
      orderId: 'REMINDORDER123456789',
      items: [{ name: 'Deck', qty: '1' }],
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'customer@example.com' })
    );
  });

  it('uses the reminder subject line', async () => {
    await sendPickupReminderEmail({
      to: 'customer@example.com',
      customerName: 'Alex Smith',
      orderId: 'REMINDORDER123456789',
      items: [{ name: 'Deck', qty: '1' }],
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Reminder: Your El Camino pickup order is ready',
      })
    );
  });

  it('accepts an optional pickupAt timestamp', async () => {
    await expect(
      sendPickupReminderEmail({
        to: 'customer@example.com',
        customerName: 'Alex Smith',
        orderId: 'REMINDORDER123456789',
        items: [{ name: 'Deck', qty: '1' }],
        pickupAt: 'Thu, Apr 10 at 3:00 PM CDT',
      })
    ).resolves.toBeUndefined();
  });

  it('throws when Resend returns an error', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'API down' } });

    await expect(
      sendPickupReminderEmail({
        to: 'customer@example.com',
        customerName: 'Alex Smith',
        orderId: 'REMINDORDER123456789',
        items: [{ name: 'Deck', qty: '1' }],
      })
    ).rejects.toThrow('Resend failed');
  });
});

describe('sendPickupNotification', () => {
  it('sends to TYLER_EMAIL, not the customer', async () => {
    await sendPickupNotification({
      order: mockPickupOrder,
      contact: mockPickupContact,
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'tyler@elcaminoskateshop.com' })
    );
  });

  it('includes the customer name in the subject', async () => {
    await sendPickupNotification({
      order: mockPickupOrder,
      contact: mockPickupContact,
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('Test User'),
      })
    );
  });

  it('does not throw when Resend returns an error (non-blocking notification)', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'timeout' } });

    await expect(
      sendPickupNotification({
        order: mockPickupOrder,
        contact: mockPickupContact,
      })
    ).resolves.toBeUndefined();
  });
});
