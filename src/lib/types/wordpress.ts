// src/lib/types/wordpress.ts
export interface WordPressPost {
  id: number;
  date: string;
  slug: string;
  title: {
    rendered: string;
  };
  excerpt: {
    rendered: string;
  };
  content: {
    rendered: string;
  };
  _embedded?: {
    "wp:featuredmedia"?: [
      {
        source_url: string;
        alt_text?: string;
      }
    ];
    "wp:term"?: [
      [
        {
          name: string;
        }
      ]
    ];
    author?: [
      {
        name: string;
        avatar_urls: {
          "96": string;
        };
      }
    ];
  };
}
