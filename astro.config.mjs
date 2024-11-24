import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import icon from "astro-icon";
import netlify from "@astrojs/netlify";
import react from "@astrojs/react";
import path from "path";

export default defineConfig({
  integrations: [tailwind(), icon({ iconDir: "src/assets/icons" }), react()],
  output: "server",
  adapter: netlify({
    dist: new URL("./dist/", import.meta.url),
    builders: true,
    binaryMediaTypes: ["image/*", "font/*", "application/pdf"],
    edgeMiddleware: true,
    functionPerRoute: false, // Force single SSR function
  }),
  vite: {
    envPrefix: ["PUBLIC_", "SQUARE_", "STRAPI_"],
    define: {
      "import.meta.env.SQUARE_ACCESS_TOKEN": JSON.stringify(
        process.env.SQUARE_ACCESS_TOKEN
      ),
      "import.meta.env.PUBLIC_SQUARE_APP_ID": JSON.stringify(
        process.env.PUBLIC_SQUARE_APP_ID
      ),
      "import.meta.env.PUBLIC_SQUARE_LOCATION_ID": JSON.stringify(
        process.env.PUBLIC_SQUARE_LOCATION_ID
      ),
      "import.meta.env.STRAPI_URL": JSON.stringify(
        process.env.STRAPI_URL || "http://localhost:1337"
      ),
      "import.meta.env.STRAPI_API_TOKEN": JSON.stringify(
        process.env.STRAPI_API_TOKEN
      ),
    },
    resolve: {
      alias: {
        "@": path.resolve("./src"),
        "~": path.resolve("."),
      },
    },
    ssr: {
      noExternal: ["@astrojs/netlify", "square", "@astrojs/react"],
    },
  },
});
