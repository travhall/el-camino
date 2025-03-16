import type { APIRoute } from "astro";
import crypto from "crypto";

const SQUARE_SIGNATURE_KEY = import.meta.env.SQUARE_WEBHOOK_SIGNATURE_KEY;

function verifySquareSignature(signature: string, body: string): boolean {
  if (!SQUARE_SIGNATURE_KEY) {
    console.error("Square webhook signature key not configured");
    return false;
  }

  const hmac = crypto.createHmac("sha256", SQUARE_SIGNATURE_KEY);
  const expectedSignature = hmac.update(body).digest("base64");

  // Convert both to Uint8Array for comparison
  const signatureBuffer = Uint8Array.from(Buffer.from(signature));
  const expectedBuffer = Uint8Array.from(Buffer.from(expectedSignature));

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const signature = request.headers.get("x-square-signature");
    if (!signature) {
      return new Response("No signature provided", { status: 401 });
    }

    const body = await request.text();
    if (!verifySquareSignature(signature, body)) {
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(body);
    // console.log('Received Square webhook:', event.type);

    switch (event.type) {
      case "payment.created":
        await handlePaymentCreated(event.data);
        break;

      case "order.updated":
        await handleOrderUpdated(event.data);
        break;

      case "checkout.completed":
        await handleCheckoutCompleted(event.data);
        break;

      default:
        console.log("Unhandled webhook event type:", event.type);
    }

    return new Response("Webhook processed", { status: 200 });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Webhook processing failed",
      }),
      { status: 500 }
    );
  }
};

async function handlePaymentCreated(data: any) {
  // Implement payment handling logic
  console.log("Payment created:", data);
}

async function handleOrderUpdated(data: any) {
  // Implement order update logic
  console.log("Order updated:", data);
}

async function handleCheckoutCompleted(data: any) {
  // Implement checkout completion logic
  console.log("Checkout completed:", data);
}
