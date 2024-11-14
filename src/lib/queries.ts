// src/lib/queries.ts

export const GET_RECENT_ARTICLES = `
  query GetRecentArticles($limit: Int!) {
    articles(
      sort: "publishedAt:desc",
      pagination: { limit: $limit }
    ) {
      documentId
      title
      description
      slug
      publishedAt
      cover {
        url
        alternativeText
      }
      author {
        name
        avatar {
          url
          alternativeText
        }
      }
      category {
        name
        slug
      }
    }
  }
`;

export const GET_ALL_ARTICLES = `
  query GetAllArticles(
    $page: Int!
    $pageSize: Int!
    $sort: [String]
    $filters: ArticleFiltersInput
  ) {
    articles(
      pagination: { page: $page, pageSize: $pageSize }
      sort: $sort
      filters: $filters
    ) {
      documentId
      title
      description
      slug
      publishedAt
      cover {
        url
        alternativeText
      }
      author {
        name
        avatar {
          url
          alternativeText
        }
      }
      category {
        name
        slug
      }
    }
  }
`;

export const GET_ARTICLE_BY_SLUG = `
  query GetArticle($slug: String!) {
    articles(filters: { slug: { eq: $slug } }) {
      documentId
      title
      description
      slug
      publishedAt
      cover {
        url
        alternativeText
      }
      author {
        name
        avatar {
          url
          alternativeText
        }
      }
      category {
        name
        slug
      }
      blocks {
        __typename
        ... on ComponentSharedRichText {
          id
          body
        }
        ... on ComponentSharedMedia {
          id
          file {
            url
            alternativeText
          }
        }
        ... on ComponentSharedQuote {
          id
          title
          body
        }
        ... on ComponentSharedSlider {
          id
          files {
            url
            alternativeText
          }
        }
      }
    }
  }
`;