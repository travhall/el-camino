import { defineConfig } from "tinacms";

export default defineConfig({
  branch: "",
  build: {
    publicFolder: "public",
    outputFolder: "admin",
  },
  schema: {
    collections: [],
  },
});
