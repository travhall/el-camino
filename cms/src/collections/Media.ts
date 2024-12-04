import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
 slug: 'media',
 access: {
   read: () => true,
   create: () => true,
   update: () => true,
 },
 upload: {
   mimeTypes: ['image/*'],
   formatOptions: {
     format: 'webp',
     options: {
       quality: 80
     }
   },
   imageSizes: [
     {
       name: 'thumbnail',
       width: 400,
       height: 300,
       position: 'centre'
     },
     {
       name: 'avatar',
       width: 200,
       height: 200,
       position: 'centre'
     },
   ],
 },
 fields: [
   {
     name: 'alt',
     type: 'text',
     required: true,
   },
 ],
}