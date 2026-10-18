import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the browser tests build and serve a second copy (demo mode) next to the normal one.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Every signed-in screen reads the session cookie, so Cache Components would need a Suspense
  // boundary around nearly everything. Plain dynamic rendering is simpler and fits this app.
  // Keep `next dev` from editing AGENTS.md. That file holds this project's own rules.
  agentRules: false,
  // The browser sees the DSN too (it is not a secret). Setting it under a NEXT_PUBLIC name is what puts it in the bundle.
  env: { NEXT_PUBLIC_SENTRY_DSN: process.env.SENTRY_DSN ?? "" },
  poweredByHeader: false,
  // The profile photo is shrunk in the browser first (lib/shrink-image.ts); this leaves room under Vercel's 4.5 MB request limit.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // Headers that don't change per request. The Content-Security-Policy does (it carries a nonce), so proxy.ts sets it.
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // The site never asks for location, and nothing here may switch these on.
      { key: "Permissions-Policy", value: "geolocation=(), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()" },
      { key: "X-Frame-Options", value: "DENY" },
    ];
    if (process.env.NODE_ENV === "production") {
      headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" });
    }
    return [{ source: "/:path*", headers }];
  },
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
