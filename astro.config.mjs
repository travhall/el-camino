import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import icon from "astro-icon";
import mdx from "@astrojs/mdx";
import netlify from "@astrojs/netlify";
import node from "@astrojs/node"; // Add node adapter for local preview
import react from "@astrojs/react";
import path from "path";

// Check if we're in preview mode
const isPreview = process.env.PREVIEW === "true";

export default defineConfig({
  integrations: [
    react(),
    tailwind(),
    mdx(),
    icon({ iconDir: "src/assets/icons" }),
  ],
  output: "server",
  adapter: isPreview
    ? node({
        mode: "standalone",
      })
    : netlify({
        builders: true,
        functionPerRoute: true,
        binaryMediaTypes: ["image/*", "font/*", "application/pdf"],
      }),
  experimental: {
    clientPrerender: true,
  },
  server: {
    // Enable compression for development server
    compress: true,
  },
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
    // Add build optimizations for development
    build: {
      minify: true,
      cssMinify: true,
      rollupOptions: {
        // Optimize code splitting
        output: {
          manualChunks: {
            square: ["square"],
            react: ["react", "react-dom"],
          },
        },
      },
    },
    // Optimize dev server
    optimizeDeps: {
      include: ["react", "react-dom"],
    },
  },
});
