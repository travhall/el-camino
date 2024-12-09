import { z } from 'astro:content';

const seoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  noIndex: z.boolean().optional(),
});

const mediaSchema = z.object({
  src: z.string(),
  alt: z.string().optional(),
  caption: z.string().optional(),
});

export const blogSchema = z.object({
  title: z.string(),
  excerpt: z.string(),
  featuredImage: mediaSchema,
  category: z.string(),
  tags: z.array(z.string()).optional(),
  publishedDate: z.date(),
  status: z.enum(['draft', 'published']),
  content: z.string(),
  author: z.string(),
  seo: seoSchema.optional(),
  updatedAt: z.date().optional(),
});

export const pageSchema = z.object({
  title: z.string(),
  content: z.string(),
  seo: seoSchema.optional(),
});