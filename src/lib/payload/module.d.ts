declare module 'payload' {
  interface PayloadConfig {
    express: any;
    secret: string;
    db: {
      url: string;
    };
    admin?: { disabled: boolean };
  }

  interface PayloadInstance {
    authenticate: any;
    router: any;
  }

  interface Payload {
    init(config: PayloadConfig): Promise<PayloadInstance>;
    authenticate: any;
    router: any;
  }

  const payload: Payload;
  export default payload;
}

declare module 'express' {
  import express from 'express';
  export = express;
}

declare module '@payloadcms/db-sqlite' {
  import { sqliteAdapter } from '@payloadcms/db-sqlite';
  export { sqliteAdapter };
}

declare module 'serverless-http' {
  interface ServerlessResponse {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  }
  
  function serverless(app: any): (event: any, context: any) => Promise<ServerlessResponse>;
  export default serverless;
}