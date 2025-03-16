// src/lib/site-config.ts
export interface SocialLink {
  platform: string;
  url: string;
  icon: string;
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
      number: "+15346261991",
      display: "(534) 626-1991",
    },
    email: "elcaminoboardshop@gmail.com",
  },
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
    // {
    //   platform: "youtube",
    //   url: "https://www.youtube.com/watch?v=9wx1kwv_qlc",
    //   icon: "uil:youtube",
    // },
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
