// src/lib/tina/types.ts
import type { Block, SEO, Media } from "@/lib/types/content";

export interface TinaAuthor {
  name: string;
  avatar?: string;
  bio?: string;
}

export interface TinaSection {
  _template: "hero" | "content" | "gallery";
  heading?: string;
  subheading?: string;
  backgroundImage?: string;
  title?: string;
  content?: string;
  images?: Array<{
    src: string;
    caption?: string;
  }>;
}

export interface TinaPage {
  title: string;
  showInNav?: boolean;
  weight?: number;
  sections?: TinaSection[];
  seo?: SEO;
}

export interface TinaPost {
  title: string;
  publishDate: string;
  status: "draft" | "published" | "archived";
  author?: TinaAuthor;
  seo?: SEO;
  body: string;
  tags?: Array<{
    name: string;
    color: string;
  }>;
}

// Helper function to convert TinaSection to Block
export function tinaToBlock(section: TinaSection): Block {
  switch (section._template) {
    case "content":
      return {
        blockType: "content",
        content: section.content,
        appearance: "normal",
      };
    case "gallery":
      return {
        blockType: "imageGallery",
        images:
          section.images?.map((img) => ({
            src: img.src,
            caption: img.caption,
          })) || [],
        columns: "3",
      };
    default:
      throw new Error(`Unsupported section type: ${section._template}`);
  }
}
