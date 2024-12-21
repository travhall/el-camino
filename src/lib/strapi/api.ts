import { fetchAPI } from "./client";
import type {
  Article,
  Author,
  Category,
  About,
  Global,
  StrapiResponse,
  StrapiData,
} from "../types/strapi";

export async function getGlobalData() {
  const response = await fetchAPI<StrapiData<Global>>("global");
  return response.data;
}

export async function getAboutData() {
  const response = await fetchAPI<StrapiData<About>>("about");
  return response.data;
}

export async function getAllArticles(params?: Record<string, string>) {
  const response = await fetchAPI<StrapiResponse<Article[]>>("articles", {
    params: {
      ...params,
      "populate[0]": "cover",
      "populate[1]": "author.avatar",
      "populate[2]": "category",
    },
  });
  const articles = Array.isArray(response.data) ? response.data : [];
  return articles.map((article) => ({
    ...article,
    id: article.id || 0,
  }));
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
