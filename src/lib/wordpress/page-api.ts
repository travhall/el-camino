// src/lib/wordpress/page-api.ts
import type { WordPressPage } from "../wordpress/types";

const WP_URL =
  "https://public-api.wordpress.com/rest/v1.1/sites/elcaminoskateshop.wordpress.com";

// Get all pages from WordPress
export async function getAllPages(): Promise<WordPressPage[]> {
  try {
    const response = await fetch(
      `${WP_URL}/posts?type=page&fields=ID,title,date,content,slug,featured_image`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.posts.map((page: any) => ({
      id: page.ID,
      date: page.date,
      slug: page.slug,
      title: { rendered: page.title },
      content: { rendered: page.content },
      _embedded: page.featured_image
        ? {
            "wp:featuredmedia": [
              {
                source_url: page.featured_image,
                alt_text: page.title,
              },
            ],
          }
        : undefined,
    }));
  } catch (error) {
    console.error("Error fetching pages:", error);
    return [];
  }
}

// Get footer pages based on a predefined list of slugs
export async function getFooterPages(): Promise<WordPressPage[]> {
  try {
    // Define which pages should be in the footer
    // Update these slugs to match your actual WordPress pages
    const footerPageSlugs = [
      "privacy-policy",
      "terms-of-service",
      "about",
      "contact",
    ];

    const allPages = await getAllPages();
    return allPages.filter((page) => footerPageSlugs.includes(page.slug));
  } catch (error) {
    console.error("Error fetching footer pages:", error);
    return [];
  }
}

// Get navigation pages based on a different predefined list of slugs (if needed)
export async function getNavPages(): Promise<WordPressPage[]> {
  try {
    // Define which pages should be in the main navigation
    // Update these slugs to match your actual WordPress pages
    const navPageSlugs = ["about", "products", "blog", "contact"];

    const allPages = await getAllPages();
    return allPages.filter((page) => navPageSlugs.includes(page.slug));
  } catch (error) {
    console.error("Error fetching navigation pages:", error);
    return [];
  }
}
