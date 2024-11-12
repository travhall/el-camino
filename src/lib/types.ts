export interface CartItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
}

export interface PaymentResult {
  success: boolean;
  error?: string;
  payment?: any;
  orderId?: string;
}

export interface CheckoutFormData {
  email: string;
  name: string;
  phone?: string;
}