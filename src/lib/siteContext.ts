// Per-request cache + parallel fetch for the "always-needed" site config that
// Layout/Footer/Nav each used to fetch independently. Without this, every
// page render did 6+ serial Netlify Blobs reads (with `getContactInfo` and
// `getSocialLinks` called twice — once in Footer, once in Nav).
//
// Usage from any .astro frontmatter:
//
//   import { getSiteContext } from "@/lib/siteContext";
//   const ctx = await getSiteContext(Astro.locals);
//   // ctx.contact, ctx.social, ctx.hours, ctx.structured, ctx.salePageVisible
//
// Memoization is on `Astro.locals`, which Astro resets per request, so we
// avoid the staleness traps of module-level caches on warm function instances.

import { getContactInfo, type ContactInfo } from "@/lib/contactInfo";
import { getSocialLinks } from "@/lib/socialLinks";
import { getShopHours } from "@/lib/shopHours";
import { getStructuredData } from "@/lib/structuredData";
import { getSalePageVisible } from "@/lib/saleVisibility";

export interface SiteContext {
  contact: ContactInfo;
  social: Awaited<ReturnType<typeof getSocialLinks>>;
  hours: Awaited<ReturnType<typeof getShopHours>>;
  structured: Awaited<ReturnType<typeof getStructuredData>>;
  salePageVisible: boolean;
}

interface MemoLocals {
  /** Resolved bundle if the request has already hydrated it. */
  siteContext?: SiteContext;
  /** In-flight promise so concurrent callers in the same request share work. */
  siteContextPromise?: Promise<SiteContext>;
}

export async function getSiteContext(locals: App.Locals): Promise<SiteContext> {
  const memo = locals as MemoLocals;
  if (memo.siteContext) return memo.siteContext;
  if (memo.siteContextPromise) return memo.siteContextPromise;

  memo.siteContextPromise = (async () => {
    const [contact, social, hours, structured, salePageVisible] =
      await Promise.all([
        getContactInfo(),
        getSocialLinks(),
        getShopHours(),
        getStructuredData(),
        getSalePageVisible(),
      ]);
    const ctx: SiteContext = {
      contact,
      social,
      hours,
      structured,
      salePageVisible,
    };
    memo.siteContext = ctx;
    return ctx;
  })();

  return memo.siteContextPromise;
}
