// src/lib/wordpress/api.ts
import type { WordPressPost } from "../types/wordpress";

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
    console.log("WordPress API Response:", data);
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
