// src/lib/structuredData.ts
// Builds schema.org SEO data from already-resolved site config so admin
// changes sync to it without this module re-reading Netlify Blobs itself.
// Lives in its own file to avoid circular imports with site-config.ts.

import { siteConfig } from "./site-config";
import type { ContactInfo } from "./contactInfo";
import type { SocialLink } from "./socialLinks";
import type { HoursDisplayEntry } from "./shopHours";

export async function getStructuredData(
  contact: ContactInfo,
  social: SocialLink[],
  hours: HoursDisplayEntry[],
): Promise<object> {
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
