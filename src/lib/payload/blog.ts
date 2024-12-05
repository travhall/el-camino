// src/lib/payload/blog.ts

// Define minimal types we need from payload
interface CollectionConfig {
  slug: string;
  admin?: {
    useAsTitle?: string;
    defaultColumns?: string[];
    description?: string;
    preview?: (doc: { slug: string }) => string;
  };
  access?: {
    read?: () => boolean;
    create?: () => boolean;
    update?: () => boolean;
    delete?: () => boolean;
  };
  fields: {
    name: string;
    type: string;
    required?: boolean;
    unique?: boolean;
    label?: string;
    admin?: {
      position?: string;
      description?: string;
      date?: {
        pickerAppearance?: string;
        displayFormat?: string;
      };
    };
    hooks?: {
      beforeValidate?: Array<(args: { 
        value: string | undefined; 
        data: { title?: string; name?: string } | undefined 
      }) => string | undefined>;
    };
    relationTo?: string;
    hasMany?: boolean;
    maxLength?: number;
    options?: Array<{ label: string; value: string }>;
    defaultValue?: any;
    fields?: Array<{
      name: string;
      type: string;
      label?: string;
      relationTo?: string;
    }>;
    editor?: any;
  }[];
  timestamps?: boolean;
}

// Since we're not actually using the lexical editor on the frontend
const lexicalEditor = (config: any) => config;

export const Blog: CollectionConfig = {
  slug: 'blog-posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'status', 'publishedDate'],
    description: 'Blog posts for El Camino Skate Shop',
    preview: (doc) => {
      return `/news/${doc.slug}`
    },
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Post Title',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar',
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (!value && data?.title) {
              return data.title
                .toLowerCase()
                .replace(/ /g, '-')
                .replace(/[^\w-]+/g, '')
            }
            return value
          },
        ],
      },
    },
    {
      name: 'excerpt',
      type: 'textarea',
      required: true,
      maxLength: 200,
      admin: {
        description: 'Brief summary of the post (max 200 characters)',
      },
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      required: true,
      admin: {
        description: 'Featured image for the blog post',
      },
    },
    {
      name: 'content',
      type: 'richText',
      editor: lexicalEditor({
        features: {
          blocks: ['h2', 'h3', 'h4', 'h5', 'h6', 'quote'],
          marks: ['bold', 'italic', 'underline', 'strikethrough'],
          lists: ['ordered', 'unordered'],
          upload: {
            collections: {
              media: {
                fields: [
                  {
                    name: 'caption',
                    type: 'text',
                  },
                  {
                    name: 'altText',
                    type: 'text',
                  },
                ],
              },
            },
          },
        },
      }),
      required: true,
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'blog-categories',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'blog-tags',
      hasMany: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        {
          label: 'Draft',
          value: 'draft',
        },
        {
          label: 'Published',
          value: 'published',
        },
      ],
      defaultValue: 'draft',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'publishedDate',
      type: 'date',
      required: true,
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayAndTime',
          displayFormat: 'MMM d, yyyy h:mm a',
        },
      },
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'SEO Title',
        },
        {
          name: 'description',
          type: 'textarea',
          label: 'SEO Description',
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          label: 'SEO Image',
        },
        {
          name: 'noIndex',
          type: 'checkbox',
          label: 'No Index',
        },
      ],
      admin: {
        position: 'sidebar',
      },
    },
  ],
  timestamps: true,
}

// Add the getBlogPost function
export async function getBlogPost(slug: string) {
  const response = await fetch(`${import.meta.env.PUBLIC_PAYLOAD_URL}/api/blog-posts?where[slug][equals]=${slug}&depth=2`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch blog post: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.docs || data.docs.length === 0) {
    return null;
  }

  return data.docs[0];
}

export const BlogCategories: CollectionConfig = {
  slug: 'blog-categories',
  admin: {
    useAsTitle: 'name',
    description: 'Categories for blog posts',
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'URL-friendly version of the category name',
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (!value && data?.name) {
              return data.name
                .toLowerCase()
                .replace(/ /g, '-')
                .replace(/[^\w-]+/g, '')
            }
            return value
          },
        ],
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
  ],
}

export const BlogTags: CollectionConfig = {
  slug: 'blog-tags',
  admin: {
    useAsTitle: 'name',
    description: 'Tags for blog posts',
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (!value && data?.name) {
              return data.name
                .toLowerCase()
                .replace(/ /g, '-')
                .replace(/[^\w-]+/g, '')
            }
            return value
          },
        ],
      },
    },
  ],
}