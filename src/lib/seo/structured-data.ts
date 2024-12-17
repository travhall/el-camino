export interface Organization {
  name: string;
  logo: string;
  address: string;
}

export function generateWebPageSchema(page: { title: string; seo?: { description?: string } }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.title,
    description: page.seo?.description
  };
}

export function generateOrganizationSchema(org: Organization) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: org.name,
    logo: org.logo,
    address: {
      '@type': 'PostalAddress',
      streetAddress: org.address
    }
  };
}