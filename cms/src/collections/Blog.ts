import { CollectionConfig, FieldHook } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

const generateSlug = (text: string): string => {
  if (!text) return ''
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

const formatSlug: FieldHook = ({ siblingData, value }) => {
  if (!value && siblingData?.title) {
    return generateSlug(siblingData.title)
  }
  return value
}

const setPublishDate: FieldHook = ({ siblingData, value }) => {
  if (siblingData?.status === 'published' && !value) {
    return new Date().toISOString()
  }
  return value
}

const formatSEOField = (sourceField: string): FieldHook => {
  return ({ siblingData, value }) => {
    if (!value && siblingData?.[sourceField]) {
      return siblingData[sourceField]
    }
    return value
  }
}

const basicEditor = lexicalEditor({})

export const Blog: CollectionConfig = {
  slug: 'blog-posts',
  access: {
    read: () => true,  // Add this to allow public read access
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'status', 'publishedDate'],
    preview: (doc) => {
      if (!doc?.slug) return ''
      return `${process.env.PAYLOAD_PUBLIC_SITE_URL || 'http://localhost:4321'}/news/${doc.slug}`
    },
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
        description: 'URL-friendly version of the title - auto-generated'
      },
      hooks: {
        beforeChange: [formatSlug]
      }
    },
    {
      name: 'excerpt',
      type: 'textarea',
      required: true,
      maxLength: 200,
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'layout',
      type: 'blocks',
      blocks: [
        {
          slug: 'content',
          fields: [
            {
              name: 'content',
              type: 'richText',
              editor: basicEditor,
              required: true,
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
                  required: true
                },
                {
                  name: 'caption',
                  type: 'text'
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
              required: true
            },
            {
              name: 'caption',
              type: 'text'
            },
            {
              name: 'transcript',
              type: 'textarea'
            }
          ]
        }
      ]
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'blog-categories',
      required: true,
      admin: {
        position: 'sidebar'
      }
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'blog-tags',
      hasMany: true,
      admin: {
        position: 'sidebar'
      }
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        position: 'sidebar',
        description: 'Select the author of this post'
      }
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' }
      ],
      defaultValue: 'draft',
      required: true,
      admin: {
        position: 'sidebar'
      }
    },
    {
      name: 'publishedDate',
      type: 'date',
      admin: {
        position: 'sidebar',
        description: 'Auto-set when published',
        date: {
          pickerAppearance: 'dayAndTime',
          displayFormat: 'MMM d, yyyy h:mm a'
        }
      },
      hooks: {
        beforeChange: [setPublishDate]
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
          name: 'title',
          type: 'text',
          admin: {
            description: 'Defaults to post title if empty'
          },
          hooks: {
            beforeChange: [formatSEOField('title')]
          }
        },
        {
          name: 'description',
          type: 'textarea',
          admin: {
            description: 'Defaults to post excerpt if empty'
          },
          hooks: {
            beforeChange: [formatSEOField('excerpt')]
          }
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Defaults to featured image if empty'
          },
          hooks: {
            beforeChange: [formatSEOField('featuredImage')]
          }
        },
        {
          name: 'noIndex',
          type: 'checkbox',
          defaultValue: false
        }
      ]
    }
  ],
  timestamps: true
}

export const BlogCategories: CollectionConfig = {
  slug: 'blog-categories',
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'name'
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'URL-friendly version of the name - auto-generated'
      },
      hooks: {
        beforeChange: [({ value, siblingData }) => {
          if (!value && siblingData?.name) {
            return generateSlug(siblingData.name)
          }
          return value
        }]
      }
    },
    {
      name: 'description',
      type: 'textarea'
    }
  ]
}

export const BlogTags: CollectionConfig = {
  slug: 'blog-tags',
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'name'
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'URL-friendly version of the name - auto-generated'
      },
      hooks: {
        beforeChange: [({ value, siblingData }) => {
          if (!value && siblingData?.name) {
            return generateSlug(siblingData.name)
          }
          return value
        }]
      }
    }
  ]
}