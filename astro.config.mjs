import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import icon from "astro-icon";
import mdx from "@astrojs/mdx";
import netlify from "@astrojs/netlify";
import react from "@astrojs/react";
import path from "path";

export default defineConfig({
  integrations: [
    react(),
    tailwind(),
    mdx(),
    icon({ iconDir: "src/assets/icons" }),
  ],
  output: "server",
  adapter: netlify({
    builders: true,
    functionPerRoute: true,
    binaryMediaTypes: ["image/*", "font/*", "application/pdf"],
  }),
  vite: {
    envPrefix: ["PUBLIC_", "SQUARE_", "NEXT_PUBLIC_"],
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
    },
    resolve: {
      alias: {
        "@": path.resolve("./src"),
        "~": path.resolve("."),
      },
    },
  },
});
