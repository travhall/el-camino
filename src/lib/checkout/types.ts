export interface ShippingAddress {
  name: string;
  email: string;
  phone: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  instructions?: string;
}

export interface PickupContact {
  name: string;
  email: string;
  phone: string;
  notes?: string;
}
