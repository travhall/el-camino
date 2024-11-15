import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import icon from "astro-icon";
import netlify from "@astrojs/netlify";
import react from "@astrojs/react";
import path from "path";

export default defineConfig({
  integrations: [tailwind(), icon({ iconDir: "src/assets/icons" }), react()],
  output: "server",
  adapter: netlify(),
  vite: {
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
  },
});
