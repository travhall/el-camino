// src/lib/strapi/api.ts
import { fetchAPI } from "./client";
import type {
  Article,
  ArticleQueryParams,
  StrapiResponse,
  StrapiData,
  Page,
  Global,
  Category,
  Author,
} from "../types/strapi";

export async function getAllArticles(
  params?: ArticleQueryParams
): Promise<Article[]> {
  try {
    const strapiParams: Record<string, string> = {
      "populate[0]": "cover",
      "populate[1]": "author.avatar",
      "populate[2]": "category",
    };

    if (params?.page) {
      strapiParams["pagination[page]"] = params.page.toString();
    }
    if (params?.pageSize) {
      strapiParams["pagination[pageSize]"] = params.pageSize.toString();
    }
    if (params?.sort) {
      strapiParams["sort[0]"] = `publishedAt:${params.sort}`;
    }
    if (params?.categorySlug) {
      strapiParams["filters[category][slug][$eq]"] = params.categorySlug;
    }

    const response = await fetchAPI<StrapiResponse<Article[]>>("articles", {
      params: strapiParams,
    });

    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error("Error fetching articles:", error);
    return [];
  }
}

export async function getGlobalData() {
  const response = await fetchAPI<StrapiData<Global>>("global");
  return response.data;
}

export async function getArticleBySlug(slug: string) {
  const response = await fetchAPI<StrapiResponse<Article[]>>("articles", {
    params: {
      "filters[slug][$eq]": slug,
      "populate[0]": "cover",
      "populate[1]": "author.avatar",
      "populate[2]": "category",
      "populate[3]": "blocks",
      "populate[4]": "blocks.file",
      "populate[5]": "blocks.files",
      "populate[6]": "video",
    },
  });

  const articles = Array.isArray(response.data) ? response.data : [];
  const article = articles[0];
  return article ? { ...article, id: article.id || 0 } : null;
}

export async function getAllCategories() {
  const response = await fetchAPI<StrapiData<Category>[]>("categories");
  return response.data;
}

export async function getCategoryBySlug(slug: string) {
  const response = await fetchAPI<StrapiData<Category>[]>("categories", {
    params: {
      "filters[slug][$eq]": slug,
    },
  });
  return response.data[0];
}

export async function getAuthorById(id: number) {
  const response = await fetchAPI<StrapiData<Author>>(`authors/${id}`);
  return response.data;
}

export async function getFooterPages() {
  const response = await fetchAPI<StrapiResponse<Page[]>>("pages", {
    params: {
      "filters[menuLocation][$eq]": "footer",
      "populate[0]": "blocks",
      "populate[1]": "cover",
    },
  });
  return Array.isArray(response.data) ? response.data : [];
}
