/* tslint:disable */
/* eslint-disable */
/**
 * This file was automatically generated by Payload.
 * DO NOT MODIFY IT BY HAND. Instead, modify your source Payload config,
 * and re-run `payload generate:types` to regenerate this file.
 */

export interface Config {
  auth: {
    users: UserAuthOperations;
  };
  collections: {
    users: User;
    media: Media;
    pages: Page;
    'blog-posts': BlogPost;
    'blog-categories': BlogCategory;
    'blog-tags': BlogTag;
    'payload-locked-documents': PayloadLockedDocument;
    'payload-preferences': PayloadPreference;
    'payload-migrations': PayloadMigration;
  };
  collectionsJoins: {};
  collectionsSelect: {
    users: UsersSelect<false> | UsersSelect<true>;
    media: MediaSelect<false> | MediaSelect<true>;
    pages: PagesSelect<false> | PagesSelect<true>;
    'blog-posts': BlogPostsSelect<false> | BlogPostsSelect<true>;
    'blog-categories': BlogCategoriesSelect<false> | BlogCategoriesSelect<true>;
    'blog-tags': BlogTagsSelect<false> | BlogTagsSelect<true>;
    'payload-locked-documents': PayloadLockedDocumentsSelect<false> | PayloadLockedDocumentsSelect<true>;
    'payload-preferences': PayloadPreferencesSelect<false> | PayloadPreferencesSelect<true>;
    'payload-migrations': PayloadMigrationsSelect<false> | PayloadMigrationsSelect<true>;
  };
  db: {
    defaultIDType: number;
  };
  globals: {};
  globalsSelect: {};
  locale: null;
  user: User & {
    collection: 'users';
  };
  jobs: {
    tasks: unknown;
    workflows: unknown;
  };
}
export interface UserAuthOperations {
  forgotPassword: {
    email: string;
    password: string;
  };
  login: {
    email: string;
    password: string;
  };
  registerFirstUser: {
    email: string;
    password: string;
  };
  unlock: {
    email: string;
    password: string;
  };
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "users".
 */
export interface User {
  id: number;
  name: string;
  role: 'admin' | 'editor' | 'author';
  avatar?: (number | null) | Media;
  bio?: string | null;
  social?: {
    twitter?: string | null;
    linkedin?: string | null;
    website?: string | null;
  };
  updatedAt: string;
  createdAt: string;
  enableAPIKey?: boolean | null;
  apiKey?: string | null;
  apiKeyIndex?: string | null;
  email: string;
  resetPasswordToken?: string | null;
  resetPasswordExpiration?: string | null;
  salt?: string | null;
  hash?: string | null;
  _verified?: boolean | null;
  _verificationToken?: string | null;
  loginAttempts?: number | null;
  lockUntil?: string | null;
  password?: string | null;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "media".
 */
export interface Media {
  id: number;
  alt: string;
  updatedAt: string;
  createdAt: string;
  url?: string | null;
  thumbnailURL?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  filesize?: number | null;
  width?: number | null;
  height?: number | null;
  focalX?: number | null;
  focalY?: number | null;
  sizes?: {
    thumbnail?: {
      url?: string | null;
      width?: number | null;
      height?: number | null;
      mimeType?: string | null;
      filesize?: number | null;
      filename?: string | null;
    };
    avatar?: {
      url?: string | null;
      width?: number | null;
      height?: number | null;
      mimeType?: string | null;
      filesize?: number | null;
      filename?: string | null;
    };
  };
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "pages".
 */
export interface Page {
  id: number;
  title: string;
  slug: string;
  seo: {
    metaTitle: string;
    metaDescription: string;
    ogImage?: (number | null) | Media;
    noIndex?: boolean | null;
  };
  layout: (
    | {
        content?: {
          root: {
            type: string;
            children: {
              type: string;
              version: number;
              [k: string]: unknown;
            }[];
            direction: ('ltr' | 'rtl') | null;
            format: 'left' | 'start' | 'center' | 'right' | 'end' | 'justify' | '';
            indent: number;
            version: number;
          };
          [k: string]: unknown;
        } | null;
        appearance?: ('normal' | 'emphasis' | 'meta') | null;
        id?: string | null;
        blockName?: string | null;
        blockType: 'content';
      }
    | {
        images?:
          | {
              image: number | Media;
              caption?: string | null;
              id?: string | null;
            }[]
          | null;
        columns?: ('2' | '3' | '4') | null;
        id?: string | null;
        blockName?: string | null;
        blockType: 'imageGallery';
      }
    | {
        url: string;
        caption?: string | null;
        transcript?: string | null;
        id?: string | null;
        blockName?: string | null;
        blockType: 'video';
      }
  )[];
  updatedAt: string;
  createdAt: string;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "blog-posts".
 */
export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  featuredImage: number | Media;
  layout?:
    | (
        | {
            content: {
              root: {
                type: string;
                children: {
                  type: string;
                  version: number;
                  [k: string]: unknown;
                }[];
                direction: ('ltr' | 'rtl') | null;
                format: 'left' | 'start' | 'center' | 'right' | 'end' | 'justify' | '';
                indent: number;
                version: number;
              };
              [k: string]: unknown;
            };
            appearance?: ('normal' | 'emphasis' | 'meta') | null;
            id?: string | null;
            blockName?: string | null;
            blockType: 'content';
          }
        | {
            images?:
              | {
                  image: number | Media;
                  caption?: string | null;
                  id?: string | null;
                }[]
              | null;
            columns?: ('2' | '3' | '4') | null;
            id?: string | null;
            blockName?: string | null;
            blockType: 'imageGallery';
          }
        | {
            url: string;
            caption?: string | null;
            transcript?: string | null;
            id?: string | null;
            blockName?: string | null;
            blockType: 'video';
          }
      )[]
    | null;
  category: number | BlogCategory;
  tags?: (number | BlogTag)[] | null;
  author: number | User;
  status: 'draft' | 'published';
  publishedDate?: string | null;
  seo?: {
    title?: string | null;
    description?: string | null;
    image?: (number | null) | Media;
    noIndex?: boolean | null;
  };
  updatedAt: string;
  createdAt: string;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "blog-categories".
 */
export interface BlogCategory {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  updatedAt: string;
  createdAt: string;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "blog-tags".
 */
export interface BlogTag {
  id: number;
  name: string;
  slug: string;
  updatedAt: string;
  createdAt: string;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "payload-locked-documents".
 */
export interface PayloadLockedDocument {
  id: number;
  document?:
    | ({
        relationTo: 'users';
        value: number | User;
      } | null)
    | ({
        relationTo: 'media';
        value: number | Media;
      } | null)
    | ({
        relationTo: 'pages';
        value: number | Page;
      } | null)
    | ({
        relationTo: 'blog-posts';
        value: number | BlogPost;
      } | null)
    | ({
        relationTo: 'blog-categories';
        value: number | BlogCategory;
      } | null)
    | ({
        relationTo: 'blog-tags';
        value: number | BlogTag;
      } | null);
  globalSlug?: string | null;
  user: {
    relationTo: 'users';
    value: number | User;
  };
  updatedAt: string;
  createdAt: string;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "payload-preferences".
 */
export interface PayloadPreference {
  id: number;
  user: {
    relationTo: 'users';
    value: number | User;
  };
  key?: string | null;
  value?:
    | {
        [k: string]: unknown;
      }
    | unknown[]
    | string
    | number
    | boolean
    | null;
  updatedAt: string;
  createdAt: string;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "payload-migrations".
 */
export interface PayloadMigration {
  id: number;
  name?: string | null;
  batch?: number | null;
  updatedAt: string;
  createdAt: string;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "users_select".
 */
export interface UsersSelect<T extends boolean = true> {
  name?: T;
  role?: T;
  avatar?: T;
  bio?: T;
  social?:
    | T
    | {
        twitter?: T;
        linkedin?: T;
        website?: T;
      };
  updatedAt?: T;
  createdAt?: T;
  enableAPIKey?: T;
  apiKey?: T;
  apiKeyIndex?: T;
  email?: T;
  resetPasswordToken?: T;
  resetPasswordExpiration?: T;
  salt?: T;
  hash?: T;
  _verified?: T;
  _verificationToken?: T;
  loginAttempts?: T;
  lockUntil?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "media_select".
 */
export interface MediaSelect<T extends boolean = true> {
  alt?: T;
  updatedAt?: T;
  createdAt?: T;
  url?: T;
  thumbnailURL?: T;
  filename?: T;
  mimeType?: T;
  filesize?: T;
  width?: T;
  height?: T;
  focalX?: T;
  focalY?: T;
  sizes?:
    | T
    | {
        thumbnail?:
          | T
          | {
              url?: T;
              width?: T;
              height?: T;
              mimeType?: T;
              filesize?: T;
              filename?: T;
            };
        avatar?:
          | T
          | {
              url?: T;
              width?: T;
              height?: T;
              mimeType?: T;
              filesize?: T;
              filename?: T;
            };
      };
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "pages_select".
 */
export interface PagesSelect<T extends boolean = true> {
  title?: T;
  slug?: T;
  seo?:
    | T
    | {
        metaTitle?: T;
        metaDescription?: T;
        ogImage?: T;
        noIndex?: T;
      };
  layout?:
    | T
    | {
        content?:
          | T
          | {
              content?: T;
              appearance?: T;
              id?: T;
              blockName?: T;
            };
        imageGallery?:
          | T
          | {
              images?:
                | T
                | {
                    image?: T;
                    caption?: T;
                    id?: T;
                  };
              columns?: T;
              id?: T;
              blockName?: T;
            };
        video?:
          | T
          | {
              url?: T;
              caption?: T;
              transcript?: T;
              id?: T;
              blockName?: T;
            };
      };
  updatedAt?: T;
  createdAt?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "blog-posts_select".
 */
export interface BlogPostsSelect<T extends boolean = true> {
  title?: T;
  slug?: T;
  excerpt?: T;
  featuredImage?: T;
  layout?:
    | T
    | {
        content?:
          | T
          | {
              content?: T;
              appearance?: T;
              id?: T;
              blockName?: T;
            };
        imageGallery?:
          | T
          | {
              images?:
                | T
                | {
                    image?: T;
                    caption?: T;
                    id?: T;
                  };
              columns?: T;
              id?: T;
              blockName?: T;
            };
        video?:
          | T
          | {
              url?: T;
              caption?: T;
              transcript?: T;
              id?: T;
              blockName?: T;
            };
      };
  category?: T;
  tags?: T;
  author?: T;
  status?: T;
  publishedDate?: T;
  seo?:
    | T
    | {
        title?: T;
        description?: T;
        image?: T;
        noIndex?: T;
      };
  updatedAt?: T;
  createdAt?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "blog-categories_select".
 */
export interface BlogCategoriesSelect<T extends boolean = true> {
  name?: T;
  slug?: T;
  description?: T;
  updatedAt?: T;
  createdAt?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "blog-tags_select".
 */
export interface BlogTagsSelect<T extends boolean = true> {
  name?: T;
  slug?: T;
  updatedAt?: T;
  createdAt?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "payload-locked-documents_select".
 */
export interface PayloadLockedDocumentsSelect<T extends boolean = true> {
  document?: T;
  globalSlug?: T;
  user?: T;
  updatedAt?: T;
  createdAt?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "payload-preferences_select".
 */
export interface PayloadPreferencesSelect<T extends boolean = true> {
  user?: T;
  key?: T;
  value?: T;
  updatedAt?: T;
  createdAt?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "payload-migrations_select".
 */
export interface PayloadMigrationsSelect<T extends boolean = true> {
  name?: T;
  batch?: T;
  updatedAt?: T;
  createdAt?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "auth".
 */
export interface Auth {
  [k: string]: unknown;
}


declare module 'payload' {
  export interface GeneratedTypes extends Config {}
}