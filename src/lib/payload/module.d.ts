// src/lib/payload/module.d.ts
declare module 'payload' {
    import type { Payload } from '../../../cms/node_modules/payload/dist/payload'
    export * from '../../../cms/node_modules/payload/dist/payload'
    export default Payload
  }
  
  declare module 'express' {
    import express from '../../../cms/node_modules/express'
    export = express
  }
  
  declare module '@payloadcms/db-sqlite' {
    import { sqliteAdapter } from '../../../cms/node_modules/@payloadcms/db-sqlite'
    export { sqliteAdapter }
  }