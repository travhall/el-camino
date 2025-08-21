// src/lib/site-config.ts
export interface SocialLink {
  platform: string;
  url: string;
  icon: string;
}

export interface BusinessHours {
  day: string;
  hours: string;
  isOpen: boolean;
}

export interface SiteConfig {
  name: string;
  description: string;
  url: string;
  logo: string;
  contact: {
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
      display: string;
    };
    phone: {
      number: string;
      display: string;
    };
    email: string;
  };
  hours: BusinessHours[];
  social: SocialLink[];
  tagline: string;
  seo: {
    defaultTitle: string;
    defaultDescription: string;
    defaultImage: string;
  };
}

export const siteConfig: SiteConfig = {
  name: "El Camino Skate Shop",
  description:
    "El Camino Skate Shop is a skater owned and operated skateboard shop, located in Eau Claire, WI",
  url: "https://elcaminoskateshop.com",
  logo: "/logo.png",
  contact: {
    address: {
      street: "310 Water Street",
      city: "Eau Claire",
      state: "WI",
      zip: "54703",
      display: "310 Water Street, Eau Claire, WI 54703",
    },
    phone: {
      number: "+7159121169",
      display: "(715) 912-1169",
    },
    email: "elcaminoboardshop@gmail.com",
  },
  hours: [
    { day: "Monday", hours: "Closed", isOpen: false },
    { day: "Tuesday", hours: "Closed", isOpen: false },
    { day: "Wednesday", hours: "11am - 7pm", isOpen: true },
    { day: "Thursday", hours: "11am - 7pm", isOpen: true },
    { day: "Friday", hours: "11am - 7pm", isOpen: true },
    { day: "Saturday", hours: "11am - 7pm", isOpen: true },
    { day: "Sunday", hours: "11am - 5pm", isOpen: true },
  ],
  social: [
    {
      platform: "facebook",
      url: "https://www.facebook.com/people/El-Camino-Skateshop/61553258934455/",
      icon: "uil:facebook",
    },
    {
      platform: "instagram",
      url: "https://www.instagram.com/elcaminoskateshop/",
      icon: "uil:instagram",
    },
  ],
  tagline: "100% Skater Owned, 100% Skater Operated",
  seo: {
    defaultTitle: "El Camino Skate Shop",
    defaultDescription:
      "El Camino Skate Shop is a skater owned and operated skateboard shop, located in Eau Claire, WI",
    defaultImage: "/default-og-image.jpg",
  },
};

// Utility functions
export function getSocialLinks() {
  return siteConfig.social;
}

export function getContactInfo() {
  return siteConfig.contact;
}

export function getBusinessHours() {
  return siteConfig.hours;
}

export function getSEODefaults() {
  return siteConfig.seo;
}

export function getStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": siteConfig.url,
    name: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    logo: `${siteConfig.url}${siteConfig.logo}`,
    image: `${siteConfig.url}${siteConfig.seo.defaultImage}`,
    telephone: siteConfig.contact.phone.number,
    email: siteConfig.contact.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.contact.address.street,
      addressLocality: siteConfig.contact.address.city,
      addressRegion: siteConfig.contact.address.state,
      postalCode: siteConfig.contact.address.zip,
      addressCountry: "US",
    },
    openingHoursSpecification: siteConfig.hours.map((day) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: day.day,
      opens: day.isOpen ? day.hours.split(" - ")[0] : undefined,
      closes: day.isOpen ? day.hours.split(" - ")[1] : undefined,
    })),
    sameAs: siteConfig.social.map((social) => social.url),
  };
}

export const apiConfig = {
  wordpress: {
    baseUrl:
      import.meta.env.PUBLIC_WORDPRESS_API_URL ||
      "https://api.elcaminoskateshop.com/wp-json/wp/v2",
    requestTimeout: 5000, // milliseconds
    cacheTTL: 600, // seconds
  },
  square: {
    cacheTTL: 300, // seconds
    batchSize: 20, // items per request
  },
};
