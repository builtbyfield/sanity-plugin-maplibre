import { defineCliConfig } from "sanity/cli"

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID || "ohkpgb96",
    dataset: process.env.SANITY_STUDIO_DATASET || "production",
  },
  server: { port: 3333 },
  // The Studio imports the plugin from ../src, which would otherwise resolve these
  // from the repo root and load a second copy of `sanity` (and its contexts).
  vite: config => ({
    ...config,
    resolve: {
      ...config.resolve,
      dedupe: [...(config.resolve?.dedupe ?? []), "sanity", "react", "react-dom", "styled-components", "@sanity/ui"],
    },
  }),
})
