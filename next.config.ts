import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-hosted in Docker: emit a minimal server bundle instead of needing the
  // whole node_modules tree in the runtime image.
  output: "standalone",

  experimental: {
    optimizePackageImports: ["lucide-react"],
    serverActions: {
      // CSV imports go through a Server Action; the limit clears the 10 MB cap
      // enforced in src/actions/import.ts.
      bodySizeLimit: "12mb",
    },
  },

  // better-sqlite3 and argon2 are native modules — they must not be bundled.
  serverExternalPackages: ["better-sqlite3", "@node-rs/argon2"],

  // Covers are served from our own route off local disk, so the image
  // optimizer is never pointed at a third-party host.
  images: { remotePatterns: [] },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
