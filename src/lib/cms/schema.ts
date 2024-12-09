// src/lib/cms/schema.ts
import type { z } from 'astro:content';
import type { blogSchema, pageSchema } from '../../content/_schemas';

export type BlogPost = z.infer<typeof blogSchema>;
export type Page = z.infer<typeof pageSchema>;