// src/lib/types/strapi.ts
interface StrapiResponse<T> {
  data: T;
  meta: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

interface StrapiData<T> {
  id: number;
  attributes: T;
}

interface StrapiMedia {
  id: number;
  documentId: string;
  name: string;
  alternativeText: string;
  caption: string;
  width: number;
  height: number;
  formats: {
    thumbnail: ImageFormat;
    small: ImageFormat;
    medium: ImageFormat;
    large?: ImageFormat;
  };
  hash: string;
  ext: string;
  mime: string;
  size: number;
  url: string;
  previewUrl: string | null;
  provider: string;
  provider_metadata: any;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

interface SharedSEO {
  metaTitle: string;
  metaDescription: string;
  metaImage?: StrapiMedia;
  keywords?: string;
}

interface ComponentSharedMedia {
  __component: "shared.media";
  file: StrapiMedia;
}

interface ComponentSharedQuote {
  __component: "shared.quote";
  title?: string;
  body: string;
}

interface ComponentSharedRichText {
  __component: "shared.rich-text";
  body: string;
}

interface ComponentSharedSlider {
  __component: "shared.slider";
  files: StrapiMedia[];
}

type DynamicZoneComponent =
  | ComponentSharedMedia
  | ComponentSharedQuote
  | ComponentSharedRichText
  | ComponentSharedSlider
  | ComponentSharedVideo;

interface Article {
  documentId: string;
  title: string;
  description: string;
  slug: string;
  buttonLabel?: string;
  headerType: "image" | "video";
  video: ComponentSharedVideo;
  blocks: DynamicZoneComponent[];
  cover?: {
    id: number;
    documentId: string;
    name: string;
    alternativeText: string;
    caption: string;
    width: number;
    height: number;
    formats: {
      thumbnail: ImageFormat;
      small: ImageFormat;
      medium: ImageFormat;
      large?: ImageFormat;
    };
    hash: string;
    ext: string;
    mime: string;
    size: number;
    url: string;
    previewUrl: string | null;
    provider: string;
    provider_metadata: any;
  };
  author?: {
    id: number;
    documentId: string;
    name: string;
    email: string;
    avatar?: {
      id: number;
      documentId: string;
      url: string;
      alternativeText: string;
    };
  };
  category?: {
    id: number;
    documentId: string;
    name: string;
    slug: string;
    description: string | null;
  };
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

interface ImageFormat {
  name: string;
  hash: string;
  ext: string;
  mime: string;
  path: string | null;
  width: number;
  height: number;
  size: number;
  sizeInBytes: number;
  url: string;
}

interface Author {
  name: string;
  email: string;
  avatar: StrapiMedia;
  articles: {
    data: Array<StrapiData<Article>>;
  };
}

interface Category {
  name: string;
  slug: string;
  description: string;
  articles: {
    data: Array<StrapiData<Article>>;
  };
}

interface ComponentSharedVideo {
  __component: "shared.video";
  id: number;
  url: string;
  title: string;
  description?: string;
}

interface Global {
  siteName: string;
  favicon: StrapiMedia;
  siteDescription: string;
  defaultSeo: SharedSEO;
}

interface Page {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  description: string;
  cover?: {
    id: number;
    documentId: string;
    name: string;
    alternativeText: string;
    caption: string;
    width: number;
    height: number;
    formats: {
      thumbnail: ImageFormat;
      small: ImageFormat;
      medium: ImageFormat;
      large?: ImageFormat;
    };
    hash: string;
    ext: string;
    mime: string;
    size: number;
    url: string;
    previewUrl: string | null;
    provider: string;
    provider_metadata: any;
  };
  menuLocation: "header" | "footer" | "none";
  menuOrder: number;
  blocks: DynamicZoneComponent[];
  isExternalLink: boolean;
  externalUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export type {
  StrapiResponse,
  StrapiData,
  StrapiMedia,
  SharedSEO,
  Article,
  Author,
  Category,
  Global,
  Page,
  ComponentSharedVideo,
  ComponentSharedMedia,
  ComponentSharedQuote,
  ComponentSharedRichText,
  ComponentSharedSlider,
  DynamicZoneComponent,
  ImageFormat,
};
