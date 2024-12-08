declare module 'payload' {
  interface PayloadConfig {
    express: any
    secret: string
    db: any
    admin?: { disabled: boolean }
  }

  interface PayloadInstance {
    authenticate: any
    router: any
  }

  const payload: {
    init(config: PayloadConfig): Promise<PayloadInstance>
  }

  export default payload
}

declare module 'express' {
  import express from '../../../cms/node_modules/express'
  export = express
}

declare module '@payloadcms/db-sqlite' {
  import { sqliteAdapter } from '../../../cms/node_modules/@payloadcms/db-sqlite'
  export { sqliteAdapter }
}