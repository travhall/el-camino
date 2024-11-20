export interface UploadFile {
    url: string;
    alternativeText?: string | null;
}

export interface Author {
    name: string;
    avatar?: UploadFile;
}

export interface Category {
    name: string;
    slug: string;
}

export interface Article {
    documentId: string;
    title: string;
    description?: string;
    slug: string;
    publishedAt: string;
    cover?: UploadFile;
    author?: Author;
    category?: Category;
}

export interface ArticlesResponse {
    articles: Article[];
    meta: {
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            pageCount: number;
        };
    };
}

export interface ContentBlock {
    __typename: string;
    id?: string;
    body?: string;
    file?: UploadFile;
    title?: string;
    files?: UploadFile[];
}

export interface Article {
    documentId: string;
    title: string;
    description?: string;
    slug: string;
    publishedAt: string;
    cover?: UploadFile;
    author?: Author;
    category?: Category;
    blocks?: ContentBlock[];
}

export interface ContentBlock {
    __typename: string;
    id?: string;
    body?: string;
    file?: UploadFile;
    title?: string;
}