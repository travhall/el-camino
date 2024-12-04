import { CollectionConfig, CollectionBeforeValidateHook } from 'payload';
import { lexicalEditor } from '@payloadcms/richtext-lexical';

const basicEditor = lexicalEditor({});

const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

const beforeValidate: CollectionBeforeValidateHook = ({ data = {}, req }) => {
  if (!data) return {}

  const now = new Date().toISOString()
  
  return {
    ...data,
    slug: data.slug || (data.title ? generateSlug(data.title) : undefined),
    updatedAt: now,
    seo: {
      ...(data.seo || {}),
      metaTitle: data.seo?.metaTitle || data.title || undefined,
      metaDescription: data.seo?.metaDescription || undefined,
    }
  }
}

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'updatedAt'],
    preview: (doc) => {
      if (!doc?.slug) return ''
      return `${process.env.PAYLOAD_PUBLIC_SITE_URL || 'http://localhost:4321'}/${doc.slug}`
    },
  },
  hooks: {
    beforeValidate: [beforeValidate],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar',
        description: 'URL-friendly version of the title (e.g., "about-us")'
      }
    },
    {
      name: 'seo',
      type: 'group',
      admin: {
        position: 'sidebar'
      },
      fields: [
        {
          name: 'metaTitle',
          type: 'text',
          required: true,
        },
        {
          name: 'metaDescription',
          type: 'textarea',
          required: true,
        },
        {
          name: 'ogImage',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'noIndex',
          type: 'checkbox',
          defaultValue: false,
        }
      ]
    },
    {
      name: 'layout',
      type: 'blocks',
      required: true,
      blocks: [
        {
          slug: 'content',
          fields: [
            {
              name: 'content',
              type: 'richText',
              editor: basicEditor,
            },
            {
              name: 'appearance',
              type: 'select',
              defaultValue: 'normal',
              options: [
                { label: 'Normal', value: 'normal' },
                { label: 'Emphasis', value: 'emphasis' },
                { label: 'Meta', value: 'meta' }
              ]
            }
          ]
        },
        {
          slug: 'imageGallery',
          fields: [
            {
              name: 'images',
              type: 'array',
              fields: [
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  required: true,
                },
                {
                  name: 'caption',
                  type: 'text',
                }
              ]
            },
            {
              name: 'columns',
              type: 'select',
              defaultValue: '3',
              options: [
                { label: '2 Columns', value: '2' },
                { label: '3 Columns', value: '3' },
                { label: '4 Columns', value: '4' }
              ]
            }
          ]
        },
        {
          slug: 'video',
          fields: [
            {
              name: 'url',
              type: 'text',
              required: true,
            },
            {
              name: 'caption',
              type: 'text',
            },
            {
              name: 'transcript',
              type: 'textarea',
            }
          ]
        }
      ]
    }
  ],
  timestamps: true,
};