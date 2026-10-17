import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the browser tests build and serve a second copy (demo mode) next to the normal one.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Every signed-in screen reads the session cookie, so Cache Components would need a Suspense
  // boundary around nearly everything. Plain dynamic rendering is simpler and fits this app.
  // Keep `next dev` from editing AGENTS.md. That file holds this project's own rules.
  agentRules: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
