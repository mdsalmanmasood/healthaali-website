// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  // Canonical production origin. Used for canonical tags, sitemap and OG URLs.
  site: "https://healthaali.in",

  // Marketing site only: fully static, no SSR adapter required.
  output: "static",

  // Normalise so `/features` and `/features/` never disagree in the sitemap.
  trailingSlash: "ignore",

  // Prefetch in-viewport links; pairs with <ClientRouter /> for instant, light
  // navigation without shipping a framework runtime.
  prefetch: {
    prefetchAll: false,
    defaultStrategy: "viewport",
  },

  build: {
    // Inline small stylesheets, emit the big ones as cacheable files.
    inlineStylesheets: "auto",
  },

  integrations: [sitemap()],
});
