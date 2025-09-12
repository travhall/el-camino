// src/env.d.ts
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  // Square
  readonly SQUARE_ACCESS_TOKEN: string;
  readonly PUBLIC_SQUARE_APP_ID: string;
  readonly PUBLIC_SQUARE_LOCATION_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Fix JSX IntrinsicElements error
declare global {
  namespace JSX {
    type Element = astroHTML.JSX.Element;
    type IntrinsicElements = astroHTML.JSX.IntrinsicElements;
  }


