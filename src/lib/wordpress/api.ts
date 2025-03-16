// src/lib/wordpress/api.ts
import type { WordPressPage, WordPressPost } from "../types/wordpress";

const WP_URL =
  "https://public-api.wordpress.com/rest/v1.1/sites/elcaminoskateshop.wordpress.com";

export async function getPosts(): Promise<WordPressPost[]> {
  try {
    const response = await fetch(
      `${WP_URL}/posts?fields=ID,title,date,excerpt,content,slug,featured_image`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    // console.log("WordPress API Response:", data);
    return data.posts.map((post: any) => ({
      id: post.ID,
      date: post.date,
      slug: post.slug,
      title: { rendered: post.title },
      excerpt: { rendered: post.excerpt },
      content: { rendered: post.content },
      _embedded: post.featured_image
        ? {
            "wp:featuredmedia": [
              {
                source_url: post.featured_image,
                alt_text: post.title,
              },
            ],
          }
        : undefined,
    }));
  } catch (error) {
    console.error("Error fetching posts:", error);
    throw error;
  }
}

export async function getPost(slug: string): Promise<WordPressPost> {
  try {
    const response = await fetch(
      `${WP_URL}/posts/slug:${slug}?fields=ID,title,date,excerpt,content,slug,featured_image`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const post = await response.json();

    return {
      id: post.ID,
      date: post.date,
      slug: post.slug,
      title: { rendered: post.title },
      excerpt: { rendered: post.excerpt },
      content: { rendered: post.content },
      _embedded: post.featured_image
        ? {
            "wp:featuredmedia": [
              {
                source_url: post.featured_image,
                alt_text: post.title,
              },
            ],
          }
        : undefined,
    };
  } catch (error) {
    console.error("Error fetching post:", error);
    throw error;
  }
}

export async function getPages(): Promise<WordPressPage[]> {
  try {
    // Add logging for debugging
    console.log("Fetching WordPress pages...");

    const response = await fetch(
      `${WP_URL}/posts?type=page&fields=ID,title,date,content,slug,featured_image`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Log API response for debugging
    console.log(`WordPress API returned ${data.posts?.length || 0} pages`);

    if (!data.posts || !Array.isArray(data.posts) || data.posts.length === 0) {
      console.warn("No pages found in WordPress API response");
      return [];
    }

    // Sample the first page for debugging
    if (data.posts.length > 0) {
      console.log("Sample page data:", {
        id: data.posts[0].ID,
        slug: data.posts[0].slug,
        title: data.posts[0].title,
      });
    }

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

// Function to get footer pages specifically
export async function getFooterPages(): Promise<WordPressPage[]> {
  try {
    console.log("Fetching footer pages...");

    // Define which pages should be in the footer
    const footerPageSlugs = [
      "privacy-policy",
      "return-policy",
      "shipping-policy",
      "terms-and-conditions",
    ];

    const allPages = await getPages();
    // console.log(
    //   `Filtering ${allPages.length} pages for footer pages with slugs:`,
    //   footerPageSlugs
    // );

    const footerPages = allPages.filter((page) =>
      footerPageSlugs.includes(page.slug)
    );
    console.log(`Found ${footerPages.length} footer pages`);

    return footerPages;
  } catch (error) {
    console.error("Error fetching footer pages:", error);
    return [];
  }
}
