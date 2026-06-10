import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";

// Static by default; dashboard and API routes opt out with `export const prerender = false`.
export default defineConfig({
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
});
