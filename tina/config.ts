// tina/config.ts
import { defineConfig } from "tinacms";

// Your hosting provider likely exposes this as an environment variable
const branch =
  process.env.GITHUB_BRANCH ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.HEAD ||
  "main";

export default defineConfig({
  branch,

  // Get this from tina.io
  clientId: process.env.NEXT_PUBLIC_TINA_CLIENT_ID,
  // Get this from tina.io
  token: process.env.TINA_TOKEN,

  build: {
    outputFolder: "admin",
    publicFolder: "public",
  },
  media: {
    tina: {
      mediaRoot: "",
      publicFolder: "public",
    },
  },
  // See docs on content modeling for more info on how to setup new content models: https://tina.io/docs/schema/
  schema: {
    collections: [
      {
        name: "post",
        label: "Posts",
        path: "content/posts",
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true,
          },
          {
            type: "datetime",
            name: "publishDate",
            label: "Publish Date",
            ui: {
              dateFormat: "MMMM DD YYYY",
              timeFormat: "hh:mm A",
            },
          },
          {
            type: "image",
            name: "heroImage",
            label: "Hero Image",
          },
          {
            type: "string",
            name: "status",
            label: "Status",
            options: [
              { label: "Draft", value: "draft" },
              { label: "Published", value: "published" },
              { label: "Archived", value: "archived" },
            ],
          },
          {
            type: "object",
            name: "author",
            label: "Author",
            fields: [
              { type: "string", name: "name", label: "Name" },
              { type: "string", name: "avatar", label: "Avatar URL" },
              {
                type: "string",
                name: "bio",
                label: "Biography",
                ui: { component: "textarea" },
              },
            ],
          },
          {
            type: "object",
            name: "seo",
            label: "SEO",
            fields: [
              {
                type: "string",
                name: "description",
                label: "Description",
                ui: { component: "textarea" },
              },
              { type: "string", name: "keywords", label: "Keywords" },
            ],
          },
          {
            type: "rich-text",
            name: "body",
            label: "Body",
            isBody: true,
            parser: { type: "mdx" },
          },
          {
            type: "object",
            list: true,
            name: "tags",
            label: "Tags",
            ui: {
              itemProps: (item) => ({ label: item?.name }),
            },
            fields: [
              { type: "string", name: "name", label: "Tag Name" },
              {
                type: "string",
                name: "color",
                label: "Color",
                ui: { component: "color" },
              },
            ],
          },
        ],
      },
      {
        name: "page",
        label: "Pages",
        path: "content/pages",
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true,
          },
          {
            type: "boolean",
            name: "showInNav",
            label: "Show in Navigation",
          },
          {
            type: "number",
            name: "weight",
            label: "Navigation Weight",
            description: "Lower numbers appear first",
          },
          {
            type: "object",
            list: true,
            name: "sections",
            label: "Page Sections",
            templates: [
              {
                name: "hero",
                label: "Hero Section",
                fields: [
                  { type: "string", name: "heading", label: "Heading" },
                  { type: "string", name: "subheading", label: "Sub Heading" },
                  {
                    type: "image",
                    name: "backgroundImage",
                    label: "Background Image",
                  },
                ],
              },
              {
                name: "content",
                label: "Content Section",
                fields: [
                  { type: "string", name: "title", label: "Title" },
                  { type: "rich-text", name: "content", label: "Content" },
                ],
              },
              {
                name: "gallery",
                label: "Gallery Section",
                fields: [
                  {
                    type: "object",
                    list: true,
                    name: "images",
                    label: "Images",
                    fields: [
                      { type: "image", name: "src", label: "Image" },
                      { type: "string", name: "caption", label: "Caption" },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
});
