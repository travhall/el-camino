export const Queries = {
  page: `#graphql
    query GetPage($relativePath: String!) {
      page(relativePath: $relativePath) {
        title
        showInNav
        weight
        sections {
          __typename
          ... on PageSectionsHero {
            _template
            heading
            subheading
            backgroundImage
          }
          ... on PageSectionsContent {
            _template
            title
            content
          }
          ... on PageSectionsGallery {
            _template
            images {
              src
              caption
            }
          }
        }
        seo {
          title
          description
          image
          noIndex
        }
      }
    }
  `,

  allPages: `#graphql
    query GetPages {
      pageConnection {
        edges {
          node {
            title
            showInNav
            weight
            _sys {
              filename
            }
          }
        }
      }
    }
  `,

  post: `#graphql
    query GetPost($relativePath: String!) {
      post(relativePath: $relativePath) {
        title
        publishDate
        status
        author {
          name
          avatar
          bio
        }
        seo {
          title
          description
          image
          noIndex
        }
        body
        tags {
          name
          color
        }
      }
    }
  `,

  allPosts: `#graphql
    query GetPosts {
      postConnection {
        edges {
          node {
            title
            publishDate
            status
            author {
              name
            }
            seo {
              description
            }
            tags {
              name
              color
            }
            _sys {
              filename
            }
          }
        }
      }
    }
  `,
};
