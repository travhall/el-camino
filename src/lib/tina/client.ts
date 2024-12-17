import { Client } from "tinacms";
import type { TinaPage, TinaPost } from "./types";
import { Queries } from "./queries";

interface Edge<T> {
  node: T;
}

interface QueryResponse<T> {
  [key: string]:
    | {
        edges: Array<Edge<T>>;
      }
    | T;
}

export const client = new Client({
  clientId: process.env.NEXT_PUBLIC_TINA_CLIENT_ID ?? "",
  branch:
    process.env.GITHUB_BRANCH ||
    process.env.VERCEL_GIT_COMMIT_REF ||
    process.env.HEAD ||
    "main",
  tinaGraphQLVersion: "v1",
});

export async function fetchPage(slug: string): Promise<TinaPage | null> {
  try {
    const response = await client.request<QueryResponse<TinaPage>>(
      Queries.page,
      {
        variables: { relativePath: `${slug}.md` },
      }
    );
    return response.page as TinaPage;
  } catch (error) {
    console.error("Error fetching page:", error);
    return null;
  }
}

export async function fetchAllPages(): Promise<TinaPage[]> {
  try {
    const response = await client.request<QueryResponse<TinaPage>>(
      Queries.allPages,
      {
        variables: {},
      }
    );
    return (
      response.pageConnection as { edges: Array<Edge<TinaPage>> }
    ).edges.map((edge) => edge.node);
  } catch (error) {
    console.error("Error fetching pages:", error);
    return [];
  }
}

export async function fetchPost(slug: string): Promise<TinaPost | null> {
  try {
    const response = await client.request<QueryResponse<TinaPost>>(
      Queries.post,
      {
        variables: { relativePath: `${slug}.md` },
      }
    );
    return response.post as TinaPost;
  } catch (error) {
    console.error("Error fetching post:", error);
    return null;
  }
}

export async function fetchAllPosts(): Promise<TinaPost[]> {
  try {
    const response = await client.request<QueryResponse<TinaPost>>(
      Queries.allPosts,
      {
        variables: {},
      }
    );
    return (
      response.postConnection as { edges: Array<Edge<TinaPost>> }
    ).edges.map((edge) => edge.node);
  } catch (error) {
    console.error("Error fetching posts:", error);
    return [];
  }
}
