import { defineCollection } from 'astro:content';
import { blogSchema, pageSchema } from './_schemas';

export const collections = {
  blog: defineCollection({
    schema: blogSchema,
  }),
  pages: defineCollection({
    schema: pageSchema,
  }),
};