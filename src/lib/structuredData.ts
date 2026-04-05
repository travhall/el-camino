// src/lib/structuredData.ts
// Async version of getStructuredData that pulls from Netlify Blobs-backed
// lib functions so admin changes sync to schema.org SEO data.
// Lives in its own file to avoid circular imports with site-config.ts.

import { siteConfig } from "./site-config";
import { getContactInfo } from "./contactInfo";
import { getSocialLinks } from "./socialLinks";
import { getShopHours } from "./shopHours";

export async function getStructuredData(): Promise<object> {
  const [contact, social, hours] = await Promise.all([
    getContactInfo(),
    getSocialLinks(),
    getShopHours(),
  ]);

  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": siteConfig.url,
    name: contact.name,
    description: siteConfig.description,
    url: siteConfig.url,
    logo: `${siteConfig.url}${siteConfig.logo}`,
    image: `${siteConfig.url}${siteConfig.seo.defaultImage}`,
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
    openingHoursSpecification: hours.map((day) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: day.day,
      opens: day.isOpen ? day.hours.split(" - ")[0] : undefined,
      closes: day.isOpen ? day.hours.split(" - ")[1] : undefined,
    })),
    sameAs: social.map((s) => s.url),
  };
}
