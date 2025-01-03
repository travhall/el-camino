// src/lib/strapi/hooks.ts
import { useState, useEffect } from "react";
import type {
  Article,
  ArticleQueryParams,
  StrapiPagination,
} from "../types/strapi";
import { getAllArticles } from "./api";

interface ArticlesState {
  articles: Article[];
  pagination: StrapiPagination;
  error: string | null;
  isLoading: boolean;
}

const DEFAULT_PAGINATION: StrapiPagination = {
  page: 1,
  pageSize: 12,
  pageCount: 0,
  total: 0,
};

export function useArticles(initialParams: ArticleQueryParams) {
  const [state, setState] = useState<ArticlesState>({
    articles: [],
    pagination: DEFAULT_PAGINATION,
    error: null,
    isLoading: true,
  });

  const [params, setParams] = useState<ArticleQueryParams>(initialParams);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const articles = await getAllArticles(params);
        if (mounted) {
          setState({
            articles,
            pagination: {
              ...DEFAULT_PAGINATION,
              page: params.page || 1,
            },
            error: null,
            isLoading: false,
          });
        }
      } catch (error) {
        if (mounted) {
          setState((prev) => ({
            ...prev,
            error: error instanceof Error ? error.message : "An error occurred",
            isLoading: false,
          }));
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [params]);

  const loadMore = async () => {
    if (state.isLoading) return;

    const nextPage = (params.page || 1) + 1;

    try {
      const newArticles = await getAllArticles({
        ...params,
        page: nextPage,
      });

      setState((prev) => ({
        ...prev,
        articles: [...prev.articles, ...newArticles],
        pagination: {
          ...prev.pagination,
          page: nextPage,
        },
      }));

      setParams((prev) => ({
        ...prev,
        page: nextPage,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load more articles",
      }));
    }
  };

  return {
    ...state,
    loadMore,
    setParams,
    hasMore: state.articles.length > 0,
  };
}
