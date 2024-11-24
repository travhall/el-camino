import { C as Client, E as Environment } from './client_CZE72IHa.mjs';

const squareClient = new Client({
  accessToken: "EAAAlzHv_3yNKWX5wofmfLHp_Pj4cSiIg2V84OcUTrXL6Lh5kbcMG0ZiINJJsy_a",
  environment: Environment.Sandbox,
  squareVersion: "2024-02-28"
});
class CartManager {
  static instance;
  items;
  storage;
  initialized;
  constructor() {
    this.items = /* @__PURE__ */ new Map();
    this.storage = null;
    this.initialized = false;
    if (typeof window !== "undefined") {
      setTimeout(() => this.init(), 0);
    }
  }
  init() {
    if (this.initialized) return;
    this.storage = window.localStorage;
    this.loadCart();
    this.initialized = true;
    this.dispatchCartEvent("cartUpdated");
  }
  static getInstance() {
    if (!CartManager.instance) {
      CartManager.instance = new CartManager();
    }
    return CartManager.instance;
  }
  loadCart() {
    if (!this.storage) return;
    try {
      const savedCart = this.storage.getItem("cart");
      if (savedCart) {
        const items = JSON.parse(savedCart);
        this.items.clear();
        items.forEach((item) => {
          this.items.set(item.id, item);
        });
      }
    } catch (error) {
      console.error("Error loading cart:", error);
    }
  }
  saveCart() {
    if (!this.storage) return;
    try {
      const items = Array.from(this.items.values());
      this.storage.setItem("cart", JSON.stringify(items));
      this.dispatchCartEvent("cartUpdated", { cartState: this.getState() });
    } catch (error) {
      console.error("Error saving cart:", error);
    }
  }
  dispatchCartEvent(type, detail) {
    if (typeof window === "undefined") return;
    const event = new CustomEvent(type, {
      detail,
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(event);
  }
  getState() {
    return {
      items: this.getItems(),
      total: this.getTotal(),
      itemCount: this.getItemCount()
    };
  }
  async createOrder() {
    try {
      const lineItems = Array.from(this.items.values()).map((item) => ({
        quantity: item.quantity.toString(),
        catalogObjectId: item.catalogObjectId,
        itemType: "ITEM"
      }));
      const orderRequest = {
        idempotencyKey: crypto.randomUUID(),
        order: {
          lineItems,
          locationId: "LVWBXJV5V30WD"
        }
      };
      const response = await squareClient.ordersApi.createOrder(orderRequest);
      if (!response.result.order?.id) {
        throw new Error("Failed to create order: No order ID returned");
      }
      return response.result.order.id;
    } catch (error) {
      console.error("Error creating order:", error);
      throw error;
    }
  }
  addItem(item) {
    if (!this.initialized) {
      this.init();
    }
    const existingItem = this.items.get(item.id);
    if (existingItem) {
      existingItem.quantity += item.quantity;
      this.items.set(item.id, existingItem);
    } else {
      this.items.set(item.id, item);
    }
    this.dispatchCartEvent("itemAdded", { item });
    this.saveCart();
  }
  removeItem(id) {
    const item = this.items.get(id);
    if (item) {
      this.items.delete(id);
      this.dispatchCartEvent("itemRemoved", { item });
      this.saveCart();
    }
  }
  updateQuantity(id, quantity) {
    const item = this.items.get(id);
    if (item) {
      item.quantity = quantity;
      this.items.set(id, item);
      this.saveCart();
    }
  }
  getItems() {
    return Array.from(this.items.values());
  }
  getTotal() {
    return Array.from(this.items.values()).reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
  }
  getItemCount() {
    return Array.from(this.items.values()).reduce(
      (total, item) => total + item.quantity,
      0
    );
  }
  clear() {
    this.items.clear();
    this.dispatchCartEvent("cartCleared");
    this.saveCart();
  }
  forceRefresh() {
    this.loadCart();
    this.dispatchCartEvent("cartUpdated", { cartState: this.getState() });
  }
}
const cart = CartManager.getInstance();

export { cart as c };
