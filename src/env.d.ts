// src/env.d.ts
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  // Square
  readonly SQUARE_ACCESS_TOKEN: string;
  readonly PUBLIC_SQUARE_APP_ID: string;
  readonly PUBLIC_SQUARE_LOCATION_ID: string;

  // TinaCMS
  readonly PUBLIC_TINA_GRAPHQL_URL: string;
  readonly TINA_TOKEN: string;
  readonly TINA_CLIENT_ID: string;
  readonly GITHUB_BRANCH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
