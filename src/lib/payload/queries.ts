// src/lib/payload/queries.ts

// Note: Using the existing content system tokens for styling

export const BLOG_LIST_QUERY = `
  query BlogPosts($limit: Int, $page: Int) {
    Posts(limit: $limit, page: $page, where: { status: { equals: "published" } }) {
      docs {
        id
        title
        slug
        excerpt
        featuredImage {
          url
          alt
        }
        category {
          name
          slug
        }
        author {
          name
        }
        publishedDate
      }
      totalDocs
      page
      totalPages
    }
  }
`

export const BLOG_POST_QUERY = `
  query BlogPost($slug: String) {
    Posts(where: { slug: { equals: $slug } }) {
      docs {
        id
        title
        slug
        featuredImage {
          url
          alt
        }
        excerpt
        content
        category {
          name
          slug
        }
        tags {
          name
          slug
        }
        author {
          name
        }
        publishedDate
        seo {
          title
          description
          image {
            url
          }
        }
      }
    }
  }
`

export const BLOG_CATEGORIES_QUERY = `
  query BlogCategories {
    Categories {
      docs {
        id
        name
        slug
        description
      }
    }
  }
`

export async function getBlogPostsByTag(tag: string) {
  const response = await fetch(`${import.meta.env.PUBLIC_PAYLOAD_URL}/api/blog-posts?where[tags][in][]=${tag}&depth=2`);
  const data = await response.json();
  return data;
}

export async function getBlogTags() {
  const response = await fetch(`${import.meta.env.PUBLIC_PAYLOAD_URL}/api/blog-tags?limit=100`);
  const data = await response.json();
  return data.docs;
}