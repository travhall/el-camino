import { defineCollection, z } from 'astro:content';

const seoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  noIndex: z.boolean().optional()
});

const mediaSchema = z.object({
  src: z.string(),
  alt: z.string().optional(),
  caption: z.string().optional()
});

const blockSchema = z.object({
  blockType: z.enum(['content', 'imageGallery']),
  content: z.string().optional(),
  images: z.array(mediaSchema).optional(),
  appearance: z.enum(['normal', 'emphasis', 'meta']).optional(),
  columns: z.enum(['2', '3', '4']).optional()
});

export const collections = {
  blog: defineCollection({
    schema: z.object({
      title: z.string(),
      excerpt: z.string(),
      featuredImage: mediaSchema,
      category: z.string(),
      tags: z.array(z.string()).optional(),
      publishedDate: z.date(),
      status: z.enum(['draft', 'published']),
      content: z.string(),
      author: z.string(),
      seo: seoSchema.optional()
    })
  }),
  pages: defineCollection({
    schema: z.object({
      title: z.string(),
      content: z.string(),
      seo: seoSchema.optional(),
      layout: z.array(blockSchema).optional()
    })
  })
};