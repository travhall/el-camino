import type { CartItem } from './types';

interface CustomerInfo {
    name: string;
    email: string;
}

interface PaymentParams {
    card: SquareCard;
    sourceId: string;
    cartItems: CartItem[];
    locationId: string;
    customerInfo: CustomerInfo;
}

export async function loadSquareSDK(appId: string, locationId: string): Promise<SquarePayments> {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://sandbox.web.squarecdn.com/v1/square.js";
        script.onload = () => {
            if (!window.Square) {
                reject(new Error("Square.js failed to load properly"));
                return;
            }
            resolve(window.Square.payments(appId, locationId));
        };
        script.onerror = () => reject(new Error("Failed to load Square.js"));
        document.head.appendChild(script);
    });
}

export async function processPayment(params: PaymentParams) {
    const { sourceId, cartItems, locationId, customerInfo } = params;

    const response = await fetch("/api/process-payment", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            sourceId,
            cartItems,
            locationId,
            customerInfo,
        }),
    });

    if (!response.ok) {
        throw new Error("Payment request failed");
    }

    return response.json();
}