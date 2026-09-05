import { describe, it, expect, vi } from "vitest";

// getStructuredData must not touch Netlify Blobs — it takes its inputs as
// arguments now. If this mock's `get` is ever called, the regression this
// test guards against has come back.
const mockBlobStore = {
  get: vi.fn(),
  setJSON: vi.fn(),
};

vi.mock("@netlify/blobs", () => ({
  getStore: vi.fn(() => mockBlobStore),
}));

import { getStructuredData } from "../structuredData";
import type { ContactInfo } from "../contactInfo";
import type { SocialLink } from "../socialLinks";
import type { HoursDisplayEntry } from "../shopHours";

const contact: ContactInfo = {
  name: "El Camino",
  street: "123 Water St",
  city: "Eau Claire",
  state: "WI",
  zip: "54701",
  phone: "(715) 912-1169",
  phoneRaw: "+7159121169",
  email: "hello@elcaminoshop.com",
};

const social: SocialLink[] = [
  { platform: "instagram", url: "https://instagram.com/elcamino", icon: "uil:instagram" },
];

const hours: HoursDisplayEntry[] = [
  { day: "Monday", isOpen: false, hours: "Closed" },
  { day: "Wednesday", isOpen: true, hours: "11am - 7pm" },
];

describe("getStructuredData", () => {
  it("builds the schema from the given inputs without reading the blob store", async () => {
    const schema = await getStructuredData(contact, social, hours);

    expect(schema).toEqual({
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "@id": expect.any(String),
      name: contact.name,
      description: expect.any(String),
      url: expect.any(String),
      logo: expect.any(String),
      image: expect.any(String),
      telephone: contact.phoneRaw,
      email: contact.email,
      address: {
        "@type": "PostalAddress",
        streetAddress: contact.street,
        addressLocality: contact.city,
        addressRegion: contact.state,
        postalCode: contact.zip,
        addressCountry: "US",
      },
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: "Monday",
          opens: undefined,
          closes: undefined,
        },
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: "Wednesday",
          opens: "11am",
          closes: "7pm",
        },
      ],
      sameAs: ["https://instagram.com/elcamino"],
    });

    expect(mockBlobStore.get).not.toHaveBeenCalled();
  });
});
