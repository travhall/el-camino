// src/lib/contactInfo.ts
// Netlify Blobs-backed contact info with siteConfig fallback.

import { getStore } from "@netlify/blobs";
import { siteConfig } from "@/lib/site-config";

export interface ContactInfo {
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string;       // display format, e.g. "(715) 912-1169"
  phoneRaw: string;    // tel: format, e.g. "+7159121169"
  email: string;
}

const STORE = "shop-config";
const KEY = "contact-info";

function seed(): ContactInfo {
  const { contact, name } = siteConfig;
  return {
    name,
    street: contact.address.street,
    city: contact.address.city,
    state: contact.address.state,
    zip: contact.address.zip,
    phone: contact.phone.display,
    phoneRaw: contact.phone.number,
    email: contact.email,
  };
}

export async function getContactInfo(): Promise<ContactInfo> {
  try {
    const store = getStore(STORE);
    const data = await store.get(KEY, { type: "json" });
    if (data) return data as ContactInfo;
  } catch {
    // Blobs unavailable (local dev without env vars)
  }
  return seed();
}

export async function saveContactInfo(info: ContactInfo): Promise<void> {
  const store = getStore(STORE);
  await store.setJSON(KEY, info);
}
