import type { CartItem } from './types';

export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  const cart = localStorage.getItem('cart');
  return cart ? JSON.parse(cart) : [];
}

export function addToCart(item: any) {
  const cart = getCart();
  const existingItem = cart.find((i: any) => i.id === item.id);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ ...item, quantity: 1 });
  }
  localStorage.setItem('cart', JSON.stringify(cart));
}

export function removeFromCart(id: string) {
  const cart = getCart();
  const updatedCart = cart.filter((item: any) => item.id !== id);
  localStorage.setItem('cart', JSON.stringify(updatedCart));
}

export function updateQuantity(id: string, quantity: number) {
  const cart = getCart();
  const updatedCart = cart.map((item: any) =>
    item.id === id ? { ...item, quantity } : item
  );
  localStorage.setItem('cart', JSON.stringify(updatedCart));
}

export function clearCart() {
  localStorage.removeItem('cart');
}

export function getCartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}