import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite"; // NEW: Tailwind v4 plugin
import icon from "astro-icon";
import netlify from "@astrojs/netlify";
import node from "@astrojs/node";
import path from "path";

// Check if we're in preview mode
const isPreview = process.env.PREVIEW === "true";

export default defineConfig({
  integrations: [icon({ iconDir: "src/assets/icons" })], // REMOVED: tailwind() integration
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
  image: {
    service: { entrypoint: "astro/assets/services/sharp" },
    domains: [
      "elcaminoskateshop.wordpress.com",
      "api.elcaminoskateshop.com",
      "images.unsplash.com",
      "via.placeholder.com",
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.gravatar.com",
      },
      {
        protocol: "https",
        hostname: "**.wp.com",
      },
      {
        protocol: "https",
        hostname: "**.squarecdn.com",
      },
      {
        protocol: "https",
        hostname: "**.s3.us-west-2.amazonaws.com",
      },
    ],
    formats: ["avif", "webp", "jpeg"],
    quality: 85,
  },
  server: {
    compress: true,
  },
  vite: {
    plugins: [tailwindcss()], // NEW: Add Tailwind v4 plugin here
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
    build: {
      minify: true,
      cssMinify: true,
      rollupOptions: {
        output: {
          manualChunks: {
            square: ["square"],
          },
        },
      },
    },
  },
});
