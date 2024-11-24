async function fetchGraphQL(query, variables = {}) {
  const url = `${"http://localhost:1337"}/graphql`;
  const token = "225f76fdf03a0482774af4438d1371956a2ac3e23008d6068d08a5ac408cc7f215063a1bc9c7d6abab3e7a009fc65ce0487e0d3f8c6527d40d8f12c0dc4b4f6b4391109a9161db5156796246c00b9f84fbbb3b70aa9f62daac7004ba1f9b7c3d2db49c4b50a6e9678b1a751e0a8c39df0e45177aa208fb5ef8f6b5bb916a0c62";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      query,
      variables
    })
  });
  const result = await response.json();
  if (result.errors) {
    console.error("GraphQL Errors:", result.errors);
    throw new Error(result.errors[0].message);
  }
  return result.data;
}

const GET_RECENT_ARTICLES = `
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
const GET_ALL_ARTICLES = `
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
const GET_ARTICLE_BY_SLUG = `
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

export { GET_ARTICLE_BY_SLUG as G, GET_ALL_ARTICLES as a, GET_RECENT_ARTICLES as b, fetchGraphQL as f };
